"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { captureAttributionFromUrl } from "@/lib/attribution";

/** Captura UTMs em qualquer página (Meta Ads → / → onboard → final). */
export function AttributionBoot() {
  const searchParams = useSearchParams();
  useEffect(() => {
    captureAttributionFromUrl(searchParams);
  }, [searchParams]);
  return null;
}
