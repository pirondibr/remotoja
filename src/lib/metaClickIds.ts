/** Click IDs e cookies da Meta — usado no browser e no servidor. */

export const META_CLICK_COOKIE_MAX_AGE = 90 * 24 * 60 * 60;
export const FBCLID_COOKIE = "mvr_fbclid";

export type MetaClickIds = {
  fbp?: string;
  fbc?: string;
  fbclid?: string;
};

export function parseCookieHeader(
  header?: string | null
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (!rawKey) continue;
    let value = rest.join("=").trim();
    try {
      value = decodeURIComponent(value);
    } catch {
      /* mantém o valor cru */
    }
    out[rawKey.trim()] = value;
  }
  return out;
}

export function buildFbc(
  fbclid?: string | null,
  createdAtSec?: number
): string | undefined {
  const click = (fbclid || "").trim();
  if (!click) return undefined;
  if (click.startsWith("fb.1.")) return click;
  const created = createdAtSec ?? Math.floor(Date.now() / 1000);
  return `fb.1.${created}.${click}`;
}

export function buildFbp(createdAtSec?: number): string {
  const created = createdAtSec ?? Math.floor(Date.now() / 1000);
  const rand = Math.floor(Math.random() * 1e13);
  return `fb.1.${created}.${rand}`;
}

export function clientIpFromRequest(request: Request): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || undefined;
  return request.headers.get("x-real-ip")?.trim() || undefined;
}

export function resolveMetaClickIds(input: {
  cookieHeader?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  fbclid?: string | null;
}): MetaClickIds {
  const cookies = parseCookieHeader(input.cookieHeader);
  const fbclid =
    (input.fbclid || cookies[FBCLID_COOKIE] || "").trim() || undefined;
  const fbp = (input.fbp || cookies._fbp || "").trim() || undefined;
  const fbc =
    (input.fbc || cookies._fbc || "").trim() || buildFbc(fbclid) || undefined;
  return { fbp, fbc, fbclid };
}

export function writeFirstPartyCookie(
  name: string,
  value: string,
  maxAge = META_CLICK_COOKIE_MAX_AGE
): void {
  if (typeof document === "undefined" || !value) return;
  const secure =
    typeof location !== "undefined" && location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
}
