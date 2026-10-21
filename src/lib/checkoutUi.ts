export const CHECKOUT_UI_STORAGE_KEY = "mvr_checkout_ui";

export type CheckoutUi = "v1" | "brick";

export function parseCheckoutUi(raw: unknown): CheckoutUi | null {
  const value = String(raw || "")
    .trim()
    .toLowerCase();
  if (value === "v1" || value === "pro") return "v1";
  if (value === "brick" || value === "v2" || value === "transparent") {
    return "brick";
  }
  return null;
}

export function getMpPublicKey(): string {
  return (
    process.env.MERCADO_PAGO_PUBLIC_KEY?.trim() ||
    process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY?.trim() ||
    ""
  );
}

export function hasMpPublicKey(): boolean {
  return Boolean(getMpPublicKey());
}

/** Padrão: Brick. Sem chave pública, cai no Pro (v1) para não quebrar venda. */
export function defaultCheckoutUi(): CheckoutUi {
  const forced = parseCheckoutUi(
    process.env.NEXT_PUBLIC_CHECKOUT_UI || process.env.CHECKOUT_UI
  );
  if (forced === "v1") return "v1";
  if (forced === "brick") return "brick";
  return hasMpPublicKey() ? "brick" : "v1";
}

export function resolveCheckoutUi(raw?: unknown): CheckoutUi {
  return parseCheckoutUi(raw) || defaultCheckoutUi();
}

export function checkoutUiLabel(ui?: string | null): string {
  return ui === "brick" ? "Brick" : "Pro";
}
