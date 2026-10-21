"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Script from "next/script";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { loadAttribution } from "@/lib/attribution";
import { firePurchasePixel, metaBrowserIds } from "@/lib/metaPixel";
import { formatBrl, isTestPlan } from "@/lib/rrPlans";

type PixData = {
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string;
};

type Session = {
  orderId: string;
  paymentId?: string | null;
  status: string;
  role: string;
  planId: string;
  planName: string;
  amountBrl: number;
  email: string;
  preferenceId: string | null;
  publicKey: string;
  hasPublicKey: boolean;
  proUrl: string;
  pix?: PixData | null;
  pixOnly?: boolean;
};

type BrickController = { unmount?: () => void };

type MpBricks = {
  create: (
    name: string,
    containerId: string,
    settings: Record<string, unknown>
  ) => Promise<BrickController>;
};

declare global {
  interface Window {
    MercadoPago?: new (
      key: string,
      opts?: { locale?: string }
    ) => { bricks: () => MpBricks };
  }
}

export function CheckoutBrickClient() {
  const router = useRouter();
  const params = useSearchParams();
  const orderId = params.get("order") || "";
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [pendingHint, setPendingHint] = useState<string | null>(null);
  const [pix, setPix] = useState<PixData | null>(null);
  const [copied, setCopied] = useState(false);
  const paymentRef = useRef<BrickController | null>(null);
  const statusRef = useRef<BrickController | null>(null);

  useEffect(() => {
    if (!orderId) {
      setError("Pedido não encontrado. Volte e escolha o plano de novo.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/checkout/session?order=${encodeURIComponent(orderId)}`);
        const data = (await res.json()) as Session & { error?: string };
        if (!res.ok) {
          if (!cancelled) setError(data.error || "Não achamos esse pedido.");
          return;
        }
        if (data.status === "approved" && data.paymentId) {
          router.replace(
            `/checkout/success?payment_id=${encodeURIComponent(data.paymentId)}&external_reference=${encodeURIComponent(data.orderId)}&status=approved`
          );
          return;
        }
        if (!cancelled) {
          setSession(data);
          if (data.pix) {
            setPix(data.pix);
            setPendingHint("Pague o Pix nesta página. Assim que cair, liberamos o feed.");
          }
        }
      } catch {
        if (!cancelled) setError("Falha ao carregar o checkout.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, router]);

  useEffect(() => {
    if (window.MercadoPago) setSdkReady(true);
  }, []);

  useEffect(() => {
    if (!session?.hasPublicKey || !session.publicKey || !sdkReady) return;
    if (!window.MercadoPago) return;
    let cancelled = false;

    (async () => {
      const mp = new window.MercadoPago!(session.publicKey, { locale: "pt-BR" });
      const bricks = mp.bricks();

      async function showStatusScreen(paymentId: string) {
        statusRef.current?.unmount?.();
        statusRef.current = await bricks.create(
          "statusScreen",
          "statusBrick_container",
          {
            initialization: { paymentId: String(paymentId) },
          }
        );
      }

      try {
        if (session.pix || session.paymentId) {
          if (session.paymentId) {
            try {
              await showStatusScreen(session.paymentId);
            } catch {
              /* o QR nosso já cobre o Pix */
            }
            void pollApproval(String(session.paymentId), session);
          }
          if (!cancelled) setReady(true);
          return;
        }

        paymentRef.current?.unmount?.();
        paymentRef.current = await bricks.create(
          "payment",
          "paymentBrick_container",
          {
            initialization: {
              amount: session.amountBrl,
              ...(session.email ? { payer: { email: session.email } } : {}),
            },
            customization: {
              visual: { style: { theme: "dark" } },
              paymentMethods: session.pixOnly
                ? { bankTransfer: ["pix"] }
                : {
                    bankTransfer: ["pix"],
                    creditCard: "all",
                    maxInstallments: 12,
                  },
            },
            callbacks: {
              onReady: () => {
                if (!cancelled) setReady(true);
              },
              onError: (err: { message?: string }) => {
                if (!cancelled) {
                  setError(err?.message || "Erro no formulário de pagamento.");
                }
              },
              onSubmit: ({
                formData,
              }: {
                formData: Record<string, unknown>;
              }) =>
                fetch("/api/checkout/payment", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ orderId: session.orderId, formData }),
                }).then(async (res) => {
                  const data = (await res.json()) as {
                    ok?: boolean;
                    id?: number | string;
                    status?: string;
                    error?: string;
                    pix?: PixData | null;
                  };
                  if (!res.ok || !data.ok || !data.id) {
                    throw new Error(data.error || "Não foi possível pagar.");
                  }
                  if (data.status === "approved") {
                    router.replace(
                      `/checkout/success?payment_id=${encodeURIComponent(String(data.id))}&external_reference=${encodeURIComponent(session.orderId)}&status=approved`
                    );
                    return;
                  }
                  if (data.pix) setPix(data.pix);
                  paymentRef.current?.unmount?.();
                  setPendingHint(
                    "Pague o Pix nesta página. O QR e o código aparecem abaixo — não vai para o e-mail."
                  );
                  try {
                    await showStatusScreen(String(data.id));
                  } catch {
                    /* o QR nosso já cobre o Pix */
                  }
                  void pollApproval(String(data.id), session);
                }),
            },
          }
        );
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Não foi possível abrir o Payment Brick."
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      paymentRef.current?.unmount?.();
      statusRef.current?.unmount?.();
    };
  }, [session, sdkReady, router]);

  async function pollApproval(paymentId: string, current: Session) {
    const attr = loadAttribution();
    const ids = metaBrowserIds(attr?.fbclid);
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      try {
        const res = await fetch("/api/checkout/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentId,
            externalReference: current.orderId,
            fbp: ids.fbp,
            fbc: ids.fbc,
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          role?: string;
          hasAccount?: boolean;
        };
        if (res.ok && data.ok) {
          if (!isTestPlan(current.planId)) {
            await firePurchasePixel({
              orderId: current.orderId,
              paymentId,
              value: current.amountBrl,
              planId: current.planId,
            });
          }
          const role = data.role || current.role;
          router.replace(
            data.hasAccount
              ? `/app?role=${encodeURIComponent(role)}`
              : `/conta/criar?role=${encodeURIComponent(role)}`
          );
          return;
        }
      } catch {
        /* tenta de novo */
      }
    }
  }

  async function copyPix() {
    if (!pix?.qrCode) return;
    try {
      await navigator.clipboard.writeText(pix.qrCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const showPix = Boolean(pix?.qrCode || pix?.qrCodeBase64);

  return (
    <div className="bg-mesh relative min-h-screen px-6 py-10 text-cream">
      <Script
        src="https://sdk.mercadopago.com/js/v2"
        strategy="afterInteractive"
        onLoad={() => setSdkReady(true)}
      />
      <div className="bg-grain pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative mx-auto w-full max-w-xl">
        <BrandMark light size="sm" />
        {session && (
          <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
            {session.planName} · {formatBrl(session.amountBrl)} · {session.role}
          </p>
        )}
        {error && (
          <p className="mt-4 text-sm text-red-300">{error}</p>
        )}
        {!session?.hasPublicKey && session && (
          <div className="mt-4 rounded-2xl border border-amber-300/40 bg-amber-50/10 p-4 text-sm text-sand/80">
            Falta a chave pública do Mercado Pago para o Brick. Enquanto isso,
            use o checkout v1.
            {session.proUrl && (
              <a
                href={session.proUrl}
                className="mt-3 inline-flex rounded-full bg-lime px-4 py-2 text-sm font-bold text-ink"
              >
                Abrir checkout v1
              </a>
            )}
          </div>
        )}
        {pendingHint && (
          <p className="mt-4 text-sm text-sand/70">{pendingHint}</p>
        )}
        {showPix && (
          <div className="mt-6 rounded-3xl bg-white p-5 text-ink">
            <p className="text-sm font-semibold">Pague com Pix nesta página</p>
            <p className="mt-1 text-xs text-ink/60">
              Escaneie o QR ou copie o código. Não depende do e-mail.
            </p>
            {pix?.qrCodeBase64 && (
              <img
                src={`data:image/png;base64,${pix.qrCodeBase64}`}
                alt="QR Code Pix"
                className="mx-auto mt-4 h-56 w-56"
              />
            )}
            {pix?.qrCode && (
              <div className="mt-4">
                <textarea
                  readOnly
                  value={pix.qrCode}
                  className="h-24 w-full resize-none rounded-xl border border-ink/10 bg-cream/70 p-3 text-xs"
                />
                <button
                  type="button"
                  onClick={() => void copyPix()}
                  className="mt-3 inline-flex rounded-full bg-lime px-4 py-2 text-sm font-bold text-ink"
                >
                  {copied ? "Código copiado" : "Copiar código Pix"}
                </button>
              </div>
            )}
          </div>
        )}
        {!ready && session?.hasPublicKey && !error && !showPix && (
          <p className="mt-6 text-sm text-sand/60">Carregando pagamento…</p>
        )}
        <div
          id="paymentBrick_container"
          className={showPix ? "hidden" : "mt-6"}
        />
        <div id="statusBrick_container" className="mt-6" />
        <p className="mt-4 text-center text-xs text-sand/40">
          <Link href="/onboard" className="hover:text-sand/70">
            Voltar
          </Link>
        </p>
      </div>
    </div>
  );
}
