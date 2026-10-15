"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { CompanyAvatar } from "@/components/CompanyAvatar";
import { RR_PLANS } from "@/lib/rrPlans";
import {
  captureAttributionFromUrl,
  loadAttribution,
} from "@/lib/attribution";
import { formatJobAgo, type DemoJob } from "@/lib/demoJobs";
import { saveJobSession } from "@/lib/jobSession";
import { startCheckout } from "@/lib/startCheckout";

function postedLabel(job: DemoJob): string {
  return formatJobAgo(job);
}

function freshestPostedLabel(jobs: DemoJob[]): string {
  const withPosted = jobs.find((j) => j.posted);
  if (withPosted?.posted) {
    return withPosted.posted.replace(/^há\s+/i, "");
  }
  return "algumas horas";
}

function Countdown({ seconds }: { seconds: number }) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    const id = window.setInterval(() => {
      setLeft((prev) => (prev <= 1 ? seconds : prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [seconds]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-ink/50 px-2.5 py-1 text-xs font-semibold text-lime">
      <span aria-hidden>⏱</span>
      {mm}:{ss}
    </span>
  );
}

function LockIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="lockGrad" x1="4" y1="2" x2="20" y2="22">
          <stop stopColor="#c8f560" />
          <stop offset="1" stopColor="#7dffb3" />
        </linearGradient>
      </defs>
      <path
        d="M7 11V8a5 5 0 0 1 10 0v3"
        stroke="url(#lockGrad)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect
        x="5"
        y="11"
        width="14"
        height="10"
        rx="2.5"
        fill="url(#lockGrad)"
      />
    </svg>
  );
}

function JobCard({
  job,
  locked = false,
}: {
  job: DemoJob;
  locked?: boolean;
}) {
  const notOnLinkedIn = !job.source.toLowerCase().includes("linkedin");

  const inner = (
    <div className="flex items-start gap-3">
      <CompanyAvatar
        company={job.company}
        logoUrl={job.company_logo}
        tone="dark"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate font-semibold text-cream">{job.title}</h2>
            <p className="truncate text-sm text-sand/55">{job.company}</p>
          </div>
          {!locked && (
            <span className="mt-0.5 shrink-0 opacity-80" aria-hidden>
              <LockIcon className="h-4 w-4" />
            </span>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {notOnLinkedIn && (
            <span className="rounded-full bg-lime/20 px-2.5 py-1 text-[11px] font-semibold text-lime">
              🚫 Fora do LinkedIn
            </span>
          )}
          <span className="rounded-full bg-white/8 px-2.5 py-1 text-[11px] text-sand/80">
            🔥 {postedLabel(job)}
          </span>
          <span className="rounded-full bg-white/8 px-2.5 py-1 text-[11px] text-sand/80">
            🌏 100% remoto
          </span>
        </div>
      </div>
    </div>
  );

  if (!locked) {
    return (
      <article className="relative rounded-2xl border border-white/10 bg-[#0a1f19]/90 p-4">
        {inner}
      </article>
    );
  }

  return (
    <button
      type="button"
      className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0a1f19]/90 p-4 text-left"
    >
      <div className="pointer-events-none select-none blur-[7px]">{inner}</div>
      <div className="absolute top-3.5 right-3.5 z-10">
        <LockIcon />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-ink/20" />
    </button>
  );
}

export function FinalV2() {
  const searchParams = useSearchParams();
  const initialRole = searchParams.get("role") || searchParams.get("q") || "";

  const [phase, setPhase] = useState<"search" | "results" | "paywall">(
    initialRole.trim().length > 1 ? "results" : "search"
  );
  const [role, setRole] = useState(initialRole);
  const [jobs, setJobs] = useState<DemoJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] =
    useState<(typeof RR_PLANS)[number]["id"]>("yearly");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  /** Preview: 3 abertas + 1 bloqueada (blur). */
  const previewJobs = jobs.slice(0, 3);
  const lockedJob: DemoJob | null =
    jobs[3] ||
    (jobs[0]
      ? {
          ...jobs[0],
          title: jobs[0].title,
          company: jobs[0].company,
        }
      : null);

  /** Quando pagar, outros scrapers entram — mostramos o dobro do que achamos agora. */
  const moreCount = Math.max(jobs.length * 2, 2);

  const headlineTime = useMemo(() => freshestPostedLabel(jobs), [jobs]);

  async function logLead(
    trimmed: string,
    list: DemoJob[],
    cached: boolean
  ) {
    const attr = loadAttribution() || {};
    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: trimmed,
          channel: "demo",
          jobs_shown: list.slice(0, 20),
          cached,
          ...attr,
        }),
        keepalive: true,
      });
    } catch {
      // não bloqueia o funil
    }
  }

  async function runSearch(value: string) {
    const trimmed = value.trim();
    if (trimmed.length < 2) return;

    setLoading(true);
    setError(null);
    setJobs([]);
    setPhase("results");

    try {
      const res = await fetch(`/api/jobs?role=${encodeURIComponent(trimmed)}`);
      const data = await res.json().catch(() => ({}));
      const list: DemoJob[] = Array.isArray(data.jobs) ? data.jobs : [];
      setJobs(list);
      saveJobSession(trimmed, list);
      setError(
        list.length === 0
          ? data.error ||
              `Não encontramos vagas remotas para “${trimmed}” agora.`
          : null,
      );
      void logLead(trimmed, list, Boolean(data.cached));
    } catch {
      setJobs([]);
      setError("Falha ao buscar vagas. Tente novamente.");
      void logLead(trimmed, [], false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    captureAttributionFromUrl(searchParams);
  }, [searchParams]);

  useEffect(() => {
    if (initialRole.trim().length > 1) {
      void runSearch(initialRole);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void runSearch(role);
  }

  function openPaywall() {
    setPhase("paywall");
  }

  async function startPaidCheckout() {
    const nextRole = role.trim() || "SEO";
    saveJobSession(nextRole, jobs);
    setCheckoutError(null);
    setCheckoutLoading(true);
    try {
      const result = await startCheckout({
        planId: selectedPlan,
        role: nextRole,
      });
      if ("error" in result) {
        setCheckoutError(result.error);
        return;
      }
      window.location.href = result.checkoutUrl;
    } catch {
      setCheckoutError("Falha ao abrir o Mercado Pago. Tente de novo.");
    } finally {
      setCheckoutLoading(false);
    }
  }

  return (
    <div className="bg-mesh relative min-h-screen text-cream">
      <div className="bg-grain pointer-events-none absolute inset-0 opacity-40" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 py-5 sm:px-5">
        <div className="mb-5 flex items-center justify-between">
          <Link href="/">
            <BrandMark light size="sm" />
          </Link>
          <span className="rounded-full border border-lime/30 bg-lime/10 px-2.5 py-1 text-[10px] font-bold tracking-wide text-lime uppercase">
            /final/v2
          </span>
        </div>

        {/* SEARCH */}
        {(phase === "search" ||
          (!loading && phase === "results" && jobs.length === 0)) && (
          <section className="mb-6">
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold leading-tight">
              Encontre sua próxima vaga remota
            </h1>
            <p className="mt-2 text-sm text-sand/70">
              Digite o cargo e veja matches frescos de vários portais.
            </p>
            <form
              onSubmit={onSubmit}
              className="mt-5 flex flex-col gap-2 sm:flex-row"
            >
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Cargo… ex: SEO, programador"
                className="flex-1 rounded-2xl border border-white/15 bg-white/5 px-4 py-3.5 text-cream outline-none placeholder:text-sand/40 focus:border-lime/50"
                autoFocus
              />
              <button
                type="submit"
                disabled={loading || role.trim().length < 2}
                className="rounded-2xl bg-lime px-5 py-3.5 text-sm font-bold text-ink transition hover:bg-mint disabled:opacity-40"
              >
                {loading ? "…" : "Buscar"}
              </button>
            </form>
            {error && <p className="mt-3 text-xs text-sand/50">{error}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {["SEO", "programador", "designer"].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setRole(chip);
                    void runSearch(chip);
                  }}
                  className="rounded-full border border-white/15 px-3 py-1.5 text-sm text-sand/75 hover:border-lime/40 disabled:opacity-40"
                >
                  {chip}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* LOADING */}
        {loading && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
            <p className="font-semibold">
              Procurando vagas em diversos portais e empresas…
            </p>
            <p className="mt-2 text-sm text-sand/55">Isso pode levar alguns segundos</p>
          </div>
        )}

        {/* RESULTS */}
        {!loading && phase === "results" && jobs.length > 0 && (
          <section className="animate-rise flex flex-1 flex-col">
            <div className="relative mb-6 overflow-hidden rounded-2xl border border-lime/35 bg-gradient-to-r from-forest/80 to-moss/40 p-4">
              <div className="absolute top-3 right-3">
                <Countdown seconds={186} />
              </div>
              <div className="flex flex-col gap-3 pr-16 sm:flex-row sm:items-center sm:justify-between sm:pr-24">
                <div>
                  <p className="font-[family-name:var(--font-display)] text-2xl font-extrabold text-lime">
                    72% OFF
                  </p>
                  <p className="text-sm text-sand/80">Oferta por tempo limitado</p>
                </div>
                <button
                  type="button"
                  onClick={openPaywall}
                  className="shrink-0 rounded-full bg-lime px-6 py-2.5 text-sm font-bold text-ink transition hover:bg-mint"
                >
                  Upgrade
                </button>
              </div>
            </div>

            <h1 className="text-center font-[family-name:var(--font-display)] text-[1.65rem] leading-tight font-bold sm:text-3xl">
              Sua próxima vaga foi publicada{" "}
              <span className="text-lime">{headlineTime}</span>
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-center text-sm text-sand/65">
              Vagas top recebem 100+ candidatos rápido. Candidate-se antes da
              multidão.
            </p>

            <div className="mt-7 space-y-3">
              {previewJobs.map((job, index) => (
                <JobCard
                  key={`${job.job_id || index}-${job.title}`}
                  job={job}
                />
              ))}

              {lockedJob && (
                <div>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={openPaywall}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") openPaywall();
                    }}
                  >
                    <JobCard job={lockedJob} locked />
                  </div>
                  <p className="mt-3 text-center text-sm font-medium text-cream/90">
                    + {moreCount} matches para o seu perfil
                  </p>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={openPaywall}
              className="mt-6 w-full rounded-full bg-lime py-4 text-base font-bold text-ink transition hover:bg-mint"
            >
              Ver todas as vagas
            </button>
            <button
              type="button"
              onClick={() => setPhase("search")}
              className="mt-3 text-center text-xs text-sand/45 hover:text-sand/70"
            >
              Nova busca
            </button>
          </section>
        )}

        {/* PAYWALL */}
        {!loading && phase === "paywall" && (
          <section className="animate-rise flex flex-1 flex-col pb-8">
            <div className="relative mb-6 overflow-hidden rounded-2xl border border-white/10">
              <div className="pointer-events-none select-none blur-[6px] opacity-75">
                {(jobs[0]
                  ? [jobs[0]]
                  : [
                      {
                        title: "Vaga remota",
                        company: "Empresa",
                        source: "",
                        location: "",
                        company_logo: null,
                      } as DemoJob,
                    ]
                ).map((job, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 bg-white/5 p-4"
                  >
                    <CompanyAvatar
                      company={job.company}
                      logoUrl={job.company_logo}
                      tone="dark"
                      size="sm"
                    />
                    <div>
                      <p className="font-semibold">{job.title}</p>
                      <p className="text-sm text-sand/50">{job.company}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="absolute top-3 right-3">
                <LockIcon />
              </div>
              <p className="absolute inset-x-0 bottom-3 text-center text-sm font-medium text-cream">
                + {moreCount} matches para o seu perfil
              </p>
            </div>

            <h1 className="text-center font-[family-name:var(--font-display)] text-3xl font-bold">
              Escolha seu plano
            </h1>

            <div className="mt-6 space-y-3">
              {RR_PLANS.map((plan) => {
                const selected = selectedPlan === plan.id;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlan(plan.id)}
                    className={`relative w-full overflow-hidden rounded-2xl border p-4 text-left transition ${
                      selected
                        ? "border-lime bg-lime/10"
                        : "border-white/12 bg-white/5 hover:border-white/25"
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute inset-x-0 top-0 bg-lime py-1 text-center text-[10px] font-extrabold tracking-[0.14em] text-ink uppercase">
                        Mais popular
                      </div>
                    )}
                    <div
                      className={`flex items-start justify-between gap-3 ${plan.popular ? "pt-5" : ""}`}
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-cream">{plan.name}</span>
                          {plan.badge && (
                            <span className="rounded-full border border-lime/40 px-2 py-0.5 text-[10px] font-semibold text-lime">
                              {plan.badge}
                            </span>
                          )}
                        </div>
                        {plan.strikethrough && (
                          <p className="mt-1 text-sm text-sand/40 line-through">
                            {plan.strikethrough}
                          </p>
                        )}
                        {plan.billed && (
                          <p className="text-sm text-sand/80">{plan.billed}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-[family-name:var(--font-display)] text-2xl font-bold">
                          {plan.perMonth}
                        </p>
                        <p className="text-xs text-sand/50">por mês</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <p className="mt-5 flex items-center justify-center gap-2 text-sm text-sand/70">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-mint text-[11px] font-bold text-ink">
                ✓
              </span>
              Cartão ou Pix · Sem fidelidade
            </p>
            {checkoutError && (
              <p className="mt-3 text-center text-sm text-red-300">
                {checkoutError}
              </p>
            )}

            <button
              type="button"
              disabled={checkoutLoading}
              onClick={() => void startPaidCheckout()}
              className="mt-5 w-full rounded-full bg-lime py-4 text-base font-bold text-ink transition hover:bg-mint disabled:opacity-50"
            >
              {checkoutLoading
                ? "Abrindo Mercado Pago…"
                : "Pagar com cartão ou Pix"}
            </button>

            <button
              type="button"
              onClick={() => setPhase("results")}
              className="mt-4 text-center text-xs text-sand/45 hover:text-sand/70"
            >
              ← Voltar às vagas
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
