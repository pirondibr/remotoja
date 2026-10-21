/** Oferta Minha Vaga Remota (checkout Mercado Pago). */
export const DEFAULT_PLAN_ID = "access";

export const RR_PLANS = [
  {
    id: "access",
    name: "Acesso às vagas",
    badge: "Pagamento único",
    strikethrough: null,
    billed: "Paga uma vez. Sem mensalidade.",
    perMonth: "R$ 29,90",
    popular: true,
    /** Valor cobrado no Mercado Pago (BRL). */
    priceBrl: 29.9,
    /** Acesso longo após o pagamento único. */
    durationDays: 3650,
  },
] as const;

export type PlanId = (typeof RR_PLANS)[number]["id"];

export function getPlan(planId?: string | null) {
  const id = String(planId || "").trim();
  return RR_PLANS.find((p) => p.id === id) ?? RR_PLANS[0];
}

export function planAccessUntil(planId?: string | null): Date {
  const days = getPlan(planId).durationDays;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export function formatBrl(amount: number): string {
  return amount.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function planLabel(planId?: string | null): string {
  if (planId === "quarterly") return "Trimestral";
  if (planId === "monthly") return "Mensal";
  return getPlan(planId).name;
}
