"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  FUNNEL_STEPS,
  PLANS,
  SAMPLE_MATCHES,
  type FunnelAnswer,
} from "@/lib/funnel";
import { BrandMark } from "./BrandMark";

export function OnboardWizard() {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, FunnelAnswer>>({});
  const [draft, setDraft] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<(typeof PLANS)[number]["id"]>("yearly");

  const step = FUNNEL_STEPS[index];
  const isLast = index === FUNNEL_STEPS.length - 1;

  const canContinue = useMemo(() => {
    if (step.kind === "single" || step.kind === "multi") {
      const value = answers[step.id];
      if (!value) return false;
      return Array.isArray(value) ? value.length > 0 : Boolean(value);
    }
    if (step.kind === "text") {
      return (typeof answers[step.id] === "string" ? answers[step.id] : draft).toString().trim().length > 1;
    }
    return true;
  }, [answers, draft, step]);

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

  const role =
    (typeof answers.role === "string" && answers.role) ||
    draft ||
    "seu cargo";

  return (
    <div className="bg-mesh relative min-h-screen text-cream">
      <div className="bg-grain pointer-events-none absolute inset-0 opacity-40" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-xl flex-col px-5 py-6">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/">
            <BrandMark light size="sm" />
          </Link>
          {index > 0 && (
            <button
              type="button"
              onClick={goBack}
              className="text-sm text-sand/70 transition hover:text-cream"
            >
              Voltar
            </button>
          )}
        </div>

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

        <div key={step.id} className="animate-rise flex flex-1 flex-col">
          <h1 className="font-[family-name:var(--font-display)] text-3xl leading-tight font-bold md:text-4xl">
            {step.kind === "matches"
              ? `Encontramos vagas de ${role}`
              : step.headline}
          </h1>
          {"subheadline" in step && step.subheadline && (
            <p className="mt-3 text-base leading-relaxed text-sand/80">
              {step.subheadline}
            </p>
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
                Amado por quem busca remoto de verdade — sem spam de recrutador.
              </p>
            </div>
          )}

          {step.kind === "value" && (
            <ul className="mt-8 space-y-3">
              {step.bullets?.map((bullet) => (
                <li
                  key={bullet}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sand/90"
                >
                  {bullet}
                </li>
              ))}
            </ul>
          )}

          {(step.kind === "single" || step.kind === "multi") && (
            <div className="mt-8 flex flex-col gap-3">
              {step.options.map((option) => {
                const selected =
                  step.kind === "multi"
                    ? ((answers[step.id] as string[] | undefined) ?? []).includes(option)
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
            <div className="mt-8">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={step.placeholder}
                className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-4 text-cream outline-none placeholder:text-sand/40 focus:border-lime/60"
              />
            </div>
          )}

          {step.kind === "matches" && (
            <div className="mt-8 space-y-3">
              {SAMPLE_MATCHES.map((job) => (
                <article
                  key={job.title}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="rounded-full bg-lime/15 px-2.5 py-0.5 text-xs font-medium text-lime">
                      {job.badge}
                    </span>
                    <span className="text-xs text-sand/50">{job.ago}</span>
                  </div>
                  <h3 className="font-semibold text-cream">{job.title}</h3>
                  <p className="text-sm text-sand/70">{job.company}</p>
                  <p className="mt-1 text-sm text-sand/55">{job.meta}</p>
                </article>
              ))}
              <p className="pt-2 text-center text-sm text-sand/50">
                + dezenas de matches similares no feed completo
              </p>
            </div>
          )}

          {step.kind === "paywall" && (
            <div className="mt-8 space-y-4">
              {PLANS.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    selectedPlan === plan.id
                      ? "border-lime bg-lime/10"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{plan.name}</span>
                        {plan.popular && (
                          <span className="rounded-full bg-lime px-2 py-0.5 text-[10px] font-bold tracking-wide text-ink uppercase">
                            Popular
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-sand/60">{plan.detail}</p>
                      {plan.savings && (
                        <p className="mt-1 text-xs text-mint">{plan.savings}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-[family-name:var(--font-display)] text-2xl font-bold">
                        {plan.priceLabel}
                      </div>
                      <div className="text-xs text-sand/50">{plan.period}</div>
                    </div>
                  </div>
                </button>
              ))}
              {"note" in step && step.note && (
                <p className="text-center text-xs text-sand/50">{step.note}</p>
              )}
            </div>
          )}

          <div className="mt-auto pt-10 pb-4">
            {step.kind === "paywall" ? (
              <button
                type="button"
                onClick={() =>
                  alert(
                    "Checkout em breve — por enquanto o funil e a landing estão no ar. Próximo passo: pagamento + scrapers no Render."
                  )
                }
                className="w-full rounded-full bg-lime py-4 text-center text-base font-bold text-ink transition hover:bg-mint"
              >
                {step.cta}
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
