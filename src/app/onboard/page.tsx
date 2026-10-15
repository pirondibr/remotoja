import type { Metadata } from "next";
import { OnboardWizard } from "@/components/OnboardWizard";

export const metadata: Metadata = {
  title: "Montar meu feed · RemotoJá",
  description:
    "Responda algumas perguntas e veja vagas remotas no Brasil alinhadas ao seu perfil.",
};

export default function OnboardPage() {
  return <OnboardWizard />;
}
