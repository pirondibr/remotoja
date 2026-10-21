"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatDemoJobAgo, type DemoJob } from "@/lib/demoJobs";
import { RR_PLANS } from "@/lib/rrPlans";
import { BrandMark } from "./BrandMark";
import { CompanyAvatar } from "./CompanyAvatar";
import { PaywallExitSurvey, PaywallFeedbackBlock } from "./PaywallExitSurvey";

const PORTALS = 7;
const FREE_COUNT = 3;

function isOffLinkedIn(source: string) {
  return !source.toLowerCase().includes("linkedin");
}

function hoursAgo(job: DemoJob): number {
  const match = formatDemoJobAgo(job).match(/^(\d+)/);
  return match ? Number(match[1]) : 12;
}

function CheckIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#c6ef78"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="mt-0.5 shrink-0"
    >
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}

function LockGlyph() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#071511"
      strokeWidth="2.4"
      strokeLinecap="round"
      aria-hidden
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      aria-hidden
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function JobCard({
  job,
  free,
}: {
  job: Pick<DemoJob, "title" | "company" | "source" | "company_logo" | "source_url">;
  free?: boolean;
}) {
  const off = isOffLinkedIn(job.source || "");
  const url = (job.source_url || "").trim();
  return (
    <article className="mb-2.5 flex gap-3.5 rounded-[20px] border border-[#1d3a2e] bg-[#0d241b] p-4">
      <CompanyAvatar
        company={job.company || "Empresa"}
        logoUrl={job.company_logo}
        tone="dark"
      />
      <div className="min-w-0 flex-1">
        <h3 className="text-[16.5px] leading-snug font-bold text-[#eef6f1]">
          {job.title}
        </h3>
        <p className="mt-0.5 text-sm text-[#9db3a8]">{job.company}</p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {free && (
            <span className="rounded-full border border-[#c6ef78]/35 px-2 py-0.5 text-[11px] font-extrabold tracking-wide text-[#c6ef78]">
              GRÁTIS
            </span>
          )}
          {off && (
            <span className="rounded-full bg-[#c6ef78]/16 px-2.5 py-1 text-[12.5px] font-bold text-[#c6ef78]">
              Fora do LinkedIn
            </span>
          )}
          <span className="rounded-full bg-[#173328] px-2.5 py-1 text-[12.5px] text-[#cfe0d7]">
            {formatDemoJobAgo(job as DemoJob)}
          </span>
          <span className="rounded-full bg-[#173328] px-2.5 py-1 text-[12.5px] text-[#cfe0d7]">
            100% remoto
          </span>
        </div>
        {free && url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center justify-center gap-1.5 rounded-full bg-[#c6ef78] px-3.5 py-2 text-sm font-bold text-[#071511] no-underline"
          >
            Ver vaga e se candidatar →
          </a>
        )}
      </div>
    </article>
  );
}

export function FeedConvertV2({
  role,
  jobs,
  loading,
  error,
  onCheckout,
  checkoutLoading,
  checkoutError,
  email,
  leadId,
  funnelVariant,
}: {
  role: string;
  jobs: DemoJob[];
  loading: boolean;
  error: string | null;
  onCheckout: () => void;
  checkoutLoading: boolean;
  checkoutError: string | null;
  email?: string;
  leadId?: string | null;
  funnelVariant?: string | null;
}) {
  const lockedRef = useRef<HTMLDivElement>(null);
  const offerRef = useRef<HTMLElement>(null);
  const [stickyOn, setStickyOn] = useState(false);

  const freeJobs = jobs.slice(0, FREE_COUNT);
  const extraJobs = jobs.slice(FREE_COUNT, FREE_COUNT + 3);

  const stats = useMemo(() => {
    const totalVagas = Math.max(jobs.length * 2, 16);
    const lockedCount = Math.max(totalVagas - FREE_COUNT, 1);
    const offRatio = jobs.length
      ? jobs.filter((job) => isOffLinkedIn(job.source)).length / jobs.length
      : 0.55;
    const todayRatio = jobs.length
      ? jobs.filter((job) => hoursAgo(job) <= 8).length / jobs.length
      : 0.35;
    return {
      totalVagas,
      lockedCount,
      foraLinkedin: Math.max(1, Math.round(totalVagas * offRatio)),
      publicadasHoje: Math.max(1, Math.round(totalVagas * todayRatio)),
    };
  }, [jobs]);

  const lockedCards: DemoJob[] =
    extraJobs.length > 0
      ? extraJobs
      : [
          {
            title: `${role} Full Stack – Home Office`,
            company: "Empresa oculta",
            location: "Remoto",
            source: "Gupy",
            company_logo: null,
          },
          {
            title: `${role} Pleno remoto`,
            company: "Empresa oculta",
            location: "Remoto",
            source: "LinkedIn",
            company_logo: null,
          },
          {
            title: `${role} Sênior — 100% remoto`,
            company: "Empresa oculta",
            location: "Remoto",
            source: "Indeed",
            company_logo: null,
          },
        ];

  useEffect(() => {
    const lockedEl = lockedRef.current;
    const offerEl = offerRef.current;
    if (!lockedEl || !offerEl || !("IntersectionObserver" in window)) return;

    let seenDemo = false;
    let offerVis = false;
    const update = () => setStickyOn(seenDemo && !offerVis);

    const demoObs = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      if (entry.boundingClientRect.top < 0 || entry.isIntersecting) {
        seenDemo = true;
        update();
      }
    });
    const offerObs = new IntersectionObserver(
      (entries) => {
        offerVis = Boolean(entries[0]?.isIntersecting);
        update();
      },
      { threshold: 0.25 }
    );
    demoObs.observe(lockedEl);
    offerObs.observe(offerEl);
    return () => {
      demoObs.disconnect();
      offerObs.disconnect();
    };
  }, [loading]);

  const selected = RR_PLANS[0];

  const benefits = [
    `Todas as ${stats.totalVagas} vagas de hoje, com link direto para se candidatar`,
    `Vagas novas de ${role} adicionadas todo dia`,
    "Selo “Fora do LinkedIn” para achar vagas com menos concorrência",
    "Sem vaga híbrida disfarçada e sem anúncio repetido",
  ];

  return (
    <div className="relative min-h-screen bg-[#06140f] text-[#eef6f1]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 600px at 20% -10%, #123b2b 0%, transparent 60%)",
        }}
      />

      <div className="relative mx-auto max-w-[620px] px-4 pt-5 pb-28">
        <header className="mb-7 flex items-center justify-between pt-1">
          <Link href="/">
            <BrandMark light size="sm" />
          </Link>
          <span className="text-[13px] text-[#9db3a8]">Busca concluída</span>
        </header>

        {loading ? (
          <div className="rounded-3xl border border-[#1d3a2e] bg-[#0d241b] p-8 text-center">
            <p className="font-semibold">Procurando vagas em {PORTALS} portais…</p>
            <p className="mt-2 text-sm text-[#9db3a8]">
              Isso pode levar alguns segundos
            </p>
          </div>
        ) : (
          <>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#c6ef78]/25 bg-[#c6ef78]/10 px-3 py-1.5 text-[13px] font-bold text-[#c6ef78]">
              <i className="h-2 w-2 rounded-full bg-[#c6ef78] shadow-[0_0_0_4px_rgba(198,239,120,.2)]" />
              Buscamos em {PORTALS} portais agora
            </span>
            <h1 className="mt-4 font-[family-name:var(--font-display)] text-[clamp(28px,6.6vw,40px)] leading-[1.08] font-bold tracking-[-0.8px]">
              <em className="not-italic text-[#c6ef78]">
                {stats.totalVagas} vagas remotas
              </em>{" "}
              de {role} abertas agora
            </h1>
            <p className="mt-3 mb-4 text-[17px] text-[#9db3a8]">
              Liberamos 3 de graça para você ver como funciona. As outras{" "}
              {stats.lockedCount} estão no seu feed completo.
            </p>
            {error && jobs.length === 0 && (
              <p className="mb-4 text-sm text-[#9db3a8]">{error}</p>
            )}

            <div className="mb-7 grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-[#1d3a2e] bg-[#0d241b] p-3">
                <b className="block font-[family-name:var(--font-display)] text-2xl leading-tight">
                  {stats.foraLinkedin}
                </b>
                <span className="text-[12.5px] text-[#9db3a8]">
                  fora do LinkedIn
                </span>
              </div>
              <div className="rounded-2xl border border-[#1d3a2e] bg-[#0d241b] p-3">
                <b className="block font-[family-name:var(--font-display)] text-2xl leading-tight">
                  {stats.publicadasHoje}
                </b>
                <span className="text-[12.5px] text-[#9db3a8]">
                  publicadas hoje
                </span>
              </div>
              <div className="rounded-2xl border border-[#1d3a2e] bg-[#0d241b] p-3">
                <b className="block font-[family-name:var(--font-display)] text-2xl leading-tight">
                  {stats.totalVagas}
                </b>
                <span className="text-[12.5px] text-[#9db3a8]">
                  100% remotas
                </span>
              </div>
            </div>

            <div className="mb-3 flex items-baseline justify-between px-0.5">
              <h2 className="text-[15px] font-bold tracking-wide">
                Suas 3 vagas grátis
              </h2>
              <small className="text-[13px] text-[#9db3a8]">
                Pode abrir e se candidatar
              </small>
            </div>

            {(freeJobs.length > 0
              ? freeJobs
              : [
                  {
                    title: `Vaga remota de ${role}`,
                    company: "Empresa",
                    location: "Remoto",
                    source: "",
                    company_logo: null,
                    source_url: null,
                  } as DemoJob,
                ]
            ).map((job, i) => (
              <JobCard
                key={`${job.job_id || i}-${job.title}`}
                job={job}
                free={Boolean(job.source_url)}
              />
            ))}

            <div ref={lockedRef} className="relative mt-[18px]" aria-hidden>
              {lockedCards.map((job, i) => (
                <div
                  key={`${job.title}-${i}`}
                  className={`pointer-events-none select-none blur-[5px] ${
                    i >= 2 ? "opacity-30" : "opacity-55"
                  }`}
                >
                  <JobCard
                    job={{
                      ...job,
                      company: job.company || "Empresa oculta",
                    }}
                  />
                </div>
              ))}
              <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-b from-transparent via-[#06140f]/65 to-[#06140f] pb-1.5">
                <div className="px-5 py-5 text-center">
                  <div className="mb-3 inline-flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-[#c6ef78]">
                    <LockGlyph />
                  </div>
                  <b className="block font-[family-name:var(--font-display)] text-[26px] leading-tight">
                    +{stats.lockedCount} vagas esperando
                  </b>
                  <span className="text-[15px] text-[#9db3a8]">
                    {stats.foraLinkedin} delas fora do LinkedIn
                  </span>
                </div>
              </div>
            </div>

            <section
              ref={offerRef}
              id="oferta"
              className="mt-[22px] scroll-mt-4 rounded-[26px] border border-[#2b5640] bg-gradient-to-b from-[#10301f] to-[#0b2219] p-[22px]"
            >
              <h2 className="font-[family-name:var(--font-display)] text-[26px] leading-tight tracking-[-0.5px]">
                Libere as {stats.lockedCount} vagas e receba as novas todo dia
              </h2>
              <p className="mt-1.5 mb-4 text-[#9db3a8]">
                Um feed só com vagas 100% remotas de {role}, de {PORTALS}{" "}
                portais.
              </p>

              <div className="mb-4 rounded-[18px] border-2 border-[#c6ef78] bg-[#12301f] px-4 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold">{selected.name}</p>
                    <p className="text-[13px] text-[#9db3a8]">{selected.billed}</p>
                  </div>
                  <p className="whitespace-nowrap text-right text-[22px] font-extrabold">
                    {selected.perMonth}
                    <small className="block font-[family-name:var(--font-body)] text-[13px] font-semibold text-[#9db3a8]">
                      uma vez
                    </small>
                  </p>
                </div>
              </div>

              <ul className="mb-[18px] grid list-none gap-2.5 p-0">
                {benefits.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[15px]">
                    <CheckIcon />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                disabled={checkoutLoading}
                onClick={onCheckout}
                className="flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[#c6ef78] text-[17px] font-extrabold text-[#071511] shadow-[0_10px_30px_rgba(198,239,120,.18)] disabled:opacity-60"
              >
                {checkoutLoading
                  ? "Abrindo Mercado Pago…"
                  : `Liberar minhas ${stats.lockedCount} vagas · ${selected.perMonth}`}
              </button>
              {checkoutError && (
                <p className="mt-3 text-center text-sm text-red-300">
                  {checkoutError}
                </p>
              )}
              <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[13px] text-[#9db3a8]">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldIcon />
                  Pagamento seguro
                </span>
                <span>Pagamento único</span>
                <span>7 dias para desistir com reembolso</span>
              </div>
            </section>
            <PaywallFeedbackBlock
              enabled={!loading}
              blocked={checkoutLoading}
              role={role}
              email={email}
              leadId={leadId}
              funnelVariant={funnelVariant || "v2"}
            />

            <section className="mt-8">
              <div className="mb-3 px-0.5">
                <h2 className="text-[15px] font-bold">O que acontece depois</h2>
              </div>
              <ol className="grid list-none gap-2.5 p-0">
                {[
                  [
                    "Seu feed abre na hora",
                    "Todas as vagas encontradas para o seu cargo, sem duplicadas.",
                  ],
                  [
                    "Vagas novas todo dia",
                    "A gente busca de novo nos portais diariamente. Você só abre e vê o que entrou.",
                  ],
                  [
                    "Você se candidata na vaga original",
                    "Cada vaga leva direto para a página da empresa ou do portal de origem.",
                  ],
                ].map((item, i) => (
                  <li
                    key={item[0]}
                    className="flex gap-3 rounded-2xl border border-[#1d3a2e] bg-[#0d241b] p-3.5"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#173328] font-extrabold text-[#c6ef78]">
                      {i + 1}
                    </div>
                    <div>
                      <b>{item[0]}</b>
                      <br />
                      <span className="text-[#9db3a8]">{item[1]}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section className="mt-8">
              <div className="mb-1 px-0.5">
                <h2 className="text-[15px] font-bold">Perguntas rápidas</h2>
              </div>
              {[
                [
                  "De onde vêm as vagas?",
                  "Buscamos em Gupy, LinkedIn, Indeed, Catho, InfoJobs, Remotar e Programathor. Juntamos tudo, tiramos as repetidas e mostramos só as remotas.",
                ],
                [
                  "São mesmo 100% remotas?",
                  "Usamos o filtro de remoto de cada portal e descartamos as marcadas como híbridas ou presenciais. Se um portal classificar errado, a vaga pode escapar, mas o link sempre leva à página original para você conferir.",
                ],
                [
                  "É mensalidade?",
                  "Não. Você paga R$ 29,90 uma vez e libera o feed. Nos primeiros 7 dias pode desistir e receber o valor de volta.",
                ],
              ].map(([q, a]) => (
                <details
                  key={q}
                  className="group border-b border-[#1d3a2e] py-3.5 [&_summary::-webkit-details-marker]:hidden"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold after:text-xl after:text-[#c6ef78] after:content-['+'] group-open:after:content-['–']">
                    {q}
                  </summary>
                  <p className="mt-2 mb-0 text-[#9db3a8]">{a}</p>
                </details>
              ))}
            </section>
          </>
        )}
      </div>

      <div
        className={`fixed right-0 bottom-0 left-0 z-10 border-t border-[#1d3a2e] bg-[#06140f]/92 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur-[10px] transition-transform duration-200 ${
          stickyOn && !loading ? "translate-y-0" : "translate-y-[110%]"
        }`}
      >
        <div className="mx-auto flex max-w-[620px] items-center gap-3">
          <div className="text-[13px] leading-tight text-[#9db3a8]">
            <b className="block text-[15px] text-[#eef6f1]">
              +{stats.lockedCount} vagas de {role}
            </b>
            {selected.perMonth} uma vez
          </div>
          <a
            href="#oferta"
            className="ml-auto flex h-12 shrink-0 items-center rounded-full bg-[#c6ef78] px-5 text-[15px] font-extrabold text-[#071511] no-underline"
          >
            Liberar vagas
          </a>
        </div>
      </div>
      <PaywallExitSurvey
        enabled={!loading}
        blocked={checkoutLoading}
        role={role}
        email={email}
        leadId={leadId}
        funnelVariant={funnelVariant || "v2"}
      />
    </div>
  );
}
