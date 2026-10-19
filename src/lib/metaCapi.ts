import { createHash } from "crypto";
import { appBaseUrl } from "@/lib/mercadoPago";
import {
  initiateCheckoutEventId,
  purchaseEventId,
} from "@/lib/metaPixel";

export { initiateCheckoutEventId, purchaseEventId };

const GRAPH_VERSION = "v21.0";

function pixelId(): string {
  return (
    process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ||
    process.env.META_PIXEL_ID?.trim() ||
    ""
  );
}

function accessToken(): string {
  return process.env.META_CAPI_ACCESS_TOKEN?.trim() || "";
}

export function hasMetaCapi(): boolean {
  return Boolean(pixelId() && accessToken());
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type MetaCapiUserData = {
  email?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
};

export type MetaCapiCustomData = {
  value?: number;
  currency?: string;
  content_ids?: string[];
  content_type?: string;
  order_id?: string;
  num_items?: number;
};

export type SendMetaEventInput = {
  eventName: string;
  eventId: string;
  eventSourceUrl?: string;
  userData?: MetaCapiUserData;
  customData?: MetaCapiCustomData;
  actionSource?: "website";
};

function buildUserData(user?: MetaCapiUserData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!user) return out;
  const email = user.email ? normalizeEmail(user.email) : "";
  if (email) out.em = [sha256(email)];
  if (user.fbp) out.fbp = user.fbp;
  if (user.fbc) out.fbc = user.fbc;
  if (user.clientIp) out.client_ip_address = user.clientIp;
  if (user.userAgent) out.client_user_agent = user.userAgent;
  return out;
}

export async function sendMetaCapiEvent(
  input: SendMetaEventInput
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const id = pixelId();
  const token = accessToken();
  if (!id || !token) {
    return { ok: true, skipped: true };
  }

  const event: Record<string, unknown> = {
    event_name: input.eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: input.eventId,
    action_source: input.actionSource || "website",
    event_source_url:
      input.eventSourceUrl || `${appBaseUrl()}/checkout/success`,
    user_data: buildUserData(input.userData),
  };

  if (input.customData) {
    const custom: Record<string, unknown> = {};
    if (typeof input.customData.value === "number") {
      custom.value = input.customData.value;
    }
    if (input.customData.currency) custom.currency = input.customData.currency;
    if (input.customData.content_ids) {
      custom.content_ids = input.customData.content_ids;
    }
    if (input.customData.content_type) {
      custom.content_type = input.customData.content_type;
    }
    if (input.customData.order_id) custom.order_id = input.customData.order_id;
    if (typeof input.customData.num_items === "number") {
      custom.num_items = input.customData.num_items;
    }
    event.custom_data = custom;
  }

  const body: Record<string, unknown> = {
    data: [event],
  };
  const testCode = process.env.META_CAPI_TEST_EVENT_CODE?.trim();
  if (testCode) body.test_event_code = testCode;

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${id}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      }
    );
    const data = (await res.json()) as {
      events_received?: number;
      error?: { message?: string };
    };
    if (!res.ok) {
      const message = data.error?.message || `Meta CAPI HTTP ${res.status}`;
      console.error("[meta-capi]", message);
      return { ok: false, error: message };
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Meta CAPI falhou";
    console.error("[meta-capi]", message);
    return { ok: false, error: message };
  }
}

export async function sendMetaPurchase(input: {
  paymentId: string;
  orderId: string;
  value: number;
  planId: string;
  email?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  eventSourceUrl?: string;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  return sendMetaCapiEvent({
    eventName: "Purchase",
    eventId: purchaseEventId(input.paymentId),
    eventSourceUrl: input.eventSourceUrl || `${appBaseUrl()}/checkout/success`,
    userData: {
      email: input.email,
      fbp: input.fbp,
      fbc: input.fbc,
      clientIp: input.clientIp,
      userAgent: input.userAgent,
    },
    customData: {
      value: input.value,
      currency: "BRL",
      content_ids: [input.planId],
      content_type: "product",
      order_id: input.orderId,
      num_items: 1,
    },
  });
}

export async function sendMetaInitiateCheckout(input: {
  orderId: string;
  value: number;
  planId: string;
  email?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  eventSourceUrl?: string;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  return sendMetaCapiEvent({
    eventName: "InitiateCheckout",
    eventId: initiateCheckoutEventId(input.orderId),
    eventSourceUrl: input.eventSourceUrl || `${appBaseUrl()}/onboard`,
    userData: {
      email: input.email,
      fbp: input.fbp,
      fbc: input.fbc,
      clientIp: input.clientIp,
      userAgent: input.userAgent,
    },
    customData: {
      value: input.value,
      currency: "BRL",
      content_ids: [input.planId],
      content_type: "product",
      order_id: input.orderId,
      num_items: 1,
    },
  });
}
