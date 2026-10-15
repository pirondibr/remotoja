import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { BrandMark } from "@/components/BrandMark";
import { HomeSearch } from "@/components/HomeSearch";
import { RR_PLANS } from "@/lib/rrPlans";
import { getDemoJobs } from "@/lib/demoJobs";

const SOURCES = [
  "Gupy",
  "LinkedIn",
  "Indeed",
  "Catho",
  "InfoJobs",
  "Remotar",
  "Programathor",
];

const previewJobs = getDemoJobs(3);

const BEFORE = [
  "Abrir Gupy, Catho, InfoJobs e LinkedIn, um por um",
  "Filtrar “remoto” e cair em vaga híbrida disfarçada",
  "Ver a mesma vaga repetida em três sites",
  "Chegar quando a vaga já tem centenas de candidatos",
];

const AFTER = [
  "Uma busca cobre todos os portais de uma vez",
  "Só vagas 100% remotas no seu feed",
  "Vagas duplicadas removidas automaticamente",
  "Selo “Fora do LinkedIn” para achar vagas com menos concorrência",
];

const STEPS = [
  {
    n: "1",
    t: "Diga seu cargo",
    d: "Digite o que você faz. Não precisa de cadastro nem cartão.",
  },
  {
    n: "2",
    t: "Veja vagas reais na hora",
    d: "Mostramos uma prévia com vagas remotas abertas agora para o seu cargo.",
  },
  {
    n: "3",
    t: "Libere o feed completo",
    d: "Assine para ver todas as vagas de todos os portais, em um só lugar.",
  },
];

const FAQ = [
  {
    q: "De onde vêm as vagas?",
    a: `Buscamos em ${SOURCES.join(", ")}. Juntamos tudo, removemos duplicadas e mostramos só as remotas.`,
  },
  {
    q: "As vagas são mesmo 100% remotas?",
    a: "Usamos o filtro de remoto/home office de cada portal e descartamos as marcadas como híbridas ou presenciais. Se algum portal classificar errado, a vaga pode escapar. O link sempre leva à página original da empresa.",
  },
  {
    q: "Preciso pagar para testar?",
    a: "Não. Você vê uma prévia grátis com vagas reais para o seu cargo. Só paga se quiser liberar o feed completo.",
  },
  {
    q: "Com que frequência as vagas são atualizadas?",
    a: "Atualizamos as vagas diariamente.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Sim. Sem fidelidade e sem multa.",
  },
];

function isOffLinkedIn(source: string) {
  return !source.toLowerCase().includes("linkedin");
}

export default function HomeV2() {
  return (
    <main className="flex flex-col pb-20 md:pb-0">
      {/* HERO */}
      <section className="bg-mesh relative overflow-hidden text-cream">
        <div className="bg-grain pointer-events-none absolute inset-0 opacity-50" />
        <div className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-mint/20 blur-3xl animate-floaty" />

        <SiteHeader dark />

        <div className="relative z-10 mx-auto grid max-w-6xl gap-12 px-5 pt-8 pb-20 md:px-10 md:pt-14 md:pb-28 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <p className="animate-rise inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-mint">
              <span className="h-1.5 w-1.5 rounded-full bg-mint" />
              {SOURCES.length} portais · 1 busca · só vagas remotas
            </p>
            <h1 className="animate-rise-delay-1 mt-5 font-[family-name:var(--font-display)] text-4xl leading-[1.05] font-extrabold tracking-tight md:text-6xl">
              Pare de abrir 15 abas
              <span className="block text-lime">pra achar vaga remota.</span>
            </h1>
            <p className="animate-rise-delay-2 mt-5 max-w-xl text-lg text-sand/80">
              O RemotoJá busca no Gupy, Catho, InfoJobs, Indeed, LinkedIn e mais,
              e mostra só as vagas 100% remotas para o seu cargo. Muitas nem
              aparecem no LinkedIn.
            </p>

            <div className="animate-rise-delay-2 mt-8 max-w-xl">
              <HomeSearch id="busca" />
              <p className="mt-4 text-xs text-sand/55">
                Começa pelo funil · grátis para testar · sem cartão
              </p>
            </div>
          </div>

          {/* Feed preview */}
          <div className="hidden lg:block">
            <div className="animate-floaty rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
              <div className="mb-4 flex items-center justify-between text-xs text-sand/60">
                <span>Seu feed · Analista de SEO</span>
                <span className="text-mint">● atualizado hoje</span>
              </div>
              {previewJobs.map((job) => (
                <div
                  key={`${job.company}-${job.title}`}
                  className="mb-2 rounded-xl border border-white/10 bg-ink/40 px-3 py-3 last:mb-0"
                >
                  <p className="line-clamp-1 text-sm font-semibold text-cream">
                    {job.title}
                  </p>
                  <p className="mt-0.5 text-xs text-sand/60">{job.company}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-sand/80">
                      100% remoto
                    </span>
                    {isOffLinkedIn(job.source) && (
                      <span className="rounded-full bg-lime/20 px-2 py-0.5 text-[10px] font-semibold text-lime">
                        Fora do LinkedIn
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SOURCES STRIP */}
      <section className="border-b border-moss/10 bg-cream px-5 py-6 md:px-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 md:flex-row md:items-center md:gap-8">
          <p className="shrink-0 text-xs font-semibold tracking-[0.15em] text-moss/50 uppercase">
            Buscamos em
          </p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {SOURCES.map((source) => (
              <li
                key={source}
                className="font-[family-name:var(--font-display)] text-base font-bold text-moss/60"
              >
                {source}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* BEFORE / AFTER */}
      <section className="bg-cream px-5 py-20 md:px-10 md:py-28">
        <div className="mx-auto max-w-5xl">
          <h2 className="max-w-2xl font-[family-name:var(--font-display)] text-3xl font-bold text-ink md:text-5xl">
            Procurar vaga remota não precisa ser um segundo emprego.
          </h2>
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <div className="rounded-3xl border border-moss/10 bg-white p-7">
              <p className="text-sm font-bold text-moss/50">Hoje</p>
              <ul className="mt-4 space-y-3">
                {BEFORE.map((item) => (
                  <li key={item} className="flex gap-3 text-moss/80">
                    <span aria-hidden className="mt-0.5 text-moss/30">
                      ✕
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl bg-forest p-7 text-cream">
              <p className="text-sm font-bold text-lime">Com o RemotoJá</p>
              <ul className="mt-4 space-y-3">
                {AFTER.map((item) => (
                  <li key={item} className="flex gap-3 text-sand/90">
                    <span aria-hidden className="mt-0.5 text-lime">
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-y border-moss/10 bg-sand px-5 py-20 md:px-10 md:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold text-ink md:text-4xl">
            Do cargo às vagas em menos de um minuto
          </h2>
          <ol className="mt-12 grid gap-8 md:grid-cols-3">
            {STEPS.map((step) => (
              <li key={step.n} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink font-[family-name:var(--font-display)] text-lg font-bold text-lime">
                  {step.n}
                </span>
                <div>
                  <h3 className="text-lg font-bold text-ink">{step.t}</h3>
                  <p className="mt-1 text-moss/75">{step.d}</p>
                </div>
              </li>
            ))}
          </ol>
          <Link
            href="/onboard"
            className="mt-12 inline-flex rounded-full bg-ink px-7 py-3.5 text-base font-bold text-cream transition hover:bg-forest"
          >
            Montar meu feed
          </Link>
        </div>
      </section>

      {/* PRICING */}
      <section className="bg-cream px-5 py-20 md:px-10 md:py-28">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold text-ink md:text-5xl">
            Um plano, todos os portais.
          </h2>
          <p className="mt-3 text-lg text-moss/80">
            Teste grátis com seu cargo. Assine só se as vagas fizerem sentido.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {RR_PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`flex flex-col rounded-3xl border p-6 ${
                  plan.popular
                    ? "border-moss bg-forest text-cream"
                    : "border-moss/15 bg-white text-ink"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{plan.name}</p>
                  {plan.badge && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        plan.popular ? "bg-lime text-ink" : "bg-sand text-moss"
                      }`}
                    >
                      {plan.badge}
                    </span>
                  )}
                </div>
                <p className="mt-5 font-[family-name:var(--font-display)] text-4xl font-bold">
                  {plan.perMonth}
                  <span className="text-base font-medium opacity-60">/mês</span>
                </p>
                <p
                  className={`mt-2 text-sm ${plan.popular ? "text-sand/70" : "text-moss/65"}`}
                >
                  {plan.billed ? `${plan.billed} cobrados de uma vez` : "Cobrado todo mês"}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-moss/10 bg-sand px-5 py-20 md:px-10 md:py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold text-ink md:text-4xl">
            Perguntas frequentes
          </h2>
          <div className="mt-8 divide-y divide-moss/10 rounded-3xl border border-moss/10 bg-white">
            {FAQ.map((item) => (
              <details key={item.q} className="group px-6 py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink">
                  {item.q}
                  <span
                    aria-hidden
                    className="text-xl text-moss/40 transition group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-moss/75">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="bg-mesh relative px-5 py-24 text-cream md:px-10">
        <div className="bg-grain pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative mx-auto max-w-2xl text-center">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold md:text-5xl">
            Veja agora quantas vagas remotas existem para você.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sand/75">
            Responda algumas perguntas e veja vagas remotas para o seu perfil.
          </p>
          <div className="mt-8 text-left">
            <HomeSearch id="busca-final" />
          </div>
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

      {/* Mobile sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink/95 p-3 backdrop-blur md:hidden">
        <Link
          href="/onboard"
          className="flex w-full items-center justify-center rounded-full bg-lime px-6 py-3.5 text-base font-bold text-ink"
        >
          Montar meu feed
        </Link>
      </div>
    </main>
  );
}
