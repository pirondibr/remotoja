/** Oferta Minha Vaga Remota (checkout Mercado Pago). */
export const DEFAULT_PLAN_ID = "access";

export const RR_PLANS = [
  {
    id: "access",
    name: "Acesso às vagas",
    badge: "Pagamento único",
    strikethrough: null,
    billed: "Pague pelo Pix ou cartão. Uma vez, sem mensalidade.",
    payOptions: ["Pague pelo Pix", "Cartão"],
    perMonth: "R$ 29,90",
    popular: true,
    /** Valor cobrado no Mercado Pago (BRL). */
    priceBrl: 29.9,
    /** Acesso longo após o pagamento único. */
    durationDays: 3650,
  },
] as const;

/** Checkout interno em /teste — R$ 5 só no Pix. Não entra na oferta pública. */
export const TEST_PLAN_ID = "teste";

export const TEST_PLAN = {
  id: "teste",
  name: "Teste Pix",
  badge: "Só Pix",
  strikethrough: null,
  billed: "Checkout de teste. R$ 5 só no Pix.",
  payOptions: ["Pague pelo Pix"],
  perMonth: "R$ 5,00",
  popular: false,
  priceBrl: 5,
  durationDays: 1,
} as const;

const CHECKOUT_PLANS = [...RR_PLANS, TEST_PLAN];

export type PlanId = (typeof CHECKOUT_PLANS)[number]["id"];

export function getPlan(planId?: string | null) {
  const id = String(planId || "").trim();
  return CHECKOUT_PLANS.find((p) => p.id === id) ?? RR_PLANS[0];
}

export function isTestPlan(planId?: string | null): boolean {
  return String(planId || "").trim() === TEST_PLAN_ID;
}

export function isPixOnlyPlan(planId?: string | null): boolean {
  return isTestPlan(planId);
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
  if (isTestPlan(planId)) return TEST_PLAN.name;
  return getPlan(planId).name;
}
