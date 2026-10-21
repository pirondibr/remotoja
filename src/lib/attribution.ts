import {
  buildFbc,
  FBCLID_COOKIE,
  parseCookieHeader,
  writeFirstPartyCookie,
} from "@/lib/metaClickIds";

const STORAGE_KEY = "mvr_attribution_v1";

export type Attribution = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  gclid?: string;
  referrer?: string;
};

const KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "gclid",
] as const;

function readStoredAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  const fromSession = parseStored(safeGet("sessionStorage"));
  const fromLocal = parseStored(safeGet("localStorage"));
  return { ...fromLocal, ...fromSession };
}

function safeGet(store: "sessionStorage" | "localStorage"): string | null {
  try {
    return window[store].getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function parseStored(raw: string | null): Attribution {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Attribution;
  } catch {
    return {};
  }
}

function writeStoredAttribution(merged: Attribution): void {
  const json = JSON.stringify(merged);
  try {
    sessionStorage.setItem(STORAGE_KEY, json);
  } catch {
    /* privado / quota */
  }
  try {
    localStorage.setItem(STORAGE_KEY, json);
  } catch {
    /* privado / quota */
  }
}

function persistFbclidCookies(fbclid?: string): void {
  if (!fbclid || typeof document === "undefined") return;
  writeFirstPartyCookie(FBCLID_COOKIE, fbclid);
  const existing = parseCookieHeader(document.cookie)._fbc;
  if (!existing) {
    const fbc = buildFbc(fbclid);
    if (fbc) writeFirstPartyCookie("_fbc", fbc);
  }
}

export function captureAttributionFromUrl(searchParams: URLSearchParams): Attribution {
  const next: Attribution = {};
  for (const key of KEYS) {
    const value = searchParams.get(key)?.trim();
    if (value) next[key] = value;
  }
  if (typeof document !== "undefined" && document.referrer) {
    next.referrer = document.referrer.slice(0, 500);
  }

  if (typeof window === "undefined") return next;

  const prev = loadAttribution() || {};
  const merged: Attribution = { ...prev };
  for (const key of KEYS) {
    if (next[key]) merged[key] = next[key];
  }
  if (next.referrer && !merged.referrer) merged.referrer = next.referrer;
  writeStoredAttribution(merged);
  persistFbclidCookies(merged.fbclid);
  return merged;
}

export function loadAttribution(): Attribution | null {
  if (typeof window === "undefined") return null;
  const stored = readStoredAttribution();
  const cookieFbclid =
    typeof document !== "undefined"
      ? parseCookieHeader(document.cookie)[FBCLID_COOKIE]
      : undefined;
  const fbclid = stored.fbclid || cookieFbclid;
  if (!stored.fbclid && !fbclid && !stored.utm_source && !stored.gclid) {
    return Object.keys(stored).length ? stored : null;
  }
  return fbclid && !stored.fbclid ? { ...stored, fbclid } : stored;
}

/** Origem legível para o admin (Meta, Google, orgânico…). */
export function originLabel(a: {
  utm_source?: string | null;
  utm_medium?: string | null;
  fbclid?: string | null;
  gclid?: string | null;
  referrer?: string | null;
}): string {
  const source = (a.utm_source || "").toLowerCase();
  const medium = (a.utm_medium || "").toLowerCase();
  if (a.fbclid || source.includes("facebook") || source.includes("meta") || source === "ig") {
    return "Meta";
  }
  if (a.gclid || source.includes("google") || medium === "cpc" || medium === "ppc") {
    return "Google";
  }
  if (source || medium) {
    return [a.utm_source, a.utm_medium].filter(Boolean).join(" / ");
  }
  if (a.referrer) {
    try {
      return new URL(a.referrer).hostname.replace(/^www\./, "");
    } catch {
      return "Referrer";
    }
  }
  return "Direto / orgânico";
}
