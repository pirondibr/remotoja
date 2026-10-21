import {
  buildFbc,
  buildFbp,
  FBCLID_COOKIE,
  parseCookieHeader,
  writeFirstPartyCookie,
} from "@/lib/metaClickIds";

/** Helpers client-side do Meta Pixel (fbq). */

export type MetaEventParams = {
  value?: number;
  currency?: string;
  content_ids?: string[];
  content_type?: string;
  contents?: Array<{ id: string; quantity: number }>;
  num_items?: number;
  search_string?: string;
  content_category?: string;
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
  const cookies = parseCookieHeader(document.cookie);
  return {
    fbp: cookies._fbp,
    fbc: cookies._fbc,
  };
}

function readStoredClickId(key: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage.getItem(key) || undefined;
  } catch {
    return undefined;
  }
}

function writeStoredClickId(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* privado / quota */
  }
}

function fbcHasFbclid(fbc: string | undefined, fbclid: string): boolean {
  if (!fbc) return false;
  return fbc.endsWith(`.${fbclid}`) || fbc.includes(`.${fbclid}`);
}

/** Grava _fbc (e _fbp se faltar) por 90 dias. */
export function persistMetaClickIds(fbclid?: string | null): {
  fbp?: string;
  fbc?: string;
} {
  const click = (fbclid || "").trim();
  if (click) writeFirstPartyCookie(FBCLID_COOKIE, click);

  const cookies = readMetaCookies();
  const storedFbc = readStoredClickId("mvr_fbc");
  const storedFbp = readStoredClickId("mvr_fbp");
  const existingFbc = cookies.fbc || storedFbc;
  const fbc =
    (click && existingFbc && fbcHasFbclid(existingFbc, click)
      ? existingFbc
      : undefined) ||
    buildFbc(click) ||
    existingFbc;
  if (fbc) {
    writeFirstPartyCookie("_fbc", fbc);
    writeStoredClickId("mvr_fbc", fbc);
  }

  const fbp = cookies.fbp || storedFbp || buildFbp();
  if (fbp) {
    writeFirstPartyCookie("_fbp", fbp);
    writeStoredClickId("mvr_fbp", fbp);
  }
  return { fbp, fbc };
}

/** Monta _fbc a partir do fbclid se o cookie ainda não existe. */
export function ensureFbcFromFbclid(fbclid?: string | null): string | undefined {
  return persistMetaClickIds(fbclid).fbc;
}

export function metaBrowserIds(fbclid?: string | null): {
  fbp?: string;
  fbc?: string;
} {
  return persistMetaClickIds(fbclid);
}

/** Mesmo event_id no pixel e na CAPI — um por pedido, para a Meta deduplicar. */
export function purchaseEventId(orderId: string): string {
  return `purchase_${orderId}`;
}

export function initiateCheckoutEventId(orderId: string): string {
  return `initiate_checkout_${orderId}`;
}

export function searchEventId(role: string): string {
  const key = role
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 40);
  return `search_${key || "cargo"}_${Date.now()}`;
}

export async function waitForMetaPixel(timeoutMs = 2500): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (typeof window.fbq === "function") return true;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    await new Promise((resolve) => window.setTimeout(resolve, 50));
    if (typeof window.fbq === "function") return true;
  }
  return typeof window.fbq === "function";
}

export function trackPurchaseOnce(
  orderId: string,
  params: MetaEventParams,
  eventId: string
): void {
  if (typeof window === "undefined") return;
  const key = `mvr_px_purchase_${orderId}`;
  try {
    if (sessionStorage.getItem(key) === "1") return;
    sessionStorage.setItem(key, "1");
  } catch {
    /* segue o disparo */
  }
  trackMetaEvent("Purchase", params, eventId);
}

export async function firePurchasePixel(input: {
  orderId?: string | null;
  paymentId?: string | null;
  eventId?: string | null;
  value?: number;
  planId?: string | null;
}): Promise<void> {
  const orderId = (input.orderId || "").trim();
  const eventId =
    (input.eventId || "").trim() ||
    (orderId
      ? purchaseEventId(orderId)
      : input.paymentId
        ? purchaseEventId(input.paymentId)
        : "");
  if (!eventId) return;
  await waitForMetaPixel();
  trackPurchaseOnce(
    orderId || eventId,
    {
      value: input.value,
      currency: "BRL",
      content_ids: input.planId ? [input.planId] : undefined,
      content_type: "product",
      num_items: 1,
    },
    eventId
  );
  await new Promise((resolve) => window.setTimeout(resolve, 280));
}

export function trackJobSearch(role: string, eventId?: string): void {
  const search_string = role.trim().slice(0, 120);
  if (search_string.length < 2) return;
  trackMetaEvent(
    "Search",
    {
      search_string,
      content_category: "vagas_remotas",
    },
    eventId
  );
}
