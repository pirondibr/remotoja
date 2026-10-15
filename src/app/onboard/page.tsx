import type { Metadata } from "next";
import { Suspense } from "react";
import { OnboardWizard } from "@/components/OnboardWizard";

export const metadata: Metadata = {
  title: "Montar meu feed · RemotoJá",
  description:
    "Responda algumas perguntas e veja vagas remotas no Brasil alinhadas ao seu perfil.",
};

export default function OnboardPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-mesh flex min-h-screen items-center justify-center text-cream">
          Carregando…
        </div>
      }
    >
      <OnboardWizard />
    </Suspense>
  );
}
