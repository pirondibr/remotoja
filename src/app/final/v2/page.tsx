import type { Metadata } from "next";
import { Suspense } from "react";
import { FinalV2 } from "@/components/FinalV2";

export const metadata: Metadata = {
  title: "Busca v2 · Minha Vaga Remota (teste RR)",
  description:
    "Atalho de teste no modelo Remote Rocketship: resultados com urgência + paywall.",
  robots: { index: false, follow: false },
};

export default function FinalV2Page() {
  return (
    <Suspense
      fallback={
        <div className="bg-mesh flex min-h-screen items-center justify-center text-cream">
          Carregando v2…
        </div>
      }
    >
      <FinalV2 />
    </Suspense>
  );
}
