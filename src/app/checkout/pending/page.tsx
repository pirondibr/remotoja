import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutPendingClient } from "@/components/CheckoutPendingClient";

export const metadata: Metadata = {
  title: "Pagamento pendente · Minha Vaga Remota",
  robots: { index: false, follow: false },
};

export default function CheckoutPendingPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-mesh flex min-h-screen items-center justify-center text-cream">
          Confirmando pagamento…
        </div>
      }
    >
      <CheckoutPendingClient />
    </Suspense>
  );
}
