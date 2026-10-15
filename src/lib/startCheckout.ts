import type { PlanId } from "@/lib/rrPlans";

export async function startCheckout(input: {
  planId: PlanId;
  role: string;
  email?: string;
}): Promise<{ checkoutUrl: string } | { error: string }> {
  const res = await fetch("/api/checkout/preference", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      planId: input.planId,
      role: input.role,
      email: input.email,
    }),
  });
  const data = (await res.json()) as {
    checkoutUrl?: string;
    error?: string;
  };
  if (!res.ok || !data.checkoutUrl) {
    return { error: data.error || "Não foi possível iniciar o pagamento" };
  }
  return { checkoutUrl: data.checkoutUrl };
}
