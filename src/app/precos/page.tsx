import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { BrandMark } from "@/components/BrandMark";
import { RR_PLANS } from "@/lib/rrPlans";

export const metadata: Metadata = {
  title: "Preços · Minha Vaga Remota",
  description:
    "Acesso às vagas remotas por R$ 29,90. Pagamento único, cartão ou Pix.",
};

const features = [
  "Feed completo de vagas remotas agregadas",
  "Filtro de fontes fora do LinkedIn",
  "Alertas por e-mail (diário ou horário)",
  "Senioridade, salário e tipo de contrato",
  "Sinais de vaga fantasma (quando disponíveis)",
  "Você se candidata no site da empresa",
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-cream">
      <div className="bg-mesh text-cream">
        <SiteHeader dark />
        <div className="mx-auto max-w-4xl px-5 pt-10 pb-16 md:px-10">
          <BrandMark light size="lg" />
          <h1 className="mt-6 font-[family-name:var(--font-display)] text-4xl font-extrabold md:text-6xl">
            Preço simples.
            <span className="block text-lime">Valor no timing.</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg text-sand/75">
            Pagamento único. Cartão ou Pix. O mesmo feed completo de vagas
            remotas.
          </p>
        </div>
      </div>

      <section className="mx-auto max-w-5xl px-5 py-16 md:px-10">
        <div className="grid gap-4 md:max-w-md">
          {RR_PLANS.map((plan) => (
            <div
              key={plan.id}
              className="flex flex-col rounded-3xl border border-moss bg-forest p-6 text-cream"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">{plan.name}</h2>
                <span className="rounded-full bg-lime px-2 py-0.5 text-[10px] font-bold text-ink uppercase">
                  {plan.badge}
                </span>
              </div>
              <p className="mt-4 font-[family-name:var(--font-display)] text-4xl font-bold">
                {plan.perMonth}
              </p>
              <p className="mt-2 text-sm text-sand/70">{plan.billed}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {plan.payOptions.map((option) => (
                  <span
                    key={option}
                    className="rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-lime"
                  >
                    {option}
                  </span>
                ))}
              </div>
              <Link
                href="/onboard"
                className="mt-6 inline-flex justify-center rounded-full bg-lime py-3 text-sm font-bold text-ink transition hover:bg-mint"
              >
                Começar
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-16 max-w-2xl">
          <h3 className="font-[family-name:var(--font-display)] text-2xl font-bold text-ink">
            O que está incluso
          </h3>
          <ul className="mt-6 space-y-3">
            {features.map((feature) => (
              <li key={feature} className="flex gap-3 text-moss/85">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-lime" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-16 rounded-3xl bg-sand p-8 md:p-10">
          <h3 className="font-[family-name:var(--font-display)] text-2xl font-bold text-ink">
            Por que é pago?
          </h3>
          <p className="mt-3 max-w-2xl text-moss/80">
            Boards gratuitos vivem de empresas que pagam para publicar. Nós
            viramos isso: scrapers e agregação custam infra — e o produto é
            feito para quem busca vaga, não para quem anuncia.
          </p>
          <Link
            href="/onboard"
            className="mt-6 inline-flex rounded-full bg-ink px-6 py-3 text-sm font-bold text-cream"
          >
            Ver matches antes de pagar
          </Link>
        </div>
      </section>
    </main>
  );
}
