import type { FeedAbVariant } from "@/lib/funnelAb";
import { getPlan, type PlanId } from "@/lib/rrPlans";

const MP_API = "https://api.mercadopago.com";

export function getMpAccessToken(): string {
  return process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim() || "";
}

export function hasMercadoPago(): boolean {
  return Boolean(getMpAccessToken());
}

export function appBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    return vercel.startsWith("http") ? vercel.replace(/\/$/, "") : `https://${vercel}`;
  }
  return "https://minhavagaremota.com.br";
}

export type CreatePreferenceInput = {
  orderId: string;
  planId: PlanId;
  role: string;
  payerEmail?: string;
  funnelVariant?: FeedAbVariant | null;
};

export type PreferenceResult = {
  id: string;
  init_point: string;
  sandbox_init_point?: string;
};

export async function createCheckoutPreference(
  input: CreatePreferenceInput
): Promise<PreferenceResult> {
  const token = getMpAccessToken();
  if (!token) throw new Error("MERCADO_PAGO_ACCESS_TOKEN não configurada");

  const plan = getPlan(input.planId);
  if (!plan) throw new Error("Plano inválido");

  const base = appBaseUrl();
  const role = input.role.trim() || "SEO";
  const body = {
    items: [
      {
        id: plan.id,
        title: `Minha Vaga Remota — ${plan.name}`,
        description: `Acesso ao feed de vagas remotas (${role})`,
        quantity: 1,
        currency_id: "BRL",
        unit_price: plan.priceBrl,
        category_id: "services",
      },
    ],
    payer: input.payerEmail
      ? { email: input.payerEmail.trim().toLowerCase() }
      : undefined,
    external_reference: input.orderId,
    metadata: {
      order_id: input.orderId,
      plan_id: plan.id,
      role,
      funnel_variant: input.funnelVariant || null,
    },
    back_urls: {
      success: `${base}/checkout/success`,
      failure: `${base}/checkout/failure`,
      pending: `${base}/checkout/pending`,
    },
    auto_return: "approved",
    notification_url: `${base}/api/checkout/webhook`,
    statement_descriptor: "MINHAVAGAREM",
    // Cartão + PIX (exclui boleto/lotérica)
    payment_methods: {
      excluded_payment_types: [{ id: "ticket" }, { id: "atm" }],
      installments: 12,
    },
  };

  const res = await fetch(`${MP_API}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": input.orderId,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = (await res.json()) as PreferenceResult & {
    message?: string;
    error?: string;
  };
  if (!res.ok || !data.id || !data.init_point) {
    throw new Error(
      data.message || data.error || `Mercado Pago HTTP ${res.status}`
    );
  }
  return data;
}

export type MpPayment = {
  id: number;
  status: string;
  status_detail?: string;
  external_reference?: string | null;
  payment_type_id?: string;
  payment_method_id?: string;
  transaction_amount?: number;
  payer?: { email?: string };
  metadata?: { order_id?: string; plan_id?: string; role?: string };
};

export async function fetchMpPayment(paymentId: string): Promise<MpPayment> {
  const token = getMpAccessToken();
  if (!token) throw new Error("MERCADO_PAGO_ACCESS_TOKEN não configurada");

  const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = (await res.json()) as MpPayment & { message?: string };
  if (!res.ok) {
    throw new Error(data.message || `Pagamento HTTP ${res.status}`);
  }
  return data;
}

/** Usa sandbox_init_point quando o token é de teste. */
export function checkoutRedirectUrl(pref: PreferenceResult): string {
  const token = getMpAccessToken();
  if (token.startsWith("TEST-") && pref.sandbox_init_point) {
    return pref.sandbox_init_point;
  }
  return pref.init_point;
}
