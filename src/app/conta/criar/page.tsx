import type { Metadata } from "next";
import { Suspense } from "react";
import { CreateAccountForm } from "@/components/CreateAccountForm";

export const metadata: Metadata = {
  title: "Criar acesso · Minha Vaga Remota",
  robots: { index: false, follow: false },
};

export default function CreateAccountPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-ink text-cream">
          Carregando…
        </div>
      }
    >
      <CreateAccountForm />
    </Suspense>
  );
}
