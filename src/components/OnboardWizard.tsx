"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FUNNEL_STEPS, type FunnelAnswer } from "@/lib/funnel";
import { dedupeDemoJobs, formatDemoJobAgo, type DemoJob } from "@/lib/demoJobs";
import { RR_PLANS } from "@/lib/rrPlans";
import { assignFeedAb, type FeedAbVariant } from "@/lib/funnelAb";
import { startCheckout } from "@/lib/startCheckout";
import { looksLikeMultipleRoles } from "@/lib/splitRoles";
import { captureLeadId, loadLeadId } from "@/lib/leadClient";
import { FeedConvertV2 } from "./FeedConvertV2";
import { PaywallExitSurvey, PaywallFeedbackBlock } from "./PaywallExitSurvey";
import { RoleChoiceHint } from "./RoleChoiceHint";
import {
  demoJobsUrl,
  trackSearchFromJobsPayload,
} from "@/lib/fetchDemoJobsClient";
import {
  captureAttributionFromUrl,
  loadAttribution,
} from "@/lib/attribution";
import { BrandMark } from "./BrandMark";
import { CompanyAvatar } from "./CompanyAvatar";

const ROLE_STORAGE_KEY = "mvr_onboard_role";
const ANSWERS_STORAGE_KEY = "mvr_funnel_answers";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function postedLabel(job: DemoJob): string {
  return formatDemoJobAgo(job);
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
  const searchParams = useSearchParams();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, FunnelAnswer>>({});
  const [draft, setDraft] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [liveJobs, setLiveJobs] = useState<DemoJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [prefillRole] = useState(() =>
    readPrefillRole(searchParams.get("role")),
  );
  const [feedAb, setFeedAb] = useState<FeedAbVariant | null>(null);
  const [leadId, setLeadId] = useState<string | null>(() => loadLeadId());

  const step = FUNNEL_STEPS[index];
  const isLast = index === FUNNEL_STEPS.length - 1;

  useEffect(() => {
    if (step.kind !== "contact") return;
    if (typeof answers.name === "string" && answers.name && !nameDraft.trim()) {
      setNameDraft(answers.name);
    }
    if (typeof answers.email === "string" && answers.email && !emailDraft.trim()) {
      setEmailDraft(answers.email);
    }
    if (typeof answers.role === "string" && answers.role.trim() && !draft.trim()) {
      setDraft(answers.role);
    } else if (prefillRole && !draft.trim()) {
      setDraft(prefillRole);
    }
    // Só ao entrar no step / prefill — não re-rodar a cada keystroke
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.kind, prefillRole]);

  const role =
    (typeof answers.role === "string" && answers.role) ||
    draft ||
    prefillRole ||
    "seu cargo";
  const surveyEmail =
    (typeof answers.email === "string" && answers.email.trim()) ||
    emailDraft.trim() ||
    "";

  const matches = dedupeDemoJobs(liveJobs);
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
  const moreCount = Math.max(matches.length * 2, 16);

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
    if (step.kind === "contact") {
      return (
        nameDraft.trim().length >= 2 &&
        isValidEmail(emailDraft) &&
        draft.trim().length >= 2 &&
        !looksLikeMultipleRoles(draft)
      );
    }
    if (step.kind === "matches") {
      return !jobsLoading;
    }
    return true;
  }, [answers, draft, nameDraft, emailDraft, step, jobsLoading]);

  useEffect(() => {
    captureAttributionFromUrl(searchParams);
  }, [searchParams]);

  useEffect(() => {
    setFeedAb(assignFeedAb(searchParams.get("ab")));
  }, [searchParams]);

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

    try {
      sessionStorage.setItem(ROLE_STORAGE_KEY, roleQuery);
      sessionStorage.setItem(ANSWERS_STORAGE_KEY, JSON.stringify(answers));
    } catch {
      /* ignore */
    }

    const controller = new AbortController();
    setJobsLoading(true);
    setJobsError(null);

    const { url: jobsUrl, eventId: searchId } = demoJobsUrl(roleQuery);
    fetch(jobsUrl, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json();
        trackSearchFromJobsPayload(roleQuery, data, searchId);
        const jobs: DemoJob[] = Array.isArray(data.jobs) ? data.jobs : [];
        setLiveJobs(dedupeDemoJobs(jobs).slice(0, 8));
        if (jobs.length === 0) {
          const raw = typeof data.error === "string" ? data.error : "";
          const friendly = /timeout|google jobs/i.test(raw)
            ? `A busca demorou mais que o normal para “${roleQuery}”. Continue para ver o feed completo.`
            : raw ||
              `Não encontramos vagas remotas para “${roleQuery}” agora. Continue para o feed completo.`;
          setJobsError(friendly);
        }
        // 1 registro por visita — mesmo se a API devolveu cache
        const attr = loadAttribution() || {};
        const variant = feedAb || assignFeedAb(searchParams.get("ab"));
        void fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: roleQuery,
            channel: "demo",
            jobs_shown: jobs.slice(0, 20),
            cached: Boolean(data.cached),
            answers,
            funnel_variant: variant,
            ...attr,
          }),
          keepalive: true,
        })
          .then((res) => res.json())
          .then((payload) => {
            const id = captureLeadId(payload);
            if (id) setLeadId(id);
          })
          .catch(() => {});
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setLiveJobs([]);
        setJobsError(
          "Não foi possível carregar a prévia agora. Continue para o feed completo.",
        );
        const attr = loadAttribution() || {};
        const variant = feedAb || assignFeedAb(searchParams.get("ab"));
        void fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: roleQuery,
            channel: "demo",
            jobs_shown: [],
            cached: false,
            answers,
            funnel_variant: variant,
            ...attr,
          }),
          keepalive: true,
        })
          .then((res) => res.json())
          .then((payload) => {
            const id = captureLeadId(payload);
            if (id) setLeadId(id);
          })
          .catch(() => {});
      })
      .finally(() => {
        if (!controller.signal.aborted) setJobsLoading(false);
      });

    return () => controller.abort();
  }, [step.kind, answers, draft, prefillRole]);

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
    if (step.kind === "contact") {
      const name = nameDraft.trim();
      const email = emailDraft.trim().toLowerCase();
      const roleValue = draft.trim();
      if (
        name.length < 2 ||
        !isValidEmail(email) ||
        roleValue.length < 2 ||
        looksLikeMultipleRoles(roleValue)
      ) {
        return;
      }
      const nextAnswers = {
        ...answers,
        name,
        email,
        role: roleValue,
      };
      setAnswers(nextAnswers);
      try {
        sessionStorage.setItem(ROLE_STORAGE_KEY, roleValue);
        sessionStorage.setItem(
          ANSWERS_STORAGE_KEY,
          JSON.stringify(nextAnswers)
        );
      } catch {
        /* ignore */
      }
    }
    if (!isLast) setIndex((prev) => prev + 1);
  }

  function goBack() {
    if (index > 0) setIndex((prev) => prev - 1);
  }

  async function startPaidCheckout() {
    const nextRole =
      (typeof answers.role === "string" && answers.role.trim()) ||
      draft.trim() ||
      prefillRole.trim() ||
      "SEO";
    const email =
      (typeof answers.email === "string" && answers.email.trim()) ||
      emailDraft.trim() ||
      undefined;
    setCheckoutError(null);
    setCheckoutLoading(true);
    try {
      const result = await startCheckout({
        role: nextRole,
        email,
        funnelVariant: feedAb || assignFeedAb(searchParams.get("ab")),
      });
      if ("error" in result) {
        setCheckoutError(result.error);
        return;
      }
      window.location.href = result.checkoutUrl;
    } catch {
      setCheckoutError("Falha ao abrir o pagamento. Tente de novo.");
    } finally {
      setCheckoutLoading(false);
    }
  }

  const hideDefaultHeader =
    step.kind === "matches" || step.kind === "paywall";

  if (step.kind === "matches" && feedAb === "v2") {
    return (
      <FeedConvertV2
        role={role}
        jobs={matches}
        loading={jobsLoading}
        error={jobsError}
        onCheckout={() => void startPaidCheckout()}
        checkoutLoading={checkoutLoading}
        checkoutError={checkoutError}
        email={surveyEmail}
        leadId={leadId}
        funnelVariant={feedAb}
      />
    );
  }

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

          {step.kind === "contact" && (
            <div className="mt-8 space-y-3">
              <input
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                placeholder="Seu nome"
                autoComplete="name"
                className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-4 text-cream outline-none placeholder:text-sand/40 focus:border-lime/60"
              />
              <input
                type="email"
                value={emailDraft}
                onChange={(event) => setEmailDraft(event.target.value)}
                placeholder="Seu e-mail"
                autoComplete="email"
                className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-4 text-cream outline-none placeholder:text-sand/40 focus:border-lime/60"
              />
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Um cargo. Ex.: Recrutamento e seleção"
                autoComplete="organization-title"
                className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-4 text-cream outline-none placeholder:text-sand/40 focus:border-lime/60"
              />
              <RoleChoiceHint
                value={draft}
                onPick={(role) => setDraft(role)}
              />
              {emailDraft.trim() && !isValidEmail(emailDraft) && (
                <p className="text-xs text-sand/55">Informe um e-mail válido.</p>
              )}
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
                  <h1 className="text-center font-[family-name:var(--font-display)] text-[1.85rem] leading-tight font-bold sm:text-4xl">
                    +{moreCount} matches para o seu perfil
                  </h1>
                  <p className="mx-auto mt-3 max-w-sm text-center text-sm text-sand/65">
                    Prévia de vagas remotas para {role}. Candidate-se antes da
                    multidão.
                  </p>

                  <div className="mt-8 space-y-3">
                    {previewJobs.map((job, i) => (
                      <MatchJobCard
                        key={`${job.job_id || i}-${job.title}`}
                        job={job}
                      />
                    ))}

                    {lockedJob && (
                      <button
                        type="button"
                        onClick={goNext}
                        className="w-full text-left"
                      >
                        <MatchJobCard job={lockedJob} locked />
                      </button>
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
                    : [
                        {
                          title: "Vaga remota",
                          company: "Empresa",
                          source: "",
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
                Libere o feed
              </h1>

              <div className="mt-6 space-y-3">
                {RR_PLANS.map((plan) => (
                  <div
                    key={plan.id}
                    className="relative w-full overflow-hidden rounded-2xl border border-lime bg-lime/10 p-4 text-left"
                  >
                    <div className="absolute inset-x-0 top-0 bg-lime py-1 text-center text-[10px] font-extrabold tracking-[0.14em] text-ink uppercase">
                      Pagamento único
                    </div>
                    <div className="flex items-start justify-between gap-3 pt-5">
                      <div>
                        <span className="font-bold text-cream">{plan.name}</span>
                        <p className="mt-1 text-sm text-sand/80">{plan.billed}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {plan.payOptions.map((option) => (
                            <span
                              key={option}
                              className="rounded-full border border-lime/40 px-2 py-0.5 text-[11px] font-semibold text-lime"
                            >
                              {option}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-[family-name:var(--font-display)] text-2xl font-bold">
                          {plan.perMonth}
                        </p>
                        <p className="text-xs text-sand/50">uma vez</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-5 flex items-center justify-center gap-2 text-sm text-sand/70">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-mint text-[11px] font-bold text-ink">
                  ✓
                </span>
                Cartão ou Pix · pagamento único
              </p>
              {checkoutError && (
                <p className="mt-3 text-center text-sm text-red-300">
                  {checkoutError}
                </p>
              )}
              <PaywallFeedbackBlock
                enabled
                blocked={checkoutLoading}
                role={role}
                email={surveyEmail}
                leadId={leadId}
                funnelVariant={feedAb}
              />
            </div>
          )}

          <div className="mt-auto pt-8 pb-4">
            {step.kind === "paywall" ? (
              <button
                type="button"
                disabled={checkoutLoading}
                onClick={() => void startPaidCheckout()}
                className="w-full rounded-full bg-lime py-4 text-center text-base font-bold text-ink transition hover:bg-mint disabled:opacity-50"
              >
                {checkoutLoading
                  ? "Abrindo Mercado Pago…"
                  : "Pagar com cartão ou Pix"}
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
      <PaywallExitSurvey
        enabled={step.kind === "paywall"}
        blocked={checkoutLoading}
        role={role}
        email={surveyEmail}
        leadId={leadId}
        funnelVariant={feedAb}
      />
    </div>
  );
}
