"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { CompanyAvatar } from "@/components/CompanyAvatar";
import { formatJobAgo, type DemoJob } from "@/lib/demoJobs";
import { termMatches } from "@/lib/dashboard/common";
import { loadJobSession, saveJobSession } from "@/lib/jobSession";
import type { ValidationReport } from "@/lib/dashboard/validateRemoteJobs";
import type { ScrapeReport } from "@/lib/dashboard/types";

function postedLabel(job: DemoJob) {
  return formatJobAgo(job);
}

function formatSource(source: string) {
  const raw = (source || "").trim();
  if (!raw) return "Portal";
  const map: Record<string, string> = {
    google_vagas: "Google Vagas",
    gupy: "Gupy",
    linkedin: "LinkedIn",
    indeed: "Indeed",
    catho: "Catho",
    infojobs: "InfoJobs",
    remotar: "Remotar",
    programathor: "Programathor",
  };
  const key = raw.toLowerCase();
  if (map[key]) return map[key];
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function JobsDashboard() {
  const searchParams = useSearchParams();
  const roleFromUrl = searchParams.get("role") || searchParams.get("q") || "";
  const inspect = searchParams.get("inspect") === "1";
  const modeParam = (searchParams.get("mode") || "").toLowerCase();
  const cacheOnly =
    searchParams.get("cache_only") === "1" || modeParam === "cache";
  const analyze =
    searchParams.get("validate") === "1" || modeParam === "analyze";
  const adminMode = inspect
    ? cacheOnly
      ? "cache"
      : analyze
        ? "analyze"
        : "cache"
    : null;

  const [role, setRole] = useState(roleFromUrl);
  const [draft, setDraft] = useState(roleFromUrl);
  const [jobs, setJobs] = useState<DemoJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [sources, setSources] = useState<Record<string, number | string>>({});
  const [validation, setValidation] = useState<ValidationReport | null>(null);
  const [scrapeReport, setScrapeReport] = useState<ScrapeReport | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const loadJobs = useCallback(
    async (
      nextRole: string,
      preferCache = true,
      signal?: AbortSignal
    ) => {
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
      // Evita flash da pesquisa anterior enquanto a nova carrega
      setJobs([]);
      setSources({});
      setValidation(null);
      setScrapeReport(null);
      setFromCache(false);

      if (preferCache && !inspect && !analyze) {
        const cached = loadJobSession(trimmed);
        if (
          cached &&
          cached.jobs.length > 0 &&
          cached.role.toLowerCase() === trimmed.toLowerCase()
        ) {
          // Descarta sessão antiga misturada com outro cargo
          const relevant = cached.jobs.filter((job) =>
            termMatches(
              `${job.title} ${job.snippet || ""} ${job.company}`,
              trimmed
            )
          );
          if (relevant.length > 0) setJobs(relevant);
        }
      }

      try {
        const params = new URLSearchParams({ role: trimmed });
        if (cacheOnly) {
          params.set("cache_only", "1");
        } else if (analyze) {
          params.set("fresh", "1");
          params.set("validate", "1");
        } else if (!preferCache) {
          params.set("fresh", "1");
        }
        const res = await fetch(`/api/dashboard/jobs?${params}`, { signal });
        if (signal?.aborted) return;
        const data = await res.json();
        const list: DemoJob[] = Array.isArray(data.jobs) ? data.jobs : [];
        setJobs(list);
        setSources(
          data.sources && typeof data.sources === "object" ? data.sources : {}
        );
        setValidation(data.validation || null);
        setScrapeReport(
          data.scrape_report && typeof data.scrape_report === "object"
            ? (data.scrape_report as ScrapeReport)
            : null
        );
        setFromCache(Boolean(data.cached));
        if (!cacheOnly && !analyze) {
          saveJobSession(trimmed, list);
        }
        if (list.length === 0) {
          setError(
            data.error ||
              "Nenhuma vaga encontrada para esse cargo. Tente outro termo."
          );
        }
      } catch (err) {
        if (signal?.aborted) return;
        setError("Falha ao carregar vagas. Tente novamente.");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [inspect, cacheOnly, analyze]
  );

  useEffect(() => {
    const initial = roleFromUrl.trim() || "SEO";
    const controller = new AbortController();
    // Admin cache: só cache. Admin análise: live. Membro: preferCache.
    const preferCache = adminMode === "analyze" ? false : true;
    void loadJobs(initial, preferCache, controller.signal);
    return () => controller.abort();
  }, [roleFromUrl, loadJobs, adminMode]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter(
      (job) =>
        job.title.toLowerCase().includes(q) ||
        job.company.toLowerCase().includes(q) ||
        (job.location || "").toLowerCase().includes(q) ||
        (job.source || "").toLowerCase().includes(q)
    );
  }, [jobs, filter]);

  const sourceBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const job of jobs) {
      const label = formatSource(job.source);
      counts[label] = (counts[label] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [jobs]);

  function onSearch(event: FormEvent) {
    event.preventDefault();
    void loadJobs(draft, false, undefined);
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
              {adminMode === "cache"
                ? "Admin · cache (visão do usuário)"
                : adminMode === "analyze"
                  ? "Admin · análise ao vivo"
                  : "Membro · MVP"}
            </span>
            {inspect ? (
              <Link
                href="/admin"
                className="text-xs font-medium text-moss/70 hover:text-ink"
              >
                ← Admin
              </Link>
            ) : (
              <Link
                href="/final/v2"
                className="text-xs font-medium text-moss/70 hover:text-ink"
              >
                ← Funil teste
              </Link>
            )}
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
              {adminMode === "cache"
                ? "Mesmo feed em cache que o membro vê — sem refazer scrapers."
                : adminMode === "analyze"
                  ? "Busca ao vivo nos portais + double-check de remoto/link."
                  : "Feed com as vagas que encontramos. Cada card mostra o portal de origem."}
            </p>
            {inspect && fromCache && !loading && (
              <p className="mt-1 text-xs font-medium text-forest">
                Servindo do cache pago
              </p>
            )}
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

        {inspect && scrapeReport && scrapeReport.portals.length > 0 && !loading && (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-moss/15 bg-white p-4">
            <p className="text-xs font-semibold tracking-wide text-moss/50 uppercase">
              Scrape por portal
            </p>
            <p className="mt-1 text-[11px] text-moss/55">
              Encontradas = o portal devolveu · Pegamos = entraram no feed após
              filtro · FP só aparece depois da análise
            </p>
            <table className="mt-3 min-w-full text-left text-xs">
              <thead className="text-moss/55 uppercase tracking-wide">
                <tr>
                  <th className="py-1.5 pr-3 font-semibold">Portal</th>
                  <th className="py-1.5 pr-3 font-semibold">Encontradas</th>
                  <th className="py-1.5 pr-3 font-semibold">Pegamos</th>
                  <th className="py-1.5 pr-3 font-semibold">Aproveit.</th>
                  <th className="py-1.5 pr-3 font-semibold">Checadas</th>
                  <th className="py-1.5 pr-3 font-semibold">Falso +</th>
                  <th className="py-1.5 font-semibold">Link ruim</th>
                </tr>
              </thead>
              <tbody>
                {scrapeReport.portals.map((p) => {
                  const rate =
                    p.found > 0
                      ? Math.round((p.kept / p.found) * 100)
                      : null;
                  return (
                    <tr key={p.portal} className="border-t border-moss/10">
                      <td className="py-1.5 pr-3 font-medium">
                        {formatSource(p.portal)}
                      </td>
                      <td className="py-1.5 pr-3">{p.found}</td>
                      <td className="py-1.5 pr-3">{p.kept}</td>
                      <td className="py-1.5 pr-3">
                        {rate != null ? `${rate}%` : "—"}
                      </td>
                      <td className="py-1.5 pr-3">{p.checked || "—"}</td>
                      <td className="py-1.5 pr-3 text-amber-800">
                        {p.checked ? p.false_positives : "—"}
                      </td>
                      <td className="py-1.5 text-red-700">
                        {p.checked ? p.invalid_links : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {inspect && !scrapeReport && sourceBreakdown.length > 0 && !loading && (
          <div className="mt-4 flex flex-wrap gap-2">
            {sourceBreakdown.map(([name, count]) => (
              <span
                key={name}
                className="rounded-full border border-moss/15 bg-white px-3 py-1 text-xs font-medium text-moss"
              >
                {name} · {count}
              </span>
            ))}
          </div>
        )}

        {inspect && validation && (
          <div className="mt-4 rounded-2xl border border-moss/15 bg-white p-4">
            <p className="text-xs font-semibold tracking-wide text-moss/50 uppercase">
              Validação (double-check admin)
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <p className="text-2xl font-bold text-ink">{validation.validated}</p>
                <p className="text-xs text-moss/60">validadas (remoto ok)</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-ink">
                  {validation.false_positives}
                </p>
                <p className="text-xs text-moss/60">falso positivos</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-ink">
                  {validation.invalid_links}
                </p>
                <p className="text-xs text-moss/60">links inválidos</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-ink">{validation.kept}</p>
                <p className="text-xs text-moss/60">exibidas no feed</p>
              </div>
            </div>
            {Object.keys(sources).length > 0 && (
              <p className="mt-3 text-xs text-moss/60">
                Contagem bruta por scraper:{" "}
                <span className="font-medium text-moss">
                  {Object.entries(sources)
                    .filter(([k]) => !k.startsWith("_"))
                    .map(([k, v]) => `${formatSource(k)}=${v}`)
                    .join(" · ")}
                </span>
              </p>
            )}
            {validation.items?.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-moss/70">
                  Detalhe por vaga (portal + status)
                </p>
                <ul className="mt-2 max-h-80 space-y-1.5 overflow-y-auto text-xs text-moss/80">
                  {validation.items
                    .filter((item) => item.status !== "skipped")
                    .map((item, i) => (
                      <li
                        key={`${item.title}-${i}`}
                        className="rounded-lg border border-moss/10 bg-cream/50 px-2.5 py-1.5"
                      >
                        <span
                          className={
                            item.status === "validated"
                              ? "font-semibold text-forest"
                              : item.status === "false_positive"
                                ? "font-semibold text-amber-700"
                                : "font-semibold text-red-700"
                          }
                        >
                          {item.status}
                        </span>
                        {" · "}
                        <span className="font-semibold text-ink">
                          {formatSource(item.source)}
                        </span>
                        {" · "}
                        {item.title}
                        {item.reason ? (
                          <span className="text-moss/55"> · {item.reason}</span>
                        ) : null}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="mt-4">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar nesta lista (título, empresa, portal…)"
            className="w-full rounded-xl border border-moss/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-moss/40"
          />
        </div>

        {loading && (
          <div className="mt-10 rounded-2xl border border-moss/10 bg-white p-10 text-center">
            <p className="font-semibold">
              {adminMode === "analyze"
                ? "Agregando portais e rodando double-check (admin)…"
                : adminMode === "cache"
                  ? "Carregando cache pago…"
                  : "Procurando vagas em diversos portais…"}
            </p>
            <p className="mt-2 text-sm text-moss/60">
              {adminMode === "cache"
                ? "Leitura rápida do que o usuário já viu"
                : "Isso pode levar alguns segundos"}
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
                        <CompanyAvatar
                          company={job.company}
                          logoUrl={job.company_logo}
                        />
                        <div className="min-w-0">
                          <h2 className="text-lg font-semibold leading-snug text-ink">
                            {job.title}
                          </h2>
                          <p className="mt-0.5 text-sm text-moss/70">
                            {job.company}
                          </p>
                          {(job.salary || job.experience || job.education) && (
                            <ul className="mt-2 space-y-0.5 text-sm text-moss/75">
                              {job.salary && <li>{job.salary}</li>}
                              {job.experience && <li>{job.experience}</li>}
                              {job.education && <li>{job.education}</li>}
                            </ul>
                          )}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {inspect && (
                              <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold text-cream">
                                {formatSource(job.source)}
                              </span>
                            )}
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
