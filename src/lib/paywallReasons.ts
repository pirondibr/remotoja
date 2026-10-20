export const PAYWALL_REASONS = [
  { id: "pricey", label: "Achei caro" },
  { id: "bad_match", label: "As vagas não combinaram com o que eu procuro" },
  { id: "want_more", label: "Quero ver mais vagas antes de decidir" },
  { id: "distrust", label: "Não confio em pagar num site que não conheço" },
  { id: "browsing", label: "Só estava dando uma olhada" },
  { id: "other", label: "Outro" },
] as const;

export type PaywallReasonId = (typeof PAYWALL_REASONS)[number]["id"];

export function paywallReasonLabel(
  id: string,
  detail?: string | null
): string {
  const row = PAYWALL_REASONS.find((item) => item.id === id);
  const label = row?.label || id;
  const extra = (detail || "").trim();
  if (id === "other" && extra) return `Outro: ${extra}`;
  return extra && id !== "other" ? `${label} (${extra})` : label;
}

export function parsePaywallReasonId(raw: unknown): PaywallReasonId | null {
  const value = String(raw || "").trim();
  return PAYWALL_REASONS.some((item) => item.id === value)
    ? (value as PaywallReasonId)
    : null;
}
