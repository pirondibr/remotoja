"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { buildJobsQuery } from "@/lib/buildJobsQuery";
import { RR_PLANS } from "@/lib/rrPlans";
import { formatJobAgo, type DemoJob } from "@/lib/demoJobs";

function companyInitial(name: string) {
  return (name.trim()[0] || "?").toUpperCase();
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

export function FinalV2() {
  const searchParams = useSearchParams();
  const initialRole = searchParams.get("role") || searchParams.get("q") || "";

  const [phase, setPhase] = useState<"search" | "results" | "paywall">(
    initialRole.trim().length > 1 ? "results" : "search"
  );
  const [role, setRole] = useState(initialRole);
  const [jobs, setJobs] = useState<DemoJob[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"live" | "fallback" | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<(typeof RR_PLANS)[number]["id"]>("yearly");

  const visibleJobs = jobs.slice(0, 4);
  const moreCount = Math.max(jobs.length - 2, 120 + (role.length % 80));

  const headlineTime = useMemo(
    () => freshestPostedLabel(jobs),
    [jobs]
  );

  async function runSearch(value: string) {
    const trimmed = value.trim();
    if (trimmed.length < 2) return;

    setLoading(true);
    setError(null);
    setQuery(buildJobsQuery(trimmed));
    setJobs([]);
    setSource(null);
    setPhase("results");

    try {
      const res = await fetch(`/api/jobs?role=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      const list: DemoJob[] = Array.isArray(data.jobs) ? data.jobs : [];
      setJobs(list);
      setQuery(data.query || buildJobsQuery(trimmed));
      setSource(
        data.fetched_via === "dataforseo_google_jobs" ? "live" : "fallback"
      );
      if (data.error) setError(data.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na busca");
      setSource("fallback");
    } finally {
      setLoading(false);
    }
  }

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

  return (
    <div className="bg-mesh relative min-h-screen text-cream">
      <div className="bg-grain pointer-events-none absolute inset-0 opacity-40" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 py-5 sm:px-5">
        <div className="mb-5 flex items-center justify-between">
          <Link href="/">
            <BrandMark light size="sm" />
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/final"
              className="text-xs text-sand/50 transition hover:text-sand/80"
            >
              v1
            </Link>
            <span className="rounded-full border border-lime/30 bg-lime/10 px-2.5 py-1 text-[10px] font-bold tracking-wide text-lime uppercase">
              /final/v2
            </span>
          </div>
        </div>

        {/* SEARCH */}
        {(phase === "search" || (!loading && phase === "results" && jobs.length === 0)) && (
          <section className="mb-6">
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold leading-tight">
              Encontre sua próxima vaga remota
            </h1>
            <p className="mt-2 text-sm text-sand/70">
              Atalho de teste no modelo Remote Rocketship — busca + wall + paywall.
            </p>
            <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-2 sm:flex-row">
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
            {role.trim().length > 1 && (
              <p className="mt-2 text-xs text-sand/45">
                Query: <span className="text-lime">{buildJobsQuery(role)}</span>
              </p>
            )}
            {error && (
              <p className="mt-3 text-xs text-sand/50">{error}</p>
            )}
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
            <p className="font-semibold">Escaneando Google Vagas…</p>
            <p className="mt-2 text-sm text-sand/60">{query}</p>
            <p className="mt-1 text-xs text-sand/40">~10–30s</p>
          </div>
        )}

        {/* RESULTS — Remote Rocketship style */}
        {!loading && phase === "results" && jobs.length > 0 && (
          <section className="animate-rise flex flex-1 flex-col">
            {/* Promo banner */}
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
                  onClick={() => setPhase("paywall")}
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

            {source && (
              <p className="mt-3 text-center text-[11px] text-sand/40">
                {source === "live" ? "Google Vagas ao vivo" : "fallback"} · {query}
              </p>
            )}

            <div className="mt-7 space-y-3">
              {visibleJobs.map((job, index) => {
                const notOnLinkedIn =
                  !job.source.toLowerCase().includes("linkedin");
                return (
                  <article
                    key={`${job.job_id || index}-${job.title}`}
                    className="relative rounded-2xl border border-white/10 bg-[#0a1f19]/90 p-4 shadow-[0_0_0_1px_rgba(200,245,96,0.04)]"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cream text-sm font-bold text-ink">
                        {companyInitial(job.company)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h2 className="truncate font-semibold text-cream">
                              {job.title}
                            </h2>
                            <p className="truncate text-sm text-sand/55">
                              {job.company}
                            </p>
                          </div>
                          <span
                            className="mt-0.5 shrink-0 text-lime/80"
                            title="Desbloqueie no plano"
                            aria-label="Bloqueado"
                          >
                            🔒
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {notOnLinkedIn && (
                            <span className="rounded-full bg-lime/20 px-2.5 py-1 text-[11px] font-semibold text-lime">
                              🚫 Fora do LinkedIn
                            </span>
                          )}
                          <span className="rounded-full bg-white/8 px-2.5 py-1 text-[11px] text-sand/80">
                            🔥 {formatJobAgo(job)}
                          </span>
                          <span className="rounded-full bg-white/8 px-2.5 py-1 text-[11px] text-sand/80">
                            🌏 100% remoto
                          </span>
                          {job.source && (
                            <span className="rounded-full bg-white/8 px-2.5 py-1 text-[11px] text-sand/55">
                              via {job.source}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setPhase("paywall")}
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

        {/* PAYWALL — Choose your plan */}
        {!loading && phase === "paywall" && (
          <section className="animate-rise flex flex-1 flex-col pb-8">
            {/* Blurred teaser */}
            <div className="relative mb-6 overflow-hidden rounded-2xl border border-white/10">
              <div className="pointer-events-none select-none blur-[3px] opacity-70">
                {(jobs[0] ? [jobs[0]] : [{ title: "Vaga remota", company: "Empresa" }]).map(
                  (job, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 bg-white/5 p-4"
                    >
                      <div className="h-10 w-10 rounded-full bg-cream/90" />
                      <div>
                        <p className="font-semibold">{job.title}</p>
                        <p className="text-sm text-sand/50">{job.company}</p>
                      </div>
                    </div>
                  )
                )}
              </div>
              <p className="absolute inset-x-0 bottom-3 text-center text-sm font-medium text-mint">
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
                    <div className={`flex items-start justify-between gap-3 ${plan.popular ? "pt-5" : ""}`}>
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
              Sem fidelidade · Cancele quando quiser
            </p>

            <button
              type="button"
              onClick={() =>
                alert(
                  `Checkout em breve — plano selecionado: ${selectedPlan}. (fase de testes)`
                )
              }
              className="mt-5 w-full rounded-full bg-lime py-4 text-base font-bold text-ink transition hover:bg-mint"
            >
              🔑 Acessar todas as vagas
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
