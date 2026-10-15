import { NextResponse } from "next/server";
import {
  checkoutRedirectUrl,
  createCheckoutPreference,
  hasMercadoPago,
} from "@/lib/mercadoPago";
import { generateOrderId } from "@/lib/memberAuth";
import { attachPreference, createOrder } from "@/lib/orders";
import { getPlan, type PlanId } from "@/lib/rrPlans";

export async function POST(request: Request) {
  if (!hasMercadoPago()) {
    return NextResponse.json(
      { error: "Checkout indisponível: configure MERCADO_PAGO_ACCESS_TOKEN" },
      { status: 503 }
    );
  }

  let body: { planId?: string; role?: string; email?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const plan = getPlan(String(body.planId || ""));
  if (!plan) {
    return NextResponse.json({ error: "Plano inválido" }, { status: 400 });
  }

  const role = String(body.role || "SEO").trim() || "SEO";
  const email = String(body.email || "").trim() || undefined;
  const orderId = generateOrderId();

  try {
    await createOrder({
      id: orderId,
      planId: plan.id as PlanId,
      role,
      amountBrl: plan.priceBrl,
      payerEmail: email,
    });

    const preference = await createCheckoutPreference({
      orderId,
      planId: plan.id as PlanId,
      role,
      payerEmail: email,
    });

    await attachPreference(orderId, preference.id);

    return NextResponse.json({
      orderId,
      preferenceId: preference.id,
      checkoutUrl: checkoutRedirectUrl(preference),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha no checkout";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
