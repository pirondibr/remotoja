/** Planos no formato Remote Rocketship (preços do print BR). */
export const RR_PLANS = [
  {
    id: "yearly",
    name: "Plano anual",
    badge: "72% OFF aplicado",
    strikethrough: "R$1.080",
    billed: "R$ 299/ano",
    perMonth: "R$24,90",
    popular: true,
    /** Valor cobrado no Mercado Pago (BRL). */
    priceBrl: 299,
    durationDays: 365,
  },
  {
    id: "quarterly",
    name: "Plano trimestral",
    badge: "34% OFF aplicado",
    strikethrough: "R$270",
    billed: "R$ 179/ 3 meses",
    perMonth: "R$59,60",
    popular: false,
    priceBrl: 179,
    durationDays: 90,
  },
  {
    id: "monthly",
    name: "Plano mensal",
    badge: null,
    strikethrough: null,
    billed: null,
    perMonth: "R$90",
    popular: false,
    priceBrl: 90,
    durationDays: 30,
  },
] as const;

export type PlanId = (typeof RR_PLANS)[number]["id"];

export function getPlan(planId: string) {
  return RR_PLANS.find((p) => p.id === planId) ?? null;
}
