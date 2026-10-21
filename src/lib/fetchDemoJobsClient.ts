import {
  captureAttributionFromUrl,
  loadAttribution,
} from "@/lib/attribution";
import {
  metaBrowserIds,
  searchEventId,
  trackJobSearch,
} from "@/lib/metaPixel";

/** Monta /api/jobs com event_id + fbp/fbc para CAPI + Pixel (Search). */
export function demoJobsUrl(role: string): { url: string; eventId: string } {
  const eventId = searchEventId(role);
  if (typeof window !== "undefined") {
    captureAttributionFromUrl(new URLSearchParams(window.location.search));
  }
  const fbclid = loadAttribution()?.fbclid;
  const ids = metaBrowserIds(fbclid);
  const params = new URLSearchParams({
    role,
    event_id: eventId,
  });
  if (ids.fbp) params.set("fbp", ids.fbp);
  if (ids.fbc) params.set("fbc", ids.fbc);
  if (fbclid) params.set("fbclid", fbclid);
  return { url: `/api/jobs?${params}`, eventId };
}

export function trackSearchFromJobsPayload(
  role: string,
  data: { eventId?: string } | null | undefined,
  fallbackEventId: string
): void {
  trackJobSearch(role, data?.eventId || fallbackEventId);
}
