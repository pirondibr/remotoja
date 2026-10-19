import { NextResponse } from "next/server";
import {
  checkoutRedirectUrl,
  createCheckoutPreference,
  hasMercadoPago,
} from "@/lib/mercadoPago";
import { sendMetaInitiateCheckout } from "@/lib/metaCapi";
import { generateOrderId } from "@/lib/memberAuth";
import { attachPreference, createOrder } from "@/lib/orders";
import { getPlan, type PlanId } from "@/lib/rrPlans";

function clientIp(request: Request): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || undefined;
  return request.headers.get("x-real-ip")?.trim() || undefined;
}

export async function POST(request: Request) {
  if (!hasMercadoPago()) {
    return NextResponse.json(
      { error: "Checkout indisponível: configure MERCADO_PAGO_ACCESS_TOKEN" },
      { status: 503 }
    );
  }

  let body: {
    planId?: string;
    role?: string;
    email?: string;
    fbp?: string;
    fbc?: string;
  };
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

    // CAPI InitiateCheckout (browser dispara o mesmo event_id)
    void sendMetaInitiateCheckout({
      orderId,
      value: plan.priceBrl,
      planId: plan.id,
      email,
      fbp: body.fbp,
      fbc: body.fbc,
      clientIp: clientIp(request),
      userAgent: request.headers.get("user-agent"),
    }).catch(() => {});

    return NextResponse.json({
      orderId,
      preferenceId: preference.id,
      amountBrl: plan.priceBrl,
      planId: plan.id,
      checkoutUrl: checkoutRedirectUrl(preference),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha no checkout";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
