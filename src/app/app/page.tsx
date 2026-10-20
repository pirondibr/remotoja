import type { Metadata } from "next";
import { Suspense } from "react";
import { getMemberSession } from "@/lib/access";
import { JobsDashboard } from "@/components/JobsDashboard";

export const metadata: Metadata = {
  title: "Meu feed · Minha Vaga Remota",
  description: "Portal de membros com vagas remotas encontradas para o seu perfil.",
  robots: { index: false, follow: false },
};

export default async function MemberAppPage() {
  const member = await getMemberSession();
  const defaultRole = (member?.role || "").trim();
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-cream text-ink">
          Carregando seu feed…
        </div>
      }
    >
      <JobsDashboard defaultRole={defaultRole} />
    </Suspense>
  );
}
