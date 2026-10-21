import { loadAttribution } from "@/lib/attribution";
import { parseCheckoutUi, type CheckoutUi } from "@/lib/checkoutUi";
import {
  initiateCheckoutEventId,
  metaBrowserIds,
  trackMetaEvent,
} from "@/lib/metaPixel";
import type { FeedAbVariant } from "@/lib/funnelAb";
import { DEFAULT_PLAN_ID, getPlan, isTestPlan, type PlanId } from "@/lib/rrPlans";

function checkoutUiFromPage(): CheckoutUi | undefined {
  if (typeof window === "undefined") return undefined;
  return parseCheckoutUi(new URL(window.location.href).searchParams.get("checkout")) || undefined;
}

export async function startCheckout(input: {
  planId?: PlanId;
  role: string;
  email?: string;
  funnelVariant?: FeedAbVariant | null;
  checkoutUi?: CheckoutUi | null;
}): Promise<{ checkoutUrl: string; orderId?: string } | { error: string }> {
  const attr = loadAttribution();
  const ids = metaBrowserIds(attr?.fbclid);
  const checkoutUi = input.checkoutUi || checkoutUiFromPage();

  const res = await fetch("/api/checkout/preference", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      planId: input.planId || DEFAULT_PLAN_ID,
      role: input.role,
      email: input.email,
      fbp: ids.fbp,
      fbc: ids.fbc,
      funnel_variant: input.funnelVariant || undefined,
      checkout_ui: checkoutUi,
    }),
  });
  const data = (await res.json()) as {
    checkoutUrl?: string;
    orderId?: string;
    amountBrl?: number;
    error?: string;
  };
  if (!res.ok || !data.checkoutUrl) {
    return { error: data.error || "Não foi possível iniciar o pagamento" };
  }

  const planId = input.planId || DEFAULT_PLAN_ID;
  const plan = getPlan(planId);
  if (!isTestPlan(planId)) {
    const value =
      typeof data.amountBrl === "number" ? data.amountBrl : plan?.priceBrl;
    const eventId = data.orderId
      ? initiateCheckoutEventId(data.orderId)
      : undefined;
    trackMetaEvent(
      "InitiateCheckout",
      {
        value,
        currency: "BRL",
        content_ids: [planId],
        content_type: "product",
        num_items: 1,
      },
      eventId
    );
  }

  return { checkoutUrl: data.checkoutUrl, orderId: data.orderId };
}
