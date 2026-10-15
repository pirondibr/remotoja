import { Suspense } from "react";
import { redirect } from "next/navigation";
import { hasMemberAccess } from "@/lib/access";

async function MemberGate({ children }: { children: React.ReactNode }) {
  const ok = await hasMemberAccess();
  if (!ok) {
    redirect("/onboard");
  }
  return children;
}

export default function MemberAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-cream text-ink">
          Carregando seu feed…
        </div>
      }
    >
      <MemberGate>{children}</MemberGate>
    </Suspense>
  );
}
