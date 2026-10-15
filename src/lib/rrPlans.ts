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
  },
  {
    id: "quarterly",
    name: "Plano trimestral",
    badge: "34% OFF aplicado",
    strikethrough: "R$270",
    billed: "R$ 179/ 3 meses",
    perMonth: "R$59,60",
    popular: false,
  },
  {
    id: "monthly",
    name: "Plano mensal",
    badge: null,
    strikethrough: null,
    billed: null,
    perMonth: "R$90",
    popular: false,
  },
] as const;
