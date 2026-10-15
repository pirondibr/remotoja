"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import type { DemoJob } from "@/lib/demoJobs";
import { loadJobSession, saveJobSession } from "@/lib/jobSession";

function companyInitial(name: string) {
  return (name.trim()[0] || "?").toUpperCase();
}

function postedLabel(job: DemoJob) {
  return job.posted || "Recente";
}

export function JobsDashboard() {
  const searchParams = useSearchParams();
  const roleFromUrl = searchParams.get("role") || searchParams.get("q") || "";

  const [role, setRole] = useState(roleFromUrl);
  const [draft, setDraft] = useState(roleFromUrl);
  const [jobs, setJobs] = useState<DemoJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const loadJobs = useCallback(async (nextRole: string, preferCache = true) => {
    const trimmed = nextRole.trim();
    if (trimmed.length < 2) {
      setLoading(false);
      setError("Informe um cargo para buscar vagas.");
      return;
    }

    setLoading(true);
    setError(null);
    setRole(trimmed);
    setDraft(trimmed);

    if (preferCache) {
      const cached = loadJobSession(trimmed);
      if (cached && cached.jobs.length > 0) {
        setJobs(cached.jobs);
        setLoading(false);
        return;
      }
    }

    try {
      const res = await fetch(`/api/jobs?role=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      const list: DemoJob[] = Array.isArray(data.jobs) ? data.jobs : [];
      setJobs(list);
      saveJobSession(trimmed, list);
      if (list.length === 0) {
        setError("Nenhuma vaga encontrada para esse cargo. Tente outro termo.");
      }
    } catch {
      setError("Falha ao carregar vagas. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = roleFromUrl.trim() || "SEO";
    void loadJobs(initial, true);
  }, [roleFromUrl, loadJobs]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter(
      (job) =>
        job.title.toLowerCase().includes(q) ||
        job.company.toLowerCase().includes(q) ||
        (job.location || "").toLowerCase().includes(q)
    );
  }, [jobs, filter]);

  function onSearch(event: FormEvent) {
    event.preventDefault();
    void loadJobs(draft, false);
  }

  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="sticky top-0 z-20 border-b border-moss/10 bg-cream/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/">
            <BrandMark size="sm" />
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-mint/30 px-2.5 py-1 text-[11px] font-semibold text-moss sm:inline">
              Membro · MVP
            </span>
            <Link
              href="/final/v2"
              className="text-xs font-medium text-moss/70 hover:text-ink"
            >
              ← Funil teste
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-moss/60">Seu portal</p>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight sm:text-4xl">
              Vagas para{" "}
              <span className="text-moss">{role || "seu cargo"}</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm text-moss/70">
              Feed com as vagas que encontramos. Clique em candidatar para abrir
              a página da empresa.
            </p>
          </div>
          {!loading && (
            <p className="text-sm font-semibold text-moss">
              {jobs.length} vaga{jobs.length === 1 ? "" : "s"}
            </p>
          )}
        </div>

        <form
          onSubmit={onSearch}
          className="mt-6 flex flex-col gap-2 rounded-2xl border border-moss/10 bg-white p-3 sm:flex-row sm:items-center"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Buscar outro cargo…"
            className="flex-1 rounded-xl border border-moss/10 bg-cream/60 px-4 py-3 text-sm outline-none focus:border-moss/40"
          />
          <button
            type="submit"
            disabled={loading || draft.trim().length < 2}
            className="rounded-xl bg-ink px-5 py-3 text-sm font-bold text-cream transition hover:bg-forest disabled:opacity-40"
          >
            {loading ? "Buscando…" : "Atualizar feed"}
          </button>
        </form>

        <div className="mt-4">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar nesta lista (título, empresa…)"
            className="w-full rounded-xl border border-moss/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-moss/40"
          />
        </div>

        {loading && (
          <div className="mt-10 rounded-2xl border border-moss/10 bg-white p-10 text-center">
            <p className="font-semibold">
              Procurando vagas em diversos portais e empresas…
            </p>
            <p className="mt-2 text-sm text-moss/60">
              Isso pode levar alguns segundos
            </p>
          </div>
        )}

        {!loading && error && jobs.length === 0 && (
          <div className="mt-10 rounded-2xl border border-moss/10 bg-white p-8 text-center text-sm text-moss/70">
            {error}
          </div>
        )}

        {!loading && visible.length > 0 && (
          <ul className="mt-8 space-y-3">
            {visible.map((job, index) => {
              const href = job.source_url || undefined;
              const notOnLinkedIn = !job.source
                .toLowerCase()
                .includes("linkedin");

              return (
                <li key={`${job.job_id || index}-${job.title}-${job.company}`}>
                  <article className="rounded-2xl border border-moss/10 bg-white p-4 transition hover:border-moss/25 sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forest text-sm font-bold text-lime">
                          {companyInitial(job.company)}
                        </div>
                        <div className="min-w-0">
                          <h2 className="text-lg font-semibold leading-snug text-ink">
                            {job.title}
                          </h2>
                          <p className="mt-0.5 text-sm text-moss/70">
                            {job.company}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {notOnLinkedIn && (
                              <span className="rounded-full bg-lime/25 px-2.5 py-1 text-[11px] font-semibold text-moss">
                                Fora do LinkedIn
                              </span>
                            )}
                            <span className="rounded-full bg-sand px-2.5 py-1 text-[11px] text-moss/80">
                              {postedLabel(job)}
                            </span>
                            <span className="rounded-full bg-sand px-2.5 py-1 text-[11px] text-moss/80">
                              100% remoto
                            </span>
                            {job.location && (
                              <span className="rounded-full bg-sand px-2.5 py-1 text-[11px] text-moss/80">
                                {job.location}
                              </span>
                            )}
                            {job.contract_type && (
                              <span className="rounded-full bg-sand px-2.5 py-1 text-[11px] text-moss/80">
                                {job.contract_type}
                              </span>
                            )}
                            {job.salary && (
                              <span className="rounded-full bg-sand px-2.5 py-1 text-[11px] font-medium text-moss">
                                {job.salary}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex shrink-0 items-center justify-center rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-cream transition hover:bg-forest"
                        >
                          Candidatar-se →
                        </a>
                      ) : (
                        <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-sand px-5 py-2.5 text-sm font-medium text-moss/50">
                          Link indisponível
                        </span>
                      )}
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}

        {!loading && jobs.length > 0 && visible.length === 0 && (
          <p className="mt-10 text-center text-sm text-moss/60">
            Nenhum resultado com esse filtro na lista atual.
          </p>
        )}
      </main>
    </div>
  );
}
