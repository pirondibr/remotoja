import { NextResponse } from "next/server";
import { fetchMpPayment, hasMercadoPago } from "@/lib/mercadoPago";
import { sendMetaPurchase } from "@/lib/metaCapi";
import {
  getOrder,
  markMetaPurchaseSent,
  markOrderApproved,
  markOrderStatus,
  shouldSendMetaPurchase,
} from "@/lib/orders";
import { getPlan } from "@/lib/rrPlans";

async function processPayment(paymentId: string) {
  const payment = await fetchMpPayment(paymentId);
  const orderId =
    payment.external_reference ||
    payment.metadata?.order_id ||
    "";
  if (!orderId) return;

  const order = await getOrder(orderId);
  if (!order) return;

  if (payment.status === "approved") {
    if (order.status !== "approved") {
      const plan = getPlan(order.plan_id);
      const days = plan?.durationDays ?? 30;
      const accessUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      await markOrderApproved({
        orderId,
        paymentId: String(payment.id),
        payerEmail: payment.payer?.email,
        accessUntil,
      });
    }

    if (await shouldSendMetaPurchase(orderId)) {
      const plan = getPlan(order.plan_id);
      const value =
        typeof order.amount_brl === "number"
          ? Number(order.amount_brl)
          : plan?.priceBrl ?? 0;
      const sent = await sendMetaPurchase({
        paymentId: String(payment.id),
        orderId,
        value,
        planId: order.plan_id,
        email: payment.payer?.email || order.payer_email,
      });
      if (sent.ok && !sent.skipped) {
        await markMetaPurchaseSent(orderId);
      }
    }
    return;
  }

  if (payment.status === "pending" || payment.status === "in_process") {
    await markOrderStatus(orderId, "pending", String(payment.id));
    return;
  }

  if (
    payment.status === "rejected" ||
    payment.status === "cancelled" ||
    payment.status === "refunded"
  ) {
    await markOrderStatus(orderId, payment.status, String(payment.id));
  }
}

export async function POST(request: Request) {
  if (!hasMercadoPago()) {
    return NextResponse.json({ ok: true });
  }

  try {
    const url = new URL(request.url);
    const topic =
      url.searchParams.get("topic") ||
      url.searchParams.get("type") ||
      "";
    const idFromQuery = url.searchParams.get("id") || url.searchParams.get("data.id");

    let paymentId = idFromQuery || "";
    try {
      const body = (await request.json()) as {
        type?: string;
        action?: string;
        data?: { id?: string };
      };
      if (body?.data?.id) paymentId = String(body.data.id);
      if (!topic && body?.type) {
        // payment / topic.merchant_order
      }
    } catch {
      // body vazio ok
    }

    if (paymentId && (topic.includes("payment") || !topic || topic === "payment")) {
      await processPayment(paymentId);
    }
  } catch (err) {
    console.error("[mp webhook]", err);
  }

  // Sempre 200 para o MP não reintentar em loop agressivo
  return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  // Alguns painéis do MP pingam com GET
  return POST(request);
}
