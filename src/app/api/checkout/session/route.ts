import { NextResponse } from "next/server";
import { getMpPublicKey, hasMpPublicKey } from "@/lib/checkoutUi";
import { fetchMpPayment, pixFromPayment, preferenceCheckoutUrl } from "@/lib/mercadoPago";
import { getOrder } from "@/lib/orders";
import { getPlan, isPixOnlyPlan } from "@/lib/rrPlans";

export async function GET(request: Request) {
  const orderId = new URL(request.url).searchParams.get("order")?.trim() || "";
  if (!orderId) {
    return NextResponse.json({ error: "Pedido obrigatório" }, { status: 400 });
  }

  const order = await getOrder(orderId);
  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }

  const plan = getPlan(order.plan_id);
  const proUrl = order.mp_preference_id
    ? preferenceCheckoutUrl(order.mp_preference_id)
    : "";

  let pix = null;
  if (order.mp_payment_id && order.status !== "approved") {
    try {
      pix = pixFromPayment(await fetchMpPayment(order.mp_payment_id));
    } catch {
      pix = null;
    }
  }

  return NextResponse.json({
    orderId: order.id,
    paymentId: order.mp_payment_id,
    status: order.status,
    role: order.role,
    planId: order.plan_id,
    planName: plan?.name || order.plan_id,
    amountBrl: Number(order.amount_brl),
    email: order.payer_email || "",
    preferenceId: order.mp_preference_id,
    publicKey: getMpPublicKey(),
    hasPublicKey: hasMpPublicKey(),
    proUrl,
    pix,
    pixOnly: isPixOnlyPlan(order.plan_id),
  });
}
