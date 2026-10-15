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
import type {
  ScrapeReport,
  ValidationItem,
  ValidationStatus,
} from "@/lib/dashboard/types";

type ReviewTab = "feed" | ValidationStatus;

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
  const forceFresh =
    searchParams.get("fresh") === "1" || modeParam === "analyze_fresh";
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
  const [reviewTab, setReviewTab] = useState<ReviewTab>("feed");

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
          params.set("validate", "1");
          // Sem fresh: usa análise salva. Com fresh: reanalisa e sobrescreve.
          if (forceFresh) params.set("fresh", "1");
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
        // Após reanalisar: tira fresh da URL para o link ficar compartilhável (cache).
        if (inspect && analyze && forceFresh && typeof window !== "undefined") {
          const url = new URL(window.location.href);
          if (url.searchParams.has("fresh")) {
            url.searchParams.delete("fresh");
            window.history.replaceState({}, "", url.toString());
          }
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
    [inspect, cacheOnly, analyze, forceFresh]
  );

  useEffect(() => {
    const initial = roleFromUrl.trim() || "SEO";
    const controller = new AbortController();
    // Admin análise: API decide cache vs live (fresh só se forceFresh).
    void loadJobs(initial, true, controller.signal);
    return () => controller.abort();
  }, [roleFromUrl, loadJobs, adminMode, forceFresh]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter(
      (job) =>
        job.title.toLowerCase().includes(q) ||
        job.company.toLowerCase().includes(q) ||
        (job.location || "").toLowerCase().includes(q) ||
        (job.source || "").toLowerCase().includes(q) ||
        (job.scrape || "").toLowerCase().includes(q)
    );
  }, [jobs, filter]);

  const reviewItems = useMemo(() => {
    if (!validation?.items?.length) return [] as ValidationItem[];
    const checked = validation.items.filter((i) => i.status !== "skipped");
    const byTab =
      reviewTab === "feed"
        ? []
        : reviewTab === "skipped"
          ? validation.items.filter((i) => i.status === "skipped")
          : checked.filter((i) => i.status === reviewTab);
    const q = filter.trim().toLowerCase();
    if (!q) return byTab;
    return byTab.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.company.toLowerCase().includes(q) ||
        item.source.toLowerCase().includes(q) ||
        (item.scrape || "").toLowerCase().includes(q) ||
        (item.reason || "").toLowerCase().includes(q)
    );
  }, [validation, reviewTab, filter]);

  const reviewTabs = useMemo(() => {
    if (!validation) return [] as Array<{ id: ReviewTab; label: string; count: number }>;
    const items = validation.items || [];
    const count = (status: ValidationStatus) =>
      items.filter((i) => i.status === status).length;
    return [
      { id: "feed" as const, label: "Feed", count: jobs.length },
      {
        id: "validated" as const,
        label: "Válidas",
        count: count("validated"),
      },
      {
        id: "false_positive" as const,
        label: "Falso +",
        count: count("false_positive"),
      },
      {
        id: "indeciso" as const,
        label: "Indeciso",
        count: count("indeciso"),
      },
      {
        id: "invalid_link" as const,
        label: "Link ruim",
        count: count("invalid_link"),
      },
    ];
  }, [validation, jobs.length]);

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
                  ? forceFresh
                    ? "Admin · reanalisando"
                    : fromCache
                      ? "Admin · análise (cache)"
                      : "Admin · análise"
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
                  ? forceFresh
                    ? "Reanálise ao vivo: scrape + double-check (salva ao terminar)."
                    : "Análise salva — reabre sem refazer scrapers. Use Reanalisar para atualizar."
                  : "Feed com as vagas que encontramos. Cada card mostra o portal de origem."}
            </p>
            {inspect && fromCache && !loading && (
              <p className="mt-1 text-xs font-medium text-forest">
                {adminMode === "analyze"
                  ? "Servindo análise em cache"
                  : "Servindo do cache pago"}
              </p>
            )}
            {inspect && adminMode === "analyze" && !loading && (
              <p className="mt-2 text-[11px] text-moss/60">
                Link compartilhável (sem reanalisar):{" "}
                <a
                  className="font-semibold text-forest underline"
                  href={`/api/admin/open-feed?role=${encodeURIComponent(role)}&mode=analyze`}
                >
                  /api/admin/open-feed?role={role}&mode=analyze
                </a>
                <span className="block mt-0.5 text-amber-800">
                  Não use <code className="text-[10px]">fresh=1</code> — isso
                  força scrape de novo (é o botão Reanalisar).
                </span>
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

        {inspect && scrapeReport && !loading && (
          <div className="mt-4 space-y-3">
            {scrapeReport.summary && (
              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-moss/15 bg-white p-4 sm:grid-cols-5">
                <div>
                  <p className="text-2xl font-bold text-ink">
                    {scrapeReport.summary.encontradas}
                  </p>
                  <p className="text-xs text-moss/60">Vagas encontradas</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-ink">
                    {scrapeReport.summary.cargo_ok}
                  </p>
                  <p className="text-xs text-moss/60">
                    Cargo · {scrapeReport.summary.exato}e /{" "}
                    {scrapeReport.summary.relacionado}r /{" "}
                    {scrapeReport.summary.fora}f
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-ink">
                    {scrapeReport.summary.remotas}
                  </p>
                  <p className="text-xs text-moss/60">Vagas remotas</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-forest">
                    {scrapeReport.summary.validas == null
                      ? "—"
                      : scrapeReport.summary.validas}
                  </p>
                  <p className="text-xs text-moss/60">
                    Vagas válidas
                    {scrapeReport.summary.validas == null
                      ? " (rode análise)"
                      : ""}
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-ink">
                    {scrapeReport.summary.no_feed}
                  </p>
                  <p className="text-xs text-moss/60">No feed</p>
                </div>
              </div>
            )}

            {scrapeReport.portals.length > 0 && (
              <div className="overflow-x-auto rounded-2xl border border-moss/15 bg-white p-4">
                <p className="text-xs font-semibold tracking-wide text-moss/50 uppercase">
                  Scrape por portal
                </p>
                <table className="mt-3 min-w-full text-left text-xs">
                  <thead className="text-moss/55 uppercase tracking-wide">
                    <tr>
                      <th className="py-1.5 pr-3 font-semibold">Scrape</th>
                      <th className="py-1.5 pr-3 font-semibold">No portal</th>
                      <th className="py-1.5 pr-3 font-semibold">Cap 20</th>
                      <th className="py-1.5 pr-3 font-semibold">Exato</th>
                      <th className="py-1.5 pr-3 font-semibold">Relac.</th>
                      <th className="py-1.5 pr-3 font-semibold">Fora</th>
                      <th className="py-1.5 pr-3 font-semibold">Remotas</th>
                      <th className="py-1.5 pr-3 font-semibold">No feed</th>
                      <th className="py-1.5 pr-3 font-semibold">Válidas</th>
                      <th className="py-1.5 pr-3 font-semibold">Falso +</th>
                      <th className="py-1.5 pr-3 font-semibold">Indeciso</th>
                      <th className="py-1.5 font-semibold">Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scrapeReport.portals.map((p) => (
                      <tr key={p.portal} className="border-t border-moss/10">
                        <td className="py-1.5 pr-3 font-medium">
                          {formatSource(p.portal)}
                        </td>
                        <td className="py-1.5 pr-3 font-medium">
                          {(p.available ?? p.found).toLocaleString("pt-BR")}
                        </td>
                        <td className="py-1.5 pr-3">{p.found}</td>
                        <td className="py-1.5 pr-3 text-forest">
                          {p.exato ?? 0}
                        </td>
                        <td className="py-1.5 pr-3">{p.relacionado ?? 0}</td>
                        <td className="py-1.5 pr-3 text-amber-800">
                          {p.fora ?? 0}
                        </td>
                        <td className="py-1.5 pr-3">{p.remotas ?? 0}</td>
                        <td className="py-1.5 pr-3">{p.kept}</td>
                        <td className="py-1.5 pr-3 font-semibold text-forest">
                          {p.validas == null ? "—" : p.validas}
                        </td>
                        <td className="py-1.5 pr-3 text-amber-800">
                          {p.checked ? p.false_positives : "—"}
                        </td>
                        <td className="py-1.5 pr-3 text-stone-700">
                          {p.checked ? p.indecisos ?? 0 : "—"}
                        </td>
                        <td className="py-1.5 text-red-700">
                          {p.checked ? p.invalid_links : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
              Revisão da análise
            </p>
            <p className="mt-1 text-[11px] text-moss/55">
              Use as abas para checar manualmente se a classificação está
              correta. Em Falso + só aparecem as vagas marcadas assim.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {reviewTabs.map((tab) => {
                const active = reviewTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setReviewTab(tab.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? tab.id === "false_positive"
                          ? "bg-amber-700 text-white"
                          : tab.id === "indeciso"
                            ? "bg-stone-600 text-white"
                            : tab.id === "invalid_link"
                              ? "bg-red-700 text-white"
                              : tab.id === "validated"
                                ? "bg-forest text-cream"
                                : "bg-ink text-cream"
                        : "border border-moss/15 bg-cream text-moss hover:border-moss/30"
                    }`}
                  >
                    {tab.label}
                    <span className="ml-1 opacity-80">({tab.count})</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div>
                <p className="text-2xl font-bold text-ink">
                  {validation.validated}
                </p>
                <p className="text-xs text-moss/60">válidas</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-800">
                  {validation.false_positives}
                </p>
                <p className="text-xs text-moss/60">falso positivos</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-stone-700">
                  {validation.indecisos ?? 0}
                </p>
                <p className="text-xs text-moss/60">indecisos</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-700">
                  {validation.invalid_links}
                </p>
                <p className="text-xs text-moss/60">links inválidos</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-ink">{validation.kept}</p>
                <p className="text-xs text-moss/60">ficaram no feed</p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={
              reviewTab === "feed"
                ? "Filtrar nesta lista (título, empresa, portal…)"
                : "Filtrar nesta aba (título, empresa, motivo…)"
            }
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

        {!loading && error && jobs.length === 0 && reviewTab === "feed" && (
          <div className="mt-10 rounded-2xl border border-moss/10 bg-white p-8 text-center text-sm text-moss/70">
            {error}
          </div>
        )}

        {/* Abas de revisão da análise (só as vagas da categoria) */}
        {!loading && reviewTab !== "feed" && (
          <div className="mt-8">
            <p className="mb-3 text-sm font-semibold text-moss">
              {reviewTab === "false_positive"
                ? "Falso positivos — híbrido/presencial ou claramente não remoto"
                : reviewTab === "indeciso"
                  ? "Indecisos — filtro remoto do portal, mas página não deixa claro"
                  : reviewTab === "validated"
                    ? "Válidas — cargo ok + remoto + link"
                    : reviewTab === "invalid_link"
                      ? "Links inválidos / página quebrada"
                      : "Revisão"}
              <span className="ml-2 font-normal text-moss/55">
                {reviewItems.length} vaga
                {reviewItems.length === 1 ? "" : "s"}
              </span>
            </p>
            {reviewItems.length === 0 ? (
              <p className="rounded-2xl border border-moss/10 bg-white p-8 text-center text-sm text-moss/60">
                Nenhuma vaga nesta categoria
                {filter.trim() ? " com esse filtro" : ""}.
              </p>
            ) : (
              <ul className="space-y-3">
                {reviewItems.map((item, index) => {
                  const href = item.source_url || undefined;
                  return (
                    <li key={`${item.status}-${item.title}-${index}`}>
                      <article
                        className={`rounded-2xl border p-4 sm:p-5 ${
                          item.status === "false_positive"
                            ? "border-amber-300 bg-amber-50/80"
                            : item.status === "indeciso"
                              ? "border-stone-300 bg-stone-50/90"
                              : item.status === "invalid_link"
                                ? "border-red-200 bg-red-50/70"
                                : "border-moss/10 bg-white"
                        }`}
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <h2 className="text-lg font-semibold leading-snug text-ink">
                              {item.title}
                            </h2>
                            <p className="mt-0.5 text-sm text-moss/70">
                              {item.company}
                            </p>
                            {item.reason && (
                              <p className="mt-2 text-sm text-moss/80">
                                Motivo: {item.reason}
                              </p>
                            )}
                            <div className="mt-3 flex flex-wrap gap-2">
                              <span
                                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                  item.status === "validated"
                                    ? "bg-forest/15 text-forest"
                                    : item.status === "false_positive"
                                      ? "bg-amber-200 text-amber-950"
                                      : item.status === "indeciso"
                                        ? "bg-stone-200 text-stone-900"
                                        : "bg-red-200 text-red-900"
                                }`}
                              >
                                {item.status === "validated"
                                  ? "Válida"
                                  : item.status === "false_positive"
                                    ? "Falso positivo"
                                    : item.status === "indeciso"
                                      ? "Indeciso"
                                      : "Link inválido"}
                              </span>
                              <span className="rounded-full bg-ink/90 px-2.5 py-1 text-[11px] font-semibold text-cream">
                                Portal · {formatSource(item.source)}
                              </span>
                              <span className="rounded-full border border-moss/20 bg-white px-2.5 py-1 text-[11px] font-semibold text-moss">
                                Scrape ·{" "}
                                {formatSource(item.scrape || item.source)}
                              </span>
                              {item.match_tier && (
                                <span className="rounded-full bg-sand px-2.5 py-1 text-[11px] font-semibold text-moss">
                                  Cargo · {item.match_tier}
                                </span>
                              )}
                            </div>
                          </div>
                          {href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex shrink-0 items-center justify-center rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-cream transition hover:bg-forest"
                            >
                              Abrir vaga →
                            </a>
                          ) : (
                            <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-sand px-5 py-2.5 text-sm font-medium text-moss/50">
                              Sem URL
                            </span>
                          )}
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {!loading && reviewTab === "feed" && visible.length > 0 && (
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
                              <span className="rounded-full bg-ink/90 px-2.5 py-1 text-[11px] font-semibold text-cream">
                                Portal · {formatSource(job.source)}
                              </span>
                            )}
                            {inspect && (
                              <span className="rounded-full border border-moss/20 bg-white px-2.5 py-1 text-[11px] font-semibold text-moss">
                                Scrape ·{" "}
                                {formatSource(job.scrape || job.source)}
                              </span>
                            )}
                            {inspect && job.match_tier && (
                              <span
                                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                  job.match_tier === "exato"
                                    ? "bg-forest/15 text-forest"
                                    : job.match_tier === "relacionado"
                                      ? "bg-sand text-moss"
                                      : "bg-amber-100 text-amber-900"
                                }`}
                              >
                                {job.match_tier === "exato"
                                  ? "Exato"
                                  : job.match_tier === "relacionado"
                                    ? "Relacionado"
                                    : "Fora"}
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

        {!loading &&
          reviewTab === "feed" &&
          jobs.length > 0 &&
          visible.length === 0 && (
            <p className="mt-10 text-center text-sm text-moss/60">
              Nenhum resultado com esse filtro na lista atual.
            </p>
          )}
      </main>
    </div>
  );
}
