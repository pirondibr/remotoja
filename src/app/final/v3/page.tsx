import type { Metadata } from "next";
import { Suspense } from "react";
import { FinalV3 } from "@/components/FinalV3";

export const metadata: Metadata = {
  title: "Busca v3 · Minha Vaga Remota",
  description: "Pré-checkout com lista das demais vagas bloqueadas.",
  robots: { index: false, follow: false },
};

export default function FinalV3Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#06140f] text-[#eef6f1]">
          Carregando v3…
        </div>
      }
    >
      <FinalV3 />
    </Suspense>
  );
}
