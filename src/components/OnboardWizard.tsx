"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FUNNEL_STEPS, type FunnelAnswer } from "@/lib/funnel";
import { type DemoJob } from "@/lib/demoJobs";
import { RR_PLANS } from "@/lib/rrPlans";
import { BrandMark } from "./BrandMark";

const ROLE_STORAGE_KEY = "remotoja_onboard_role";

function companyInitial(name: string) {
  return (name.trim()[0] || "?").toUpperCase();
}

function postedLabel(job: DemoJob): string {
  return job.posted || "Recente";
}

function freshestPostedLabel(jobs: DemoJob[]): string {
  const withPosted = jobs.find((j) => j.posted);
  if (withPosted?.posted) {
    return withPosted.posted.replace(/^há\s+/i, "");
  }
  return "algumas horas";
}

function isOffLinkedIn(source: string) {
  return !source.toLowerCase().includes("linkedin");
}

function readPrefillRole(fromUrl: string | null): string {
  if (fromUrl && fromUrl.trim().length >= 2) return fromUrl.trim();
  try {
    const stored = sessionStorage.getItem(ROLE_STORAGE_KEY);
    if (stored && stored.trim().length >= 2) return stored.trim();
  } catch {
    /* ignore */
  }
  return "";
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
        <linearGradient id="lockGradOnboard" x1="4" y1="2" x2="20" y2="22">
          <stop stopColor="#c8f560" />
          <stop offset="1" stopColor="#7dffb3" />
        </linearGradient>
      </defs>
      <path
        d="M7 11V8a5 5 0 0 1 10 0v3"
        stroke="url(#lockGradOnboard)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect
        x="5"
        y="11"
        width="14"
        height="10"
        rx="2.5"
        fill="url(#lockGradOnboard)"
      />
    </svg>
  );
}

function MatchJobCard({
  job,
  locked = false,
}: {
  job: DemoJob;
  locked?: boolean;
}) {
  const notOnLinkedIn = isOffLinkedIn(job.source);

  const inner = (
    <div className="flex items-start gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cream text-sm font-bold text-ink">
        {companyInitial(job.company)}
      </div>
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
              Fora do LinkedIn
            </span>
          )}
          <span className="rounded-full bg-white/8 px-2.5 py-1 text-[11px] text-sand/80">
            {postedLabel(job)}
          </span>
          <span className="rounded-full bg-white/8 px-2.5 py-1 text-[11px] text-sand/80">
            100% remoto
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
    <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0a1f19]/90 p-4 text-left">
      <div className="pointer-events-none select-none blur-[7px]">{inner}</div>
      <div className="absolute top-3.5 right-3.5 z-10">
        <LockIcon />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-ink/20" />
    </div>
  );
}

export function OnboardWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, FunnelAnswer>>({});
  const [draft, setDraft] = useState("");
  const [selectedPlan, setSelectedPlan] =
    useState<(typeof RR_PLANS)[number]["id"]>("yearly");
  const [liveJobs, setLiveJobs] = useState<DemoJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [prefillRole] = useState(() =>
    readPrefillRole(searchParams.get("role")),
  );

  const step = FUNNEL_STEPS[index];
  const isLast = index === FUNNEL_STEPS.length - 1;

  useEffect(() => {
    if (step.id !== "role" || !prefillRole) return;
    if (typeof answers.role === "string" && answers.role.trim()) return;
    setDraft(prefillRole);
  }, [step.id, prefillRole, answers.role]);

  const role =
    (typeof answers.role === "string" && answers.role) ||
    draft ||
    prefillRole ||
    "seu cargo";

  const matches = liveJobs;
  const previewJobs = matches.slice(0, 3);
  const lockedJob: DemoJob | null =
    matches[3] ||
    (matches[0]
      ? {
          ...matches[0],
          title: matches[0].title,
          company: matches[0].company,
        }
      : null);
  const moreCount = Math.max(matches.length * 2, 2);
  const headlineTime = useMemo(
    () => freshestPostedLabel(matches),
    [matches],
  );

  const canContinue = useMemo(() => {
    if (step.kind === "single" || step.kind === "multi") {
      const value = answers[step.id];
      if (!value) return false;
      return Array.isArray(value) ? value.length > 0 : Boolean(value);
    }
    if (step.kind === "text") {
      return (typeof answers[step.id] === "string" ? answers[step.id] : draft)
        .toString()
        .trim().length > 1;
    }
    if (step.kind === "matches") {
      return !jobsLoading;
    }
    return true;
  }, [answers, draft, step, jobsLoading]);

  useEffect(() => {
    if (step.kind !== "matches") return;

    const roleQuery =
      (typeof answers.role === "string" && answers.role.trim()) ||
      draft.trim() ||
      prefillRole.trim();
    if (!roleQuery) {
      setLiveJobs([]);
      setJobsError("Informe um cargo para buscar vagas.");
      setJobsLoading(false);
      return;
    }

    const controller = new AbortController();
    setJobsLoading(true);
    setJobsError(null);

    fetch(`/api/jobs?role=${encodeURIComponent(roleQuery)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json();
        const jobs: DemoJob[] = Array.isArray(data.jobs) ? data.jobs : [];
        setLiveJobs(jobs.slice(0, 8));
        if (jobs.length === 0) {
          setJobsError(
            data.error ||
              `Não encontramos vagas remotas para “${roleQuery}” agora. Continue para o feed completo.`,
          );
        }
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setLiveJobs([]);
        setJobsError(err instanceof Error ? err.message : "Falha na busca");
      })
      .finally(() => {
        if (!controller.signal.aborted) setJobsLoading(false);
      });

    return () => controller.abort();
  }, [step.kind, answers.role, draft, prefillRole]);

  function toggleMulti(option: string) {
    const current = (answers[step.id] as string[] | undefined) ?? [];
    const next = current.includes(option)
      ? current.filter((item) => item !== option)
      : [...current, option];
    setAnswers((prev) => ({ ...prev, [step.id]: next }));
  }

  function selectSingle(option: string) {
    setAnswers((prev) => ({ ...prev, [step.id]: option }));
  }

  function goNext() {
    if (step.kind === "text" && draft.trim()) {
      setAnswers((prev) => ({ ...prev, [step.id]: draft.trim() }));
    }
    if (!isLast) setIndex((prev) => prev + 1);
  }

  function goBack() {
    if (index > 0) setIndex((prev) => prev - 1);
  }

  function openMemberDash() {
    const nextRole =
      (typeof answers.role === "string" && answers.role.trim()) ||
      draft.trim() ||
      prefillRole.trim() ||
      "SEO";
    router.push(`/app?role=${encodeURIComponent(nextRole)}`);
  }

  const hideDefaultHeader =
    step.kind === "matches" || step.kind === "paywall";

  return (
    <div className="bg-mesh relative min-h-screen text-cream">
      <div className="bg-grain pointer-events-none absolute inset-0 opacity-40" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-xl flex-col px-5 py-6">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/">
            <BrandMark light size="sm" />
          </Link>
          {index > 0 && step.kind !== "matches" && step.kind !== "paywall" && (
            <button
              type="button"
              onClick={goBack}
              className="text-sm text-sand/70 transition hover:text-cream"
            >
              Voltar
            </button>
          )}
        </div>

        {step.kind !== "matches" && step.kind !== "paywall" && (
          <div className="mb-8">
            <div className="mb-2 flex items-center justify-between text-xs text-sand/60">
              <span>Seu perfil</span>
              <span>{step.progress}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="progress-bar h-full rounded-full transition-all duration-500"
                style={{ width: `${step.progress}%` }}
              />
            </div>
          </div>
        )}

        <div key={step.id} className="animate-rise flex flex-1 flex-col">
          {!hideDefaultHeader && (
            <>
              <h1 className="font-[family-name:var(--font-display)] text-3xl leading-tight font-bold md:text-4xl">
                {step.headline}
              </h1>
              {"subheadline" in step && step.subheadline && (
                <p className="mt-3 text-base leading-relaxed text-sand/80">
                  {step.subheadline}
                </p>
              )}
            </>
          )}

          {step.kind === "intro" && (
            <div className="mt-8 space-y-6">
              <div className="flex flex-wrap gap-2">
                {step.badges?.map((badge) => (
                  <span
                    key={badge}
                    className="rounded-full border border-lime/30 bg-white/5 px-3 py-1 text-sm text-lime"
                  >
                    {badge}
                  </span>
                ))}
              </div>
              <p className="text-sm text-sand/60">
                Amado por quem busca remoto de verdade, sem spam de recrutador.
              </p>
            </div>
          )}

          {step.kind === "value" && (
            <div className="mt-8">
              <p className="mb-4 text-xs font-semibold tracking-[0.14em] text-sand/45 uppercase">
                Só um contexto · nada para selecionar
              </p>
              <ul className="space-y-4 border-l-2 border-lime/40 pl-5">
                {step.bullets?.map((bullet) => (
                  <li
                    key={bullet}
                    className="relative text-[15px] leading-relaxed text-sand/90"
                  >
                    <span
                      aria-hidden
                      className="absolute -left-[1.55rem] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-lime text-[10px] font-bold text-ink"
                    >
                      ✓
                    </span>
                    {bullet}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(step.kind === "single" || step.kind === "multi") && (
            <div className="mt-8 flex flex-col gap-3">
              {step.options.map((option) => {
                const selected =
                  step.kind === "multi"
                    ? ((answers[step.id] as string[] | undefined) ?? []).includes(
                        option
                      )
                    : answers[step.id] === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() =>
                      step.kind === "multi"
                        ? toggleMulti(option)
                        : selectSingle(option)
                    }
                    className={`rounded-2xl border px-4 py-3.5 text-left text-[15px] transition ${
                      selected
                        ? "border-lime bg-lime/15 text-cream"
                        : "border-white/10 bg-white/5 text-sand/90 hover:border-white/25"
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          )}

          {step.kind === "text" && (
            <div className="mt-8 space-y-3">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={step.placeholder}
                className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-4 text-cream outline-none placeholder:text-sand/40 focus:border-lime/60"
              />
            </div>
          )}

          {step.kind === "matches" && (
            <div className="flex flex-1 flex-col">
              {jobsLoading ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
                  <p className="font-semibold">
                    Procurando vagas em diversos portais e empresas…
                  </p>
                  <p className="mt-2 text-sm text-sand/55">
                    Isso pode levar alguns segundos
                  </p>
                </div>
              ) : matches.length > 0 ? (
                <>
                  <div className="relative mb-6 overflow-hidden rounded-2xl border border-lime/35 bg-gradient-to-r from-forest/80 to-moss/40 p-4">
                    <div className="absolute top-3 right-3">
                      <Countdown seconds={186} />
                    </div>
                    <div className="flex flex-col gap-3 pr-16 sm:flex-row sm:items-center sm:justify-between sm:pr-24">
                      <div>
                        <p className="font-[family-name:var(--font-display)] text-2xl font-extrabold text-lime">
                          72% OFF
                        </p>
                        <p className="text-sm text-sand/80">
                          Oferta por tempo limitado
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={goNext}
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
                    Vagas top recebem 100+ candidatos rápido. Candidate-se antes
                    da multidão.
                  </p>

                  <div className="mt-7 space-y-3">
                    {previewJobs.map((job, i) => (
                      <MatchJobCard
                        key={`${job.job_id || i}-${job.title}`}
                        job={job}
                      />
                    ))}

                    {lockedJob && (
                      <div>
                        <button
                          type="button"
                          onClick={goNext}
                          className="w-full text-left"
                        >
                          <MatchJobCard job={lockedJob} locked />
                        </button>
                        <p className="mt-3 text-center text-sm font-medium text-cream/90">
                          + {moreCount} matches para o seu perfil
                        </p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
                  <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">
                    Buscamos vagas de {role}
                  </h1>
                  <p className="mt-2 text-sm text-sand/60">
                    {jobsError ||
                      "Continue para liberar o feed completo com todos os portais."}
                  </p>
                </div>
              )}
            </div>
          )}

          {step.kind === "paywall" && (
            <div className="flex flex-1 flex-col pb-4">
              <div className="relative mb-6 overflow-hidden rounded-2xl border border-white/10">
                <div className="pointer-events-none select-none blur-[6px] opacity-75">
                  {(matches[0]
                    ? [matches[0]]
                    : [{ title: "Vaga remota", company: "Empresa", source: "" }]
                  ).map((job, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 bg-white/5 p-4"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cream text-sm font-bold text-ink">
                        {companyInitial(job.company)}
                      </div>
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
                            <span className="font-bold text-cream">
                              {plan.name}
                            </span>
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
            </div>
          )}

          <div className="mt-auto pt-8 pb-4">
            {step.kind === "paywall" ? (
              <button
                type="button"
                onClick={openMemberDash}
                className="w-full rounded-full bg-lime py-4 text-center text-base font-bold text-ink transition hover:bg-mint"
              >
                Acessar todas as vagas
              </button>
            ) : step.kind === "matches" ? (
              <button
                type="button"
                disabled={!canContinue}
                onClick={goNext}
                className="w-full rounded-full bg-lime py-4 text-center text-base font-bold text-ink transition hover:bg-mint disabled:cursor-not-allowed disabled:opacity-40"
              >
                Ver todas as vagas
              </button>
            ) : (
              <button
                type="button"
                disabled={!canContinue}
                onClick={goNext}
                className="w-full rounded-full bg-lime py-4 text-center text-base font-bold text-ink transition hover:bg-mint disabled:cursor-not-allowed disabled:opacity-40"
              >
                {step.cta}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
