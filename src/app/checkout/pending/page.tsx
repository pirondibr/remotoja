import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

export const metadata: Metadata = {
  title: "Pagamento pendente · RemotoJá",
  robots: { index: false, follow: false },
};

export default function CheckoutPendingPage() {
  return (
    <div className="bg-mesh relative flex min-h-screen flex-col items-center justify-center px-6 text-cream">
      <div className="bg-grain pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
        <BrandMark light size="sm" />
        <h1 className="mt-6 font-[family-name:var(--font-display)] text-2xl font-bold">
          Aguardando pagamento
        </h1>
        <p className="mt-3 text-sm text-sand/70">
          Se você pagou com Pix, a liberação costuma ser quase instantânea.
          Assim que confirmar, seu feed abre automaticamente.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-full bg-lime px-5 py-3 text-sm font-bold text-ink"
        >
          Ir para o início
        </Link>
      </div>
    </div>
  );
}
