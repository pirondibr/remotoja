import { Suspense } from "react";

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
      {children}
    </Suspense>
  );
}
