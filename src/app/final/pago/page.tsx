import type { Metadata } from "next";
import { Suspense } from "react";
import { JobsDashboard } from "@/components/JobsDashboard";

export const metadata: Metadata = {
  title: "Feed pago · teste",
  robots: { index: false, follow: false },
};

export default function FinalPagoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-cream text-ink">
          Abrindo o feed pago…
        </div>
      }
    >
      <JobsDashboard openPreview />
    </Suspense>
  );
}
