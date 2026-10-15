"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

export function CheckoutSuccessClient() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const paymentId =
      params.get("payment_id") || params.get("collection_id") || "";
    const status = params.get("status") || params.get("collection_status") || "";
    const externalReference = params.get("external_reference") || "";

    if (!paymentId) {
      setError("Não encontramos o ID do pagamento. Se você pagou, aguarde alguns segundos e tente de novo.");
      return;
    }

    if (status && status !== "approved") {
      setError(`Pagamento com status "${status}". Se usou Pix, aguarde a confirmação.`);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/checkout/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentId, externalReference, status }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          role?: string;
          error?: string;
        };
        if (!res.ok || !data.ok) {
          if (!cancelled) setError(data.error || "Não foi possível liberar o acesso.");
          return;
        }
        const role = data.role || "SEO";
        if (!cancelled) {
          router.replace(`/app?role=${encodeURIComponent(role)}`);
        }
      } catch {
        if (!cancelled) setError("Falha de rede ao confirmar o pagamento.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params, router]);

  return (
    <div className="bg-mesh relative flex min-h-screen flex-col items-center justify-center px-6 text-cream">
      <div className="bg-grain pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
        <BrandMark light size="sm" />
        {error ? (
          <>
            <h1 className="mt-6 font-[family-name:var(--font-display)] text-2xl font-bold">
              Quase lá
            </h1>
            <p className="mt-3 text-sm text-sand/70">{error}</p>
            <Link
              href="/onboard"
              className="mt-6 inline-flex rounded-full bg-lime px-5 py-3 text-sm font-bold text-ink"
            >
              Voltar ao funil
            </Link>
          </>
        ) : (
          <>
            <h1 className="mt-6 font-[family-name:var(--font-display)] text-2xl font-bold">
              Pagamento confirmado
            </h1>
            <p className="mt-3 text-sm text-sand/70">
              Liberando seu feed de vagas…
            </p>
          </>
        )}
      </div>
    </div>
  );
}
