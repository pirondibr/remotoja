import type { Metadata } from "next";
import { Suspense } from "react";
import { QuickJobSearch } from "@/components/QuickJobSearch";

export const metadata: Metadata = {
  title: "Busca rápida · RemotoJá (teste)",
  description:
    "Atalho de teste: pesquise vagas no Google Jobs sem passar pelo questionário.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function FinalPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-mesh flex min-h-screen items-center justify-center text-cream">
          Carregando busca…
        </div>
      }
    >
      <QuickJobSearch />
    </Suspense>
  );
}
