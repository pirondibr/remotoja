import { NextResponse } from "next/server";
import { fetchMpPayment, getMpAccessToken, hasMercadoPago } from "@/lib/mercadoPago";
import { sendUniqueMetaPurchase } from "@/lib/metaCapi";
import {
  getOrder,
  markOrderApproved,
  markOrderStatus,
} from "@/lib/orders";
import { getPlan, isTestPlan, planAccessUntil } from "@/lib/rrPlans";
import { logPaidPurchase } from "@/lib/paidLeadLog";

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
      const accessUntil = planAccessUntil(order.plan_id);
      await markOrderApproved({
        orderId,
        paymentId: String(payment.id),
        payerEmail: payment.payer?.email,
        accessUntil,
      });
    }

    if (!isTestPlan(order.plan_id)) {
      await logPaidPurchase({
        role: order.role,
        email: payment.payer?.email || order.payer_email,
        funnelVariant: order.funnel_variant,
      });

      const plan = getPlan(order.plan_id);
      const value =
        typeof order.amount_brl === "number"
          ? Number(order.amount_brl)
          : plan?.priceBrl ?? 0;
      await sendUniqueMetaPurchase({
        paymentId: String(payment.id),
        orderId,
        value,
        planId: order.plan_id,
        email: payment.payer?.email || order.payer_email,
        fbp: order.fbp,
        fbc: order.fbc,
      });
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

/** Pix / IPN antigo frequentemente manda topic=merchant_order. */
async function paymentIdsFromMerchantOrder(
  merchantOrderId: string
): Promise<string[]> {
  const token = getMpAccessToken();
  if (!token) return [];
  const res = await fetch(
    `https://api.mercadopago.com/merchant_orders/${merchantOrderId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }
  );
  if (!res.ok) return [];
  const data = (await res.json()) as {
    payments?: Array<{ id?: number | string; status?: string }>;
  };
  return (data.payments || [])
    .map((p) => (p.id != null ? String(p.id) : ""))
    .filter(Boolean);
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
    const idFromQuery =
      url.searchParams.get("id") || url.searchParams.get("data.id") || "";

    let paymentId = "";
    let merchantOrderId = "";
    let bodyType = "";

    try {
      const body = (await request.json()) as {
        type?: string;
        topic?: string;
        action?: string;
        data?: { id?: string };
        resource?: string;
      };
      bodyType = String(body?.type || body?.topic || "");
      if (body?.data?.id) {
        if (
          bodyType.includes("merchant_order") ||
          topic.includes("merchant_order")
        ) {
          merchantOrderId = String(body.data.id);
        } else {
          paymentId = String(body.data.id);
        }
      }
    } catch {
      // body vazio ok
    }

    if (!paymentId && !merchantOrderId && idFromQuery) {
      if (topic.includes("merchant_order") || bodyType.includes("merchant_order")) {
        merchantOrderId = idFromQuery;
      } else {
        paymentId = idFromQuery;
      }
    }

    const paymentIds: string[] = [];
    if (paymentId) paymentIds.push(paymentId);
    if (merchantOrderId) {
      paymentIds.push(...(await paymentIdsFromMerchantOrder(merchantOrderId)));
    }

    for (const id of [...new Set(paymentIds)]) {
      try {
        await processPayment(id);
      } catch (err) {
        console.error("[mp webhook] payment", id, err);
      }
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
