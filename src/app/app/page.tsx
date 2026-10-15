import type { Metadata } from "next";
import { Suspense } from "react";
import { JobsDashboard } from "@/components/JobsDashboard";

export const metadata: Metadata = {
  title: "Meu feed · Minha Vaga Remota",
  description: "Portal de membros com vagas remotas encontradas para o seu perfil.",
  robots: { index: false, follow: false },
};

export default function MemberAppPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-cream text-ink">
          Carregando seu feed…
        </div>
      }
    >
      <JobsDashboard />
    </Suspense>
  );
}
