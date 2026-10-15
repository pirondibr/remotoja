import { Suspense } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { AdminDashboard } from "@/components/AdminDashboard";

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="border-b border-moss/10 bg-cream/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/">
            <BrandMark size="sm" />
          </Link>
          <span className="text-xs font-semibold text-moss/60">Painel interno</span>
        </div>
      </header>
      <Suspense
        fallback={
          <p className="px-4 py-16 text-center text-sm text-moss/60">Carregando…</p>
        }
      >
        <AdminDashboard />
      </Suspense>
    </div>
  );
}
