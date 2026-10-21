"use client";

import { useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { startCheckout } from "@/lib/startCheckout";
import { TEST_PLAN } from "@/lib/rrPlans";

export function TesteCheckout() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startTest() {
    setError(null);
    setLoading(true);
    try {
      const result = await startCheckout({
        planId: TEST_PLAN.id,
        role: "TESTE PIX",
        email: email.trim() || undefined,
        checkoutUi: "brick",
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      window.location.href = result.checkoutUrl;
    } catch {
      setError("Não foi possível abrir o Pix de teste.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="bg-mesh relative min-h-screen px-6 py-12 text-cream">
      <div className="bg-grain pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative mx-auto w-full max-w-md">
        <BrandMark light size="sm" />
        <p className="mt-6 text-xs font-bold tracking-[0.16em] text-lime uppercase">
          Página de teste
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold">
          Checkout Pix de R$ 5
        </h1>
        <p className="mt-3 text-sm text-sand/70">
          Só Pix, no site. Serve para você testar o QR e o pagamento. Não
          aparece no funil nem nos anúncios.
        </p>

        <div className="mt-8 rounded-3xl border border-lime/40 bg-white/5 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold">{TEST_PLAN.name}</p>
              <p className="mt-1 text-sm text-sand/70">{TEST_PLAN.billed}</p>
            </div>
            <p className="font-[family-name:var(--font-display)] text-3xl font-bold">
              {TEST_PLAN.perMonth}
            </p>
          </div>
          <span className="mt-4 inline-flex rounded-full border border-lime/40 px-3 py-1 text-xs font-semibold text-lime">
            Pague pelo Pix
          </span>
        </div>

        <label className="mt-6 block text-sm text-sand/70">
          E-mail (opcional, o Mercado Pago pede no Pix)
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@email.com"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-cream outline-none placeholder:text-sand/35 focus:border-lime"
          />
        </label>

        {error && <p className="mt-4 text-sm text-red-300">{error}</p>}

        <button
          type="button"
          disabled={loading}
          onClick={() => void startTest()}
          className="mt-6 w-full rounded-full bg-lime py-4 text-base font-bold text-ink hover:bg-mint disabled:opacity-50"
        >
          {loading ? "Abrindo Pix…" : "Gerar Pix de R$ 5"}
        </button>
      </div>
    </main>
  );
}
