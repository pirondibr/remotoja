"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { loadAttribution } from "@/lib/attribution";
import {
  metaBrowserIds,
  purchaseEventId,
  trackMetaEvent,
} from "@/lib/metaPixel";

/**
 * Pix: MP redireciona para pending antes de creditar.
 * Faz polling do confirm até aprovar (ou timeout).
 */
export function CheckoutPendingClient() {
  const router = useRouter();
  const params = useSearchParams();
  const [message, setMessage] = useState(
    "Se você pagou com Pix, a liberação costuma ser quase instantânea. Estamos confirmando…"
  );

  useEffect(() => {
    const paymentId =
      params.get("payment_id") || params.get("collection_id") || "";
    const externalReference = params.get("external_reference") || "";

    if (!paymentId) {
      setMessage(
        "Não encontramos o ID do pagamento na URL. Se o Pix já caiu, abra o e-mail do Mercado Pago ou tente de novo pelo funil."
      );
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 40; // ~2 min com interval 3s

    async function tick() {
      if (cancelled) return;
      attempts += 1;
      try {
        const attr = loadAttribution();
        const ids = metaBrowserIds(attr?.fbclid);
        const res = await fetch("/api/checkout/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentId,
            externalReference,
            fbp: ids.fbp,
            fbc: ids.fbc,
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          role?: string;
          planId?: string;
          amountBrl?: number;
          paymentId?: string;
          eventId?: string;
          status?: string;
          error?: string;
        };

        if (res.ok && data.ok) {
          const pid = data.paymentId || paymentId;
          trackMetaEvent(
            "Purchase",
            {
              value: data.amountBrl,
              currency: "BRL",
              content_ids: data.planId ? [data.planId] : undefined,
              content_type: "product",
              num_items: 1,
            },
            data.eventId || purchaseEventId(pid)
          );
          const role = data.role || "SEO";
          if (!cancelled) {
            router.replace(`/app?role=${encodeURIComponent(role)}`);
          }
          return;
        }

        if (attempts >= maxAttempts) {
          if (!cancelled) {
            setMessage(
              "Ainda não confirmamos o Pix. Se o banco já debitou, aguarde 1–2 minutos e recarregue esta página — ou fale com o suporte com o ID do pagamento."
            );
          }
          return;
        }

        if (!cancelled) {
          setMessage(
            `Aguardando confirmação do Pix… (tentativa ${attempts}/${maxAttempts})`
          );
          window.setTimeout(() => void tick(), 3000);
        }
      } catch {
        if (attempts >= maxAttempts) {
          if (!cancelled) {
            setMessage(
              "Falha de rede ao confirmar. Recarregue a página em alguns segundos."
            );
          }
          return;
        }
        if (!cancelled) {
          window.setTimeout(() => void tick(), 3000);
        }
      }
    }

    void tick();
    return () => {
      cancelled = true;
    };
  }, [params, router]);

  return (
    <div className="bg-mesh relative flex min-h-screen flex-col items-center justify-center px-6 text-cream">
      <div className="bg-grain pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
        <BrandMark light size="sm" />
        <h1 className="mt-6 font-[family-name:var(--font-display)] text-2xl font-bold">
          Aguardando pagamento
        </h1>
        <p className="mt-3 text-sm text-sand/70">{message}</p>
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
