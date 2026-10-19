/** Helpers client-side do Meta Pixel (fbq). */

export type MetaEventParams = {
  value?: number;
  currency?: string;
  content_ids?: string[];
  content_type?: string;
  contents?: Array<{ id: string; quantity: number }>;
  num_items?: number;
};

declare global {
  interface Window {
    fbq?: (
      action: string,
      eventOrId: string,
      params?: Record<string, unknown>,
      options?: { eventID?: string }
    ) => void;
    _fbq?: unknown;
  }
}

export function getMetaPixelId(): string {
  return process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || "";
}

export function trackMetaEvent(
  eventName: string,
  params?: MetaEventParams,
  eventId?: string
): void {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  const payload = params ? { ...params } : undefined;
  if (eventId) {
    window.fbq("track", eventName, payload || {}, { eventID: eventId });
  } else {
    window.fbq("track", eventName, payload || {});
  }
}

/** Lê cookies _fbp / _fbc gerados pelo Pixel. */
export function readMetaCookies(): { fbp?: string; fbc?: string } {
  if (typeof document === "undefined") return {};
  const out: { fbp?: string; fbc?: string } = {};
  for (const part of document.cookie.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    const key = rawKey?.trim();
    const value = rest.join("=").trim();
    if (!key || !value) continue;
    if (key === "_fbp") out.fbp = value;
    if (key === "_fbc") out.fbc = value;
  }
  return out;
}

/** Monta _fbc a partir de fbclid se o cookie ainda não existe. */
export function ensureFbcFromFbclid(fbclid?: string | null): string | undefined {
  const { fbc, fbp } = readMetaCookies();
  if (fbc) return fbc;
  const click = (fbclid || "").trim();
  if (!click) return undefined;
  const created = Math.floor(Date.now() / 1000);
  return `fb.1.${created}.${click}`;
}

export function metaBrowserIds(fbclid?: string | null): {
  fbp?: string;
  fbc?: string;
} {
  const cookies = readMetaCookies();
  return {
    fbp: cookies.fbp,
    fbc: cookies.fbc || ensureFbcFromFbclid(fbclid),
  };
}

export function purchaseEventId(paymentId: string): string {
  return `purchase_${paymentId}`;
}

export function initiateCheckoutEventId(orderId: string): string {
  return `initiate_checkout_${orderId}`;
}
