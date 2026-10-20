"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { RoleChoiceHint } from "@/components/RoleChoiceHint";
import { looksLikeMultipleRoles } from "@/lib/splitRoles";
import { buildJobsQuery } from "@/lib/buildJobsQuery";
import {
  demoJobsUrl,
  trackSearchFromJobsPayload,
} from "@/lib/fetchDemoJobsClient";
import {
  formatDemoJobAgo,
  formatJobBadge,
  formatJobMeta,
  type DemoJob,
} from "@/lib/demoJobs";

export function QuickJobSearch() {
  const searchParams = useSearchParams();
  const initialRole = searchParams.get("role") || searchParams.get("q") || "";

  const [role, setRole] = useState(initialRole);
  const [jobs, setJobs] = useState<DemoJob[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"live" | "fallback" | null>(null);
  const [searched, setSearched] = useState(false);

  async function runSearch(value: string) {
    const trimmed = value.trim();
    if (trimmed.length < 2) return;
    if (looksLikeMultipleRoles(trimmed)) {
      setRole(trimmed);
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);
    setQuery(buildJobsQuery(trimmed));
    setJobs([]);
    setSource(null);

    try {
      const { url: jobsUrl, eventId: searchId } = demoJobsUrl(trimmed);
      const res = await fetch(jobsUrl);
      const data = await res.json();
      trackSearchFromJobsPayload(trimmed, data, searchId);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only auto-run from URL on mount
  }, []);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void runSearch(role);
  }

  return (
    <div className="bg-mesh relative min-h-screen text-cream">
      <div className="bg-grain pointer-events-none absolute inset-0 opacity-40" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-xl flex-col px-5 py-6">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/">
            <BrandMark light size="sm" />
          </Link>
          <span className="rounded-full border border-lime/30 bg-lime/10 px-3 py-1 text-xs font-semibold tracking-wide text-lime uppercase">
            Teste · /final
          </span>
        </div>

        <h1 className="font-[family-name:var(--font-display)] text-3xl leading-tight font-bold md:text-4xl">
          Busca rápida de vagas remotas
        </h1>
        <p className="mt-3 text-base text-sand/75">
          Sem questionário. Digite o cargo e pesquise — ideal para testes.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-3">
          <input
            value={role}
            onChange={(event) => setRole(event.target.value)}
            placeholder="Um cargo. Ex.: Recrutamento e seleção"
            className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-4 text-cream outline-none placeholder:text-sand/40 focus:border-lime/60"
            autoFocus
          />
          <RoleChoiceHint
            value={role}
            onPick={(picked) => {
              setRole(picked);
              void runSearch(picked);
            }}
          />
          {role.trim().length > 1 && !looksLikeMultipleRoles(role) && (
            <p className="text-xs text-sand/50">
              Query:{" "}
              <span className="text-lime">{buildJobsQuery(role)}</span>
            </p>
          )}
          <button
            type="submit"
            disabled={loading || role.trim().length < 2}
            className="w-full rounded-full bg-lime py-4 text-base font-bold text-ink transition hover:bg-mint disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Buscando…" : "Pesquisar vagas"}
          </button>
        </form>

        <div className="mt-8 flex flex-wrap gap-2">
          {["programador", "SEO", "designer", "customer success"].map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => {
                setRole(chip);
                void runSearch(chip);
              }}
              disabled={loading}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-sand/80 transition hover:border-lime/40 hover:text-cream disabled:opacity-40"
            >
              {chip}
            </button>
          ))}
        </div>

        <div className="mt-10 flex-1 space-y-3 pb-8">
          {loading && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
              <p className="font-medium">Buscando vagas remotas…</p>
              <p className="mt-2 text-sm text-sand/60">{query}</p>
              <p className="mt-1 text-xs text-sand/45">Leva ~10–30s</p>
            </div>
          )}

          {!loading && searched && (
            <>
              <div className="mb-2 flex items-center justify-between text-sm text-sand/55">
                <span>
                  {jobs.length} resultado{jobs.length === 1 ? "" : "s"}
                  {query ? ` · “${query}”` : ""}
                </span>
                {source && (
                  <span className={source === "live" ? "text-mint" : "text-sand/40"}>
                    {source === "live" ? "ao vivo" : "fallback"}
                  </span>
                )}
              </div>

              {jobs.map((job) => (
                <article
                  key={`${job.company}-${job.title}-${job.job_id || job.source}`}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="rounded-full bg-lime/15 px-2.5 py-0.5 text-xs font-medium text-lime">
                      {formatJobBadge(job)}
                    </span>
                    <span className="text-xs text-sand/50">
                      {formatDemoJobAgo(job)}
                    </span>
                  </div>
                  <h2 className="font-semibold text-cream">{job.title}</h2>
                  <p className="text-sm text-sand/70">{job.company}</p>
                  <p className="mt-1 text-sm text-sand/55">{formatJobMeta(job)}</p>
                  {job.source_url && (
                    <a
                      href={job.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-block text-sm font-medium text-lime hover:text-mint"
                    >
                      Ver vaga →
                    </a>
                  )}
                </article>
              ))}

              {jobs.length === 0 && (
                <p className="text-center text-sm text-sand/50">
                  Nenhuma vaga encontrada para essa busca.
                </p>
              )}

              {error && source === "fallback" && (
                <p className="text-center text-xs text-sand/40">{error}</p>
              )}
            </>
          )}
        </div>

        <p className="pb-4 text-center text-xs text-sand/40">
          Atalho de teste ·{" "}
          <Link href="/final/v2" className="underline hover:text-sand/70">
            v2 estilo RR
          </Link>
          {" · "}
          <Link href="/onboard" className="underline hover:text-sand/70">
            funil
          </Link>
          {" · "}
          <span className="text-sand/50">/final?role=programador</span>
        </p>
      </div>
    </div>
  );
}
