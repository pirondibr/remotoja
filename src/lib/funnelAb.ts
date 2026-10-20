export const FEED_AB_COOKIE = "mvr_feed_ab";
export const FEED_AB_STORAGE_KEY = "mvr_feed_ab";

export type FeedAbVariant = "v1" | "v2";

export function parseFeedAb(raw: unknown): FeedAbVariant | null {
  const value = String(raw || "")
    .trim()
    .toLowerCase();
  return value === "v1" || value === "v2" ? value : null;
}

function persistFeedAb(variant: FeedAbVariant) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(FEED_AB_STORAGE_KEY, variant);
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(FEED_AB_STORAGE_KEY, variant);
  } catch {
    /* ignore */
  }
  document.cookie = `${FEED_AB_COOKIE}=${variant};path=/;max-age=${60 * 60 * 24 * 90};SameSite=Lax`;
}

function readStoredFeedAb(): FeedAbVariant | null {
  if (typeof window === "undefined") return null;
  try {
    const fromSession = parseFeedAb(
      sessionStorage.getItem(FEED_AB_STORAGE_KEY)
    );
    if (fromSession) return fromSession;
  } catch {
    /* ignore */
  }
  try {
    const fromLocal = parseFeedAb(localStorage.getItem(FEED_AB_STORAGE_KEY));
    if (fromLocal) return fromLocal;
  } catch {
    /* ignore */
  }
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${FEED_AB_COOKIE}=(v1|v2)`)
  );
  return match ? parseFeedAb(match[1]) : null;
}

/** 50/50 sticky assignment. `forced` from ?ab=v1|v2 for QA. */
export function assignFeedAb(forced?: string | null): FeedAbVariant {
  const fromUrl = parseFeedAb(forced);
  if (fromUrl) {
    persistFeedAb(fromUrl);
    return fromUrl;
  }
  const stored = readStoredFeedAb();
  if (stored) return stored;
  const next: FeedAbVariant = Math.random() < 0.5 ? "v1" : "v2";
  persistFeedAb(next);
  return next;
}
