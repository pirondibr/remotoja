import { NextResponse } from "next/server";
import {
  checkoutRedirectUrl,
  createCheckoutPreference,
  hasMercadoPago,
} from "@/lib/mercadoPago";
import { sendMetaInitiateCheckout } from "@/lib/metaCapi";
import { generateOrderId } from "@/lib/memberAuth";
import { attachPreference, createOrder } from "@/lib/orders";
import {
  hasMpPublicKey,
  resolveCheckoutUi,
} from "@/lib/checkoutUi";
import { parseFeedAb } from "@/lib/funnelAb";
import { getPlan, isTestPlan, type PlanId } from "@/lib/rrPlans";

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
    funnel_variant?: string;
    checkout_ui?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const plan = getPlan(body.planId);

  const role = String(body.role || "SEO").trim() || "SEO";
  const email = String(body.email || "").trim() || undefined;
  const funnelVariant = parseFeedAb(body.funnel_variant);
  const requestedUi = isTestPlan(plan.id)
    ? "brick"
    : resolveCheckoutUi(body.checkout_ui);
  const checkoutUi =
    requestedUi === "brick" && hasMpPublicKey() ? "brick" : "v1";
  const orderId = generateOrderId();

  try {
    await createOrder({
      id: orderId,
      planId: plan.id as PlanId,
      role,
      amountBrl: plan.priceBrl,
      payerEmail: email,
      funnelVariant,
      fbp: body.fbp,
      fbc: body.fbc,
      checkoutUi,
    });

    const preference = await createCheckoutPreference({
      orderId,
      planId: plan.id as PlanId,
      role,
      payerEmail: email,
      funnelVariant,
    });

    await attachPreference(orderId, preference.id);

    if (!isTestPlan(plan.id)) {
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
    }

    const proUrl = checkoutRedirectUrl(preference);
    const brickUrl = `/checkout?order=${encodeURIComponent(orderId)}`;
    const useBrick = checkoutUi === "brick";
    return NextResponse.json({
      orderId,
      preferenceId: preference.id,
      amountBrl: plan.priceBrl,
      planId: plan.id,
      checkoutUi,
      checkoutUrl: useBrick ? brickUrl : proUrl,
      brickUrl,
      proUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha no checkout";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
