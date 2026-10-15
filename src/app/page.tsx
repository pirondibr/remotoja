import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { BrandMark } from "@/components/BrandMark";
import { PLANS } from "@/lib/funnel";

const testimonials = [
  {
    name: "Camila",
    role: "Product Designer",
    quote:
      "Achei duas vagas que não estavam no LinkedIn na primeira semana. Uma virou entrevista em 4 dias.",
  },
  {
    name: "Rafael",
    role: "Dev Full Stack",
    quote:
      "O filtro de ‘fora do LinkedIn’ muda o jogo. Menos fila, mais resposta.",
  },
  {
    name: "Juliana",
    role: "Customer Success",
    quote:
      "Finalmente um lugar que agrega Gupy, carreiras e portais sem eu ficar abrindo 15 abas.",
  },
];

export default function Home() {
  return (
    <main className="flex flex-col">
      {/* HERO */}
      <section className="bg-mesh relative min-h-[100svh] overflow-hidden text-cream">
        <div className="bg-grain pointer-events-none absolute inset-0 opacity-50" />
        <div className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-mint/20 blur-3xl animate-floaty" />
        <div className="pointer-events-none absolute bottom-10 left-[-4rem] h-64 w-64 rounded-full bg-lime/10 blur-3xl" />

        <SiteHeader dark />

        <div className="relative z-10 mx-auto flex min-h-[calc(100svh-88px)] max-w-6xl flex-col justify-end px-5 pb-16 md:justify-center md:px-10 md:pb-24">
          <div className="max-w-3xl">
            <div className="animate-rise mb-6">
              <BrandMark light size="lg" />
            </div>
            <h1 className="animate-rise-delay-1 font-[family-name:var(--font-display)] text-4xl leading-[1.05] font-extrabold tracking-tight md:text-6xl lg:text-7xl">
              Vagas remotas no Brasil
              <span className="block text-lime">antes da multidão.</span>
            </h1>
            <p className="animate-rise-delay-2 mt-5 max-w-xl text-lg text-sand/80 md:text-xl">
              Agregamos portais, carreiras e ATS. Você aplica cedo — inclusive
              em vagas que nunca chegam ao LinkedIn.
            </p>
            <div className="animate-rise-delay-2 mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/onboard"
                className="relative inline-flex items-center justify-center rounded-full bg-lime px-7 py-3.5 text-base font-bold text-ink transition hover:bg-mint"
              >
                <span className="animate-pulse-ring absolute inset-0 rounded-full border border-lime/50" />
                Montar meu feed
              </Link>
              <Link
                href="/precos"
                className="inline-flex items-center justify-center rounded-full border border-white/20 px-7 py-3.5 text-base font-semibold text-cream transition hover:border-white/40"
              >
                Ver preços
              </Link>
            </div>
          </div>

          {/* Visual plane — job radar composition */}
          <div className="pointer-events-none absolute top-[18%] right-6 hidden w-[340px] lg:block xl:right-16 xl:w-[400px]">
            <div className="animate-floaty relative rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
              <div className="mb-4 flex items-center justify-between text-xs text-sand/60">
                <span>Radar ao vivo</span>
                <span className="text-mint">● escaneando</span>
              </div>
              {[
                { t: "CS Remoto · SaaS", s: "Gupy · há 18 min", hot: true },
                { t: "Designer Produto", s: "Carreira · há 41 min", hot: true },
                { t: "Eng. Software Pleno", s: "Portal · há 2h", hot: false },
              ].map((row) => (
                <div
                  key={row.t}
                  className="mb-2 rounded-xl border border-white/8 bg-ink/40 px-3 py-2.5 last:mb-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-cream">{row.t}</p>
                    {row.hot && (
                      <span className="text-[10px] font-semibold tracking-wide text-lime uppercase">
                        Novo
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-sand/55">{row.s}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-cream px-5 py-20 md:px-10 md:py-28">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold text-ink md:text-5xl">
            Como funciona
          </h2>
          <p className="mt-3 max-w-2xl text-lg text-moss/80">
            Três passos. Sem spam de recrutador. Sem empresa pagando para
            aparecer no topo.
          </p>
          <ol className="mt-12 grid gap-10 md:grid-cols-3">
            {[
              {
                n: "01",
                t: "Escaneamos fontes",
                d: "Portais BR, páginas de carreira e ATS — várias vezes ao dia.",
              },
              {
                n: "02",
                t: "Filtramos o ruído",
                d: "Remoto real, senioridade, faixa salarial e sinais de vaga fantasma.",
              },
              {
                n: "03",
                t: "Você aplica cedo",
                d: "Matches no feed e alertas — antes da vaga virar corrida no LinkedIn.",
              },
            ].map((item) => (
              <li key={item.n}>
                <p className="font-[family-name:var(--font-display)] text-sm font-bold tracking-[0.2em] text-moss/40">
                  {item.n}
                </p>
                <h3 className="mt-2 text-xl font-bold text-ink">{item.t}</h3>
                <p className="mt-2 text-moss/75">{item.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="border-y border-moss/10 bg-sand px-5 py-20 md:px-10 md:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold text-ink md:text-4xl">
            Feito para quem está em busca ativa
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {testimonials.map((item) => (
              <blockquote key={item.name} className="border-l-2 border-lime pl-4">
                <p className="text-ink/85">&ldquo;{item.quote}&rdquo;</p>
                <footer className="mt-3 text-sm text-moss/70">
                  <strong className="text-ink">{item.name}</strong> · {item.role}
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING TEASER */}
      <section className="bg-cream px-5 py-20 md:px-10 md:py-28">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold text-ink md:text-5xl">
            Um plano. Todos os recursos.
          </h2>
          <p className="mt-3 text-lg text-moss/80">
            Só muda o preço por mês. Sem compromisso.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`rounded-3xl border p-6 ${
                  plan.popular
                    ? "border-moss bg-forest text-cream"
                    : "border-moss/15 bg-white text-ink"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{plan.name}</p>
                  {plan.popular && (
                    <span className="rounded-full bg-lime px-2 py-0.5 text-[10px] font-bold text-ink uppercase">
                      Popular
                    </span>
                  )}
                </div>
                <p className="mt-4 font-[family-name:var(--font-display)] text-4xl font-bold">
                  {plan.priceLabel}
                  <span className="text-base font-medium opacity-60">
                    {plan.period}
                  </span>
                </p>
                <p
                  className={`mt-2 text-sm ${plan.popular ? "text-sand/70" : "text-moss/65"}`}
                >
                  {plan.detail}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <Link
              href="/onboard"
              className="inline-flex rounded-full bg-ink px-7 py-3.5 text-base font-bold text-cream transition hover:bg-forest"
            >
              Responder 2 minutos e ver matches
            </Link>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="bg-mesh relative px-5 py-24 text-cream md:px-10">
        <div className="bg-grain pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative mx-auto max-w-3xl text-center">
          <BrandMark light size="lg" />
          <h2 className="mt-6 font-[family-name:var(--font-display)] text-3xl font-bold md:text-5xl">
            Pare de competir com a fila do LinkedIn.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sand/75">
            Monte seu perfil, veja a prévia e libere o feed completo quando fizer
            sentido.
          </p>
          <Link
            href="/onboard"
            className="mt-8 inline-flex rounded-full bg-lime px-8 py-4 text-base font-bold text-ink transition hover:bg-mint"
          >
            Começar agora
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-ink px-5 py-8 text-sm text-sand/50 md:px-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <BrandMark light size="sm" />
          <p>© 2026 RemotoJá · Vagas remotas no Brasil</p>
          <Link href="/precos" className="hover:text-cream">
            Preços
          </Link>
        </div>
      </footer>
    </main>
  );
}
