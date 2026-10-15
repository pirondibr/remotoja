import { Suspense } from "react";
import type { Metadata } from "next";
import { CheckoutSuccessClient } from "@/components/CheckoutSuccessClient";

export const metadata: Metadata = {
  title: "Pagamento confirmado · RemotoJá",
  robots: { index: false, follow: false },
};

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-cream text-ink">
          Confirmando pagamento…
        </div>
      }
    >
      <CheckoutSuccessClient />
    </Suspense>
  );
}
