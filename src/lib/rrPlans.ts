/** Planos RemotoJá (checkout Mercado Pago). */
export const RR_PLANS = [
  {
    id: "monthly",
    name: "Plano mensal",
    badge: "30% OFF",
    strikethrough: "R$55,70",
    billed: null,
    perMonth: "R$39",
    popular: true,
    /** Valor cobrado no Mercado Pago (BRL). */
    priceBrl: 39,
    durationDays: 30,
  },
  {
    id: "quarterly",
    name: "Plano trimestral",
    badge: null,
    strikethrough: null,
    billed: "R$ 99/ 3 meses",
    perMonth: "R$33",
    popular: false,
    priceBrl: 99,
    durationDays: 90,
  },
] as const;

export type PlanId = (typeof RR_PLANS)[number]["id"];

export function getPlan(planId: string) {
  return RR_PLANS.find((p) => p.id === planId) ?? null;
}
