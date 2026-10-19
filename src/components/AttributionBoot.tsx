"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { captureAttributionFromUrl } from "@/lib/attribution";
import { ensureFbcFromFbclid } from "@/lib/metaPixel";

/** Captura UTMs em qualquer página (Meta Ads → / → onboard → final). */
export function AttributionBoot() {
  const searchParams = useSearchParams();
  useEffect(() => {
    const attr = captureAttributionFromUrl(searchParams);
    // Garante _fbc a partir do fbclid (melhora match da CAPI)
    const fbc = ensureFbcFromFbclid(attr.fbclid);
    if (fbc && typeof document !== "undefined" && !document.cookie.includes("_fbc=")) {
      const maxAge = 90 * 24 * 60 * 60;
      document.cookie = `_fbc=${encodeURIComponent(fbc)}; path=/; max-age=${maxAge}; SameSite=Lax`;
    }
  }, [searchParams]);
  return null;
}
