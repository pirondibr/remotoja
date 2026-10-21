import { Suspense } from "react";
import type { Metadata } from "next";
import { CheckoutBrickClient } from "@/components/CheckoutBrickClient";

export const metadata: Metadata = {
  title: "Checkout · Minha Vaga Remota",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-cream text-ink">
          Abrindo o pagamento…
        </div>
      }
    >
      <CheckoutBrickClient />
    </Suspense>
  );
}
