import { loadAttribution } from "@/lib/attribution";
import {
  initiateCheckoutEventId,
  metaBrowserIds,
  trackMetaEvent,
} from "@/lib/metaPixel";
import type { PlanId } from "@/lib/rrPlans";
import { getPlan } from "@/lib/rrPlans";

export async function startCheckout(input: {
  planId: PlanId;
  role: string;
  email?: string;
}): Promise<{ checkoutUrl: string; orderId?: string } | { error: string }> {
  const attr = loadAttribution();
  const ids = metaBrowserIds(attr?.fbclid);

  const res = await fetch("/api/checkout/preference", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      planId: input.planId,
      role: input.role,
      email: input.email,
      fbp: ids.fbp,
      fbc: ids.fbc,
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

  const plan = getPlan(input.planId);
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
      content_ids: [input.planId],
      content_type: "product",
      num_items: 1,
    },
    eventId
  );

  return { checkoutUrl: data.checkoutUrl, orderId: data.orderId };
}
