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

  try {
    const prev = loadAttribution() || {};
    const merged: Attribution = { ...prev };
    for (const key of KEYS) {
      if (next[key]) merged[key] = next[key];
    }
    if (next.referrer && !merged.referrer) merged.referrer = next.referrer;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return merged;
  } catch {
    return next;
  }
}

export function loadAttribution(): Attribution | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Attribution;
  } catch {
    return null;
  }
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
