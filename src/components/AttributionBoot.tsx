"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { captureAttributionFromUrl } from "@/lib/attribution";
import { persistMetaClickIds } from "@/lib/metaPixel";

/** Captura UTMs em qualquer página (Meta Ads → / → onboard → final). */
export function AttributionBoot() {
  const searchParams = useSearchParams();
  useEffect(() => {
    const attr = captureAttributionFromUrl(searchParams);
    persistMetaClickIds(attr.fbclid);
  }, [searchParams]);
  return null;
}
