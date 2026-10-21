import type { FeedAbVariant } from "@/lib/funnelAb";
import { getPlan, isPixOnlyPlan, type PlanId } from "@/lib/rrPlans";

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
    /**
     * `approved` só volta sozinho no cartão aprovado (e o MP pode levar até 40s).
     * `all` também devolve no Pix pendente — senão a pessoa fica na tela do MP
     * e precisa clicar em “Voltar ao site”.
     */
    auto_return: "all",
    notification_url: `${base}/api/checkout/webhook`,
    statement_descriptor: "MINHAVAGAREM",
    payment_methods: {
      excluded_payment_types: isPixOnlyPlan(plan.id)
        ? [
            { id: "ticket" },
            { id: "atm" },
            { id: "credit_card" },
            { id: "debit_card" },
            { id: "prepaid_card" },
          ]
        : [
            { id: "ticket" },
            { id: "atm" },
            { id: "debit_card" },
            { id: "prepaid_card" },
          ],
      installments: isPixOnlyPlan(plan.id) ? 1 : 12,
    },
  };

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-Idempotency-Key": input.orderId,
  };

  let res = await fetch(`${MP_API}/checkout/preferences`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
  });

  let data = (await res.json()) as PreferenceResult & {
    message?: string;
    error?: string;
    cause?: Array<{ code?: string; description?: string }>;
  };

  const autoReturnRejected =
    !res.ok &&
    /auto_return/i.test(
      `${data.message || ""} ${data.error || ""} ${JSON.stringify(data.cause || [])}`
    );
  if (autoReturnRejected) {
    res = await fetch(`${MP_API}/checkout/preferences`, {
      method: "POST",
      headers: {
        ...headers,
        "X-Idempotency-Key": `${input.orderId}-approved`,
      },
      body: JSON.stringify({ ...body, auto_return: "approved" }),
      cache: "no-store",
    });
    data = (await res.json()) as typeof data;
  }

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
  point_of_interaction?: {
    type?: string;
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;
    };
  };
};

export type PixCheckoutData = {
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string;
};

export function pixFromPayment(payment: MpPayment): PixCheckoutData | null {
  const tx = payment.point_of_interaction?.transaction_data;
  const qrCode = String(tx?.qr_code || "").trim();
  const qrCodeBase64 = String(tx?.qr_code_base64 || "").trim();
  const ticketUrl = String(tx?.ticket_url || "").trim();
  if (!qrCode && !qrCodeBase64) return null;
  return { qrCode, qrCodeBase64, ticketUrl };
}

export async function createMpPayment(input: {
  orderId: string;
  planId: string;
  role: string;
  amountBrl: number;
  formData: Record<string, unknown>;
  payerEmail?: string | null;
}): Promise<MpPayment> {
  const token = getMpAccessToken();
  if (!token) throw new Error("MERCADO_PAGO_ACCESS_TOKEN não configurada");

  const form = { ...input.formData };
  const payerRaw =
    form.payer && typeof form.payer === "object"
      ? (form.payer as Record<string, unknown>)
      : {};
  const email =
    String(payerRaw.email || input.payerEmail || "")
      .trim()
      .toLowerCase() || undefined;

  const body = {
    ...form,
    transaction_amount: input.amountBrl,
    description: `Minha Vaga Remota — ${input.role}`,
    external_reference: input.orderId,
    metadata: {
      order_id: input.orderId,
      plan_id: input.planId,
      role: input.role,
      checkout_ui: "brick",
    },
    notification_url: `${appBaseUrl()}/api/checkout/webhook`,
    statement_descriptor: "MINHAVAGAREM",
    payer: {
      ...payerRaw,
      ...(email ? { email } : {}),
    },
  };

  const res = await fetch(`${MP_API}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": `${input.orderId}-${Date.now()}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = (await res.json()) as MpPayment & {
    message?: string;
    error?: string;
    cause?: Array<{ description?: string }>;
  };
  if (!res.ok || !data.id) {
    const cause = data.cause?.[0]?.description || "";
    throw new Error(data.message || data.error || cause || `Pagamento HTTP ${res.status}`);
  }
  return data;
}

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

export function preferenceCheckoutUrl(preferenceId: string): string {
  const token = getMpAccessToken();
  const host = token.startsWith("TEST-")
    ? "https://sandbox.mercadopago.com.br"
    : "https://www.mercadopago.com.br";
  return `${host}/checkout/v1/redirect?pref_id=${encodeURIComponent(preferenceId)}`;
}

/** Usa sandbox_init_point quando o token é de teste. */
export function checkoutRedirectUrl(pref: PreferenceResult): string {
  const token = getMpAccessToken();
  if (token.startsWith("TEST-") && pref.sandbox_init_point) {
    return pref.sandbox_init_point;
  }
  return pref.init_point;
}
