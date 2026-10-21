import { NextResponse } from "next/server";
import { fetchMpPayment, hasMercadoPago } from "@/lib/mercadoPago";
import { purchaseEventId, sendUniqueMetaPurchase } from "@/lib/metaCapi";
import {
  buildMemberToken,
  memberCookieOptions,
} from "@/lib/memberAuth";
import {
  getOrder,
  markOrderApproved,
  saveOrderClickIds,
} from "@/lib/orders";
import { DEFAULT_PLAN_ID, getPlan, isTestPlan, planAccessUntil } from "@/lib/rrPlans";
import { logPaidPurchase } from "@/lib/paidLeadLog";
import { findAccountByOrderId } from "@/lib/memberAccounts";

function clientIp(request: Request): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || undefined;
  return request.headers.get("x-real-ip")?.trim() || undefined;
}

/**
 * Chamado pela página de sucesso com payment_id / external_reference.
 * Grava pedido aprovado e seta cookie de membro.
 */
export async function POST(request: Request) {
  if (!hasMercadoPago()) {
    return NextResponse.json({ error: "Checkout não configurado" }, { status: 503 });
  }

  let body: {
    paymentId?: string;
    externalReference?: string;
    status?: string;
    fbp?: string;
    fbc?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const paymentId = String(body.paymentId || "").trim();
  if (!paymentId) {
    return NextResponse.json({ error: "paymentId obrigatório" }, { status: 400 });
  }

  try {
    const payment = await fetchMpPayment(paymentId);
    if (payment.status !== "approved") {
      return NextResponse.json(
        {
          ok: false,
          status: payment.status,
          error: "Pagamento ainda não aprovado",
        },
        { status: 402 }
      );
    }

    const orderId =
      payment.external_reference ||
      body.externalReference ||
      payment.metadata?.order_id ||
      "";
    if (!orderId) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
    }

    let order = await getOrder(orderId);
    const planId =
      order?.plan_id || payment.metadata?.plan_id || DEFAULT_PLAN_ID;
    const role =
      order?.role || payment.metadata?.role || "SEO";
    const plan = getPlan(planId);
    const accessUntil = planAccessUntil(planId);
    const amountBrl =
      order?.amount_brl != null
        ? Number(order.amount_brl)
        : plan?.priceBrl ?? 0;

    if (!order || order.status !== "approved") {
      order = await markOrderApproved({
        orderId,
        paymentId: String(payment.id),
        payerEmail: payment.payer?.email,
        accessUntil,
      });
    }

    await saveOrderClickIds({
      orderId,
      fbp: body.fbp,
      fbc: body.fbc,
    });
    order = (await getOrder(orderId)) || order;

    if (!isTestPlan(planId)) {
      await sendUniqueMetaPurchase({
        paymentId: String(payment.id),
        orderId,
        value: amountBrl,
        planId,
        email: payment.payer?.email || order?.payer_email,
        fbp: body.fbp || order?.fbp,
        fbc: body.fbc || order?.fbc,
        clientIp: clientIp(request),
        userAgent: request.headers.get("user-agent"),
      });

      await logPaidPurchase({
        role,
        email: payment.payer?.email || order?.payer_email,
        funnelVariant: order?.funnel_variant,
        userAgent: request.headers.get("user-agent"),
      });
    }

    const token = buildMemberToken({
      orderId,
      planId,
      role,
      exp: accessUntil.getTime(),
    });

    const account = await findAccountByOrderId(orderId);
    const res = NextResponse.json({
      ok: true,
      role,
      planId,
      amountBrl,
      paymentId: String(payment.id),
      eventId: purchaseEventId(orderId),
      orderId,
      email: payment.payer?.email || order?.payer_email || "",
      hasAccount: Boolean(account),
      accessUntil: accessUntil.toISOString(),
    });
    const cookie = memberCookieOptions(token);
    res.cookies.set(cookie.name, cookie.value, cookie);
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao confirmar";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
