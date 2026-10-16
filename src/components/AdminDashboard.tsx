"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Fragment, useCallback, useEffect, useState } from "react";
import type { ValidationReport } from "@/lib/dashboard/validateRemoteJobs";
import type { ScrapeReport } from "@/lib/dashboard/types";

type JobPreview = { title: string; company: string; source?: string };

type FormAnswer = { id: string; label: string; value: string };

type SearchRow = {
  id: string;
  created_at: string;
  role: string;
  channel: string;
  origin: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  jobs_count: number;
  cached: boolean;
  jobs_preview: JobPreview[];
  form_answers?: FormAnswer[];
};

type FeedKind = "demo" | "paid";

type CacheFeed = {
  kind: FeedKind;
  role: string;
  jobs_count: number;
  sources: Record<string, number | string>;
  validation: ValidationReport | null;
  scrape_report: ScrapeReport | null;
  updated_at: string;
  href: string;
};

const PORTAL_LABELS: Record<string, string> = {
  gupy: "Gupy",
  remotar: "Remotar",
  programathor: "Programathor",
  infojobs: "InfoJobs",
  catho: "Catho",
  linkedin: "LinkedIn",
  indeed: "Indeed",
  google_vagas: "Google Vagas",
  jooble: "Jooble",
  glassdoor: "Glassdoor",
  vagas_com: "Vagas.com",
  company_site: "Site da empresa",
};

function portalLabel(key: string) {
  return PORTAL_LABELS[key.toLowerCase()] || key;
}

function sourcesTip(
  sources: Array<{ source: string; count: number }> | undefined
): string {
  if (!sources?.length) return "Sem distribuição de portal";
  return sources
    .map((s) => `${portalLabel(s.source)} ${s.count}`)
    .join(" · ");
}

type SearchesPayload = {
  rows: SearchRow[];
  total: number;
  cache: { demo: number; paid: number };
  feeds?: CacheFeed[];
  /** compat */
  paid_feeds?: CacheFeed[];
  warning?: string;
  error?: string;
};

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

type FeedMode = "cache" | "analyze" | "analyze_fresh" | "clear_analyze";

export function AdminDashboard() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<SearchesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [expandedFeed, setExpandedFeed] = useState<string | null>(null);
  const [inspectRole, setInspectRole] = useState("SEO");
  const [inspectScript, setInspectScript] = useState<FeedKind>("paid");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/searches?limit=50");
      const json = (await res.json()) as SearchesPayload;
      if (!res.ok) {
        setError(json.error || "Falha ao carregar");
        setData(null);
        return;
      }
      setData(json);
    } catch {
      setError("Falha de rede");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const cleared = searchParams.get("cleared_analyze");
    if (cleared) {
      setResetMsg(`Cache de análise limpo para “${cleared}”.`);
    }
  }, [searchParams]);

  async function resetCache(kind: "demo" | "paid") {
    const label = kind === "demo" ? "demo" : "pago";
    if (
      !window.confirm(
        `Resetar cache de vagas do ${label}? A próxima busca busca de novo nas APIs.`
      )
    ) {
      return;
    }
    setResetMsg(null);
    const res = await fetch("/api/admin/cache/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setResetMsg(json.error || "Falha ao resetar");
      return;
    }
    setResetMsg(`Cache ${label} limpo (${json.deleted ?? 0} chaves).`);
    await load();
  }

  function openFeed(mode: FeedMode, kind: FeedKind = inspectScript) {
    const role = inspectRole.trim();
    if (role.length < 2) return;
    window.location.href = feedHref(role, mode, kind);
  }

  function feedHref(role: string, mode: FeedMode, kind: FeedKind = "paid") {
    const q = new URLSearchParams({ role, mode, script: kind });
    return `/api/admin/open-feed?${q}`;
  }

  const feeds: CacheFeed[] =
    data?.feeds ||
    (data?.paid_feeds || []).map((f) => ({
      ...f,
      kind: (f.kind || "paid") as FeedKind,
    }));

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-moss/70">
        Carregando…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-ink">
            Leads & cache
          </h1>
          <p className="mt-1 text-sm text-moss/70">
            {data?.total ?? 0} pesquisas registradas
            {data?.cache
              ? ` · cache demo ${data.cache.demo} · cache pago ${data.cache.paid}`
              : ""}
          </p>
          {data?.warning && (
            <p className="mt-1 text-xs text-amber-800">{data.warning}</p>
          )}
          {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void resetCache("demo")}
            className="rounded-xl border border-moss/20 bg-white px-3 py-2 text-xs font-semibold text-ink hover:border-moss/40"
          >
            Resetar vagas demo
          </button>
          <button
            type="button"
            onClick={() => void resetCache("paid")}
            className="rounded-xl border border-moss/20 bg-white px-3 py-2 text-xs font-semibold text-ink hover:border-moss/40"
          >
            Resetar vagas pago
          </button>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-xl bg-sand px-3 py-2 text-xs font-semibold text-moss hover:bg-mint/40"
          >
            Atualizar
          </button>
        </div>
      </div>

      {resetMsg && (
        <p className="mt-4 rounded-xl bg-mint/30 px-3 py-2 text-xs text-moss">
          {resetMsg}
        </p>
      )}

      {/* FEEDS DEMO + PAGO */}
      <section className="mt-8 rounded-2xl border border-moss/10 bg-white p-5">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-ink">
          Feeds (demo / pago)
        </h2>
        <p className="mt-1 text-sm text-moss/70">
          Consultas em cache do funil <strong>demo</strong> e do script{" "}
          <strong>pago</strong>. <strong>Cache</strong> = o que foi mostrado.{" "}
          <strong>Análise</strong> = scrape + double-check (mesmas métricas nos
          dois). <strong>Reanalisar</strong> tem{" "}
          <code className="text-xs">fresh=1</code> — não compartilhe.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={inspectScript}
            onChange={(e) =>
              setInspectScript(e.target.value === "demo" ? "demo" : "paid")
            }
            className="rounded-xl border border-moss/15 bg-cream/50 px-3 py-2.5 text-sm font-semibold text-ink outline-none focus:border-moss/40"
          >
            <option value="paid">Pago</option>
            <option value="demo">Demo</option>
          </select>
          <input
            value={inspectRole}
            onChange={(e) => setInspectRole(e.target.value)}
            placeholder="Cargo, ex.: gestor de trafego"
            className="flex-1 rounded-xl border border-moss/15 bg-cream/50 px-4 py-2.5 text-sm outline-none focus:border-moss/40"
          />
          <button
            type="button"
            onClick={() => openFeed("cache")}
            className="rounded-xl border border-moss/20 bg-white px-4 py-2.5 text-sm font-bold text-ink hover:border-moss/40"
          >
            Ver cache
          </button>
          <button
            type="button"
            onClick={() => openFeed("analyze")}
            className="rounded-xl bg-ink px-4 py-2.5 text-sm font-bold text-cream hover:bg-forest"
          >
            Ver análise
          </button>
          <button
            type="button"
            onClick={() => openFeed("analyze_fresh")}
            className="rounded-xl border border-moss/20 bg-white px-4 py-2.5 text-sm font-bold text-forest hover:border-forest/40"
          >
            Reanalisar
          </button>
          <button
            type="button"
            onClick={() => openFeed("clear_analyze")}
            className="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-900 hover:border-amber-400"
          >
            Limpar análise
          </button>
        </div>

        {feeds.length > 0 && (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-moss/10 text-xs uppercase tracking-wide text-moss/60">
                <tr>
                  <th className="py-2 pr-3 font-semibold">Demo/Pago</th>
                  <th className="py-2 pr-3 font-semibold">Cargo</th>
                  <th className="py-2 pr-3 font-semibold">No feed</th>
                  <th className="py-2 pr-3 font-semibold">Scrape</th>
                  <th className="py-2 pr-3 font-semibold">Atualizado</th>
                  <th className="py-2 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {feeds.map((feed) => {
                  const portals = feed.scrape_report?.portals || [];
                  const summary = feed.scrape_report?.summary;
                  const fps = portals.reduce(
                    (s, p) => s + (p.false_positives || 0),
                    0
                  );
                  const feedKey = `${feed.kind}:${feed.role}`;
                  const open = expandedFeed === feedKey;
                  return (
                    <Fragment key={feedKey}>
                      <tr
                        className="cursor-pointer border-b border-moss/5 hover:bg-cream/40"
                        onClick={() =>
                          setExpandedFeed((r) =>
                            r === feedKey ? null : feedKey
                          )
                        }
                      >
                        <td className="py-2.5 pr-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                              feed.kind === "demo"
                                ? "bg-sand text-moss"
                                : "bg-forest/15 text-forest"
                            }`}
                          >
                            {feed.kind === "demo" ? "Demo" : "Pago"}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 font-medium">{feed.role}</td>
                        <td className="py-2.5 pr-3">{feed.jobs_count}</td>
                        <td className="py-2.5 pr-3 text-xs text-moss/70">
                          {summary
                            ? `${summary.encontradas} achou · cargo ${summary.exato}/${summary.relacionado}/${summary.fora} · remoto ${summary.remotas}${
                                feed.validation ? ` · FP ${fps}` : ""
                              }`
                            : portals.length > 0
                              ? "relatório antigo — rode análise/cache de novo"
                              : "sem scrape_report ainda"}
                        </td>
                        <td className="py-2.5 pr-3 text-xs text-moss/60">
                          {formatWhen(feed.updated_at)}
                        </td>
                        <td
                          className="py-2.5 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex flex-wrap justify-end gap-3">
                            <Link
                              href={feedHref(feed.role, "cache", feed.kind)}
                              className="text-xs font-semibold text-moss hover:underline"
                            >
                              Cache
                            </Link>
                            <Link
                              href={feedHref(feed.role, "analyze", feed.kind)}
                              className="text-xs font-semibold text-forest hover:underline"
                            >
                              Análise
                              {feed.validation ? " ✓" : ""}
                            </Link>
                            <Link
                              href={feedHref(
                                feed.role,
                                "analyze_fresh",
                                feed.kind
                              )}
                              className="text-xs font-semibold text-ink hover:underline"
                            >
                              Reanalisar
                            </Link>
                            <Link
                              href={feedHref(
                                feed.role,
                                "clear_analyze",
                                feed.kind
                              )}
                              className="text-xs font-semibold text-amber-800 hover:underline"
                            >
                              Limpar análise
                            </Link>
                          </div>
                        </td>
                      </tr>
                      {open && (
                        <tr className="border-b border-moss/10 bg-cream/50">
                          <td colSpan={6} className="px-3 py-3">
                            {summary && (
                              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                                <div className="rounded-xl bg-white px-3 py-2">
                                  <p className="text-lg font-bold text-ink">
                                    {summary.encontradas}
                                  </p>
                                  <p className="text-[11px] text-moss/60">
                                    Vagas encontradas
                                  </p>
                                </div>
                                <div className="rounded-xl bg-white px-3 py-2">
                                  <p className="text-lg font-bold text-ink">
                                    {summary.exato}/{summary.relacionado}/
                                    {summary.fora}
                                  </p>
                                  <p className="text-[11px] text-moss/60">
                                    Cargo (exato / rel. / fora)
                                  </p>
                                </div>
                                <div className="rounded-xl bg-white px-3 py-2">
                                  <p className="text-lg font-bold text-ink">
                                    {summary.remotas}
                                  </p>
                                  <p className="text-[11px] text-moss/60">
                                    Vagas remotas
                                  </p>
                                </div>
                                <div className="rounded-xl bg-white px-3 py-2">
                                  <p className="text-lg font-bold text-forest">
                                    {summary.validas == null
                                      ? "—"
                                      : summary.validas}
                                  </p>
                                  <p className="text-[11px] text-moss/60">
                                    Vagas válidas
                                    {summary.validas == null
                                      ? " (análise)"
                                      : ""}
                                  </p>
                                </div>
                                <div className="rounded-xl bg-white px-3 py-2">
                                  <p className="text-lg font-bold text-ink">
                                    {summary.no_feed}
                                  </p>
                                  <p className="text-[11px] text-moss/60">
                                    No feed
                                  </p>
                                </div>
                              </div>
                            )}
                            <p className="mb-2 text-xs font-semibold text-moss/60">
                              Por scrape —{" "}
                              <span className="font-normal">
                                Portais = origem real (hover no scrape). Válidas
                                = cargo ok + remoto + link ok + não FP (após
                                análise).
                              </span>
                            </p>
                            {portals.length === 0 ? (
                              <p className="text-xs text-moss/50">
                                Ainda sem relatório. Abra o cache (após um fetch
                                novo) ou rode a análise para gerar métricas.
                              </p>
                            ) : (
                              <table className="min-w-full text-left text-xs">
                                <thead className="text-moss/55 uppercase tracking-wide">
                                  <tr>
                                    <th className="py-1.5 pr-3 font-semibold">
                                      Scrape
                                    </th>
                                    <th className="py-1.5 pr-3 font-semibold">
                                      Portais
                                    </th>
                                    <th className="py-1.5 pr-3 font-semibold">
                                      No portal
                                    </th>
                                    <th
                                      className="py-1.5 pr-3 font-semibold"
                                      title="Vagas ingeridas após filtro PT (cap 20; Gupy/Google até 30)"
                                    >
                                      Cap
                                    </th>
                                    <th className="py-1.5 pr-3 font-semibold">
                                      Exato
                                    </th>
                                    <th className="py-1.5 pr-3 font-semibold">
                                      Relac.
                                    </th>
                                    <th className="py-1.5 pr-3 font-semibold">
                                      Fora
                                    </th>
                                    <th className="py-1.5 pr-3 font-semibold">
                                      Remotas
                                    </th>
                                    <th className="py-1.5 pr-3 font-semibold">
                                      No feed
                                    </th>
                                    <th className="py-1.5 pr-3 font-semibold">
                                      Válidas
                                    </th>
                                    <th className="py-1.5 pr-3 font-semibold">
                                      Falso +
                                    </th>
                                    <th className="py-1.5 font-semibold">
                                      Indeciso
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {portals.map((p) => (
                                    <tr
                                      key={p.portal}
                                      className="border-t border-moss/10"
                                    >
                                      <td
                                        className="py-1.5 pr-3 font-medium text-ink"
                                        title={sourcesTip(p.sources)}
                                      >
                                        {portalLabel(p.portal)}
                                        {p.error ? (
                                          <span className="ml-1 text-amber-700">
                                            (erro)
                                          </span>
                                        ) : null}
                                      </td>
                                      <td
                                        className="py-1.5 pr-3 text-moss/80"
                                        title={sourcesTip(p.sources)}
                                      >
                                        {sourcesTip(p.sources)}
                                      </td>
                                      <td className="py-1.5 pr-3 font-medium">
                                        {(
                                          p.available ??
                                          p.found
                                        ).toLocaleString("pt-BR")}
                                      </td>
                                      <td className="py-1.5 pr-3">{p.found}</td>
                                      <td className="py-1.5 pr-3 text-forest">
                                        {p.exato ?? 0}
                                      </td>
                                      <td className="py-1.5 pr-3">
                                        {p.relacionado ?? 0}
                                      </td>
                                      <td className="py-1.5 pr-3 text-amber-800">
                                        {p.fora ?? 0}
                                      </td>
                                      <td className="py-1.5 pr-3">
                                        {p.remotas ?? 0}
                                      </td>
                                      <td className="py-1.5 pr-3">{p.kept}</td>
                                      <td className="py-1.5 pr-3 font-semibold text-forest">
                                        {p.validas == null ? "—" : p.validas}
                                      </td>
                                      <td className="py-1.5 pr-3 text-amber-800">
                                        {p.checked
                                          ? p.false_positives
                                          : "—"}
                                      </td>
                                      <td className="py-1.5 text-stone-700">
                                        {p.checked ? p.indecisos ?? 0 : "—"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                            {(feed.scrape_report?.by_source?.length || 0) >
                              0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                <span className="w-full text-[11px] font-semibold uppercase tracking-wide text-moss/50">
                                  Portal origem (agregado)
                                </span>
                                {feed.scrape_report!.by_source!.map((row) => (
                                  <span
                                    key={row.source}
                                    title={`Scrapes: ${sourcesTip(row.scrapes)}`}
                                    className="rounded-full border border-moss/15 bg-cream px-2.5 py-1 text-[11px] font-medium text-moss"
                                  >
                                    {portalLabel(row.source)} · {row.count}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mt-8 overflow-x-auto rounded-2xl border border-moss/10 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-moss/10 bg-cream/80 text-xs uppercase tracking-wide text-moss/60">
            <tr>
              <th className="px-3 py-3 font-semibold">Quando</th>
              <th className="px-3 py-3 font-semibold">Origem</th>
              <th className="px-3 py-3 font-semibold">Cargo</th>
              <th className="px-3 py-3 font-semibold">Formulário</th>
              <th className="px-3 py-3 font-semibold">Vagas</th>
              <th className="px-3 py-3 font-semibold">Cache</th>
              <th className="px-3 py-3 font-semibold">Campanha</th>
            </tr>
          </thead>
          <tbody>
            {(data?.rows || []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-moss/50">
                  Nenhuma pesquisa ainda. Abra o funil com UTMs (ex.:
                  ?utm_source=meta&role=SEO).
                </td>
              </tr>
            )}
            {(data?.rows || []).map((row) => {
              const form = row.form_answers || [];
              const formShort = form
                .filter((a) => a.id !== "role")
                .slice(0, 2)
                .map((a) => a.value)
                .join(" · ");
              return (
              <Fragment key={row.id}>
                <tr
                  className="cursor-pointer border-b border-moss/5 hover:bg-cream/50"
                  onClick={() =>
                    setExpanded((id) => (id === row.id ? null : row.id))
                  }
                >
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-moss/70">
                    {formatWhen(row.created_at)}
                  </td>
                  <td className="px-3 py-3 font-medium text-ink">{row.origin}</td>
                  <td className="px-3 py-3">{row.role}</td>
                  <td className="max-w-[200px] truncate px-3 py-3 text-xs text-moss/70">
                    {form.length
                      ? formShort || `${form.length} respostas`
                      : "—"}
                  </td>
                  <td className="px-3 py-3">{row.jobs_count}</td>
                  <td className="px-3 py-3 text-xs">
                    {row.cached ? "sim" : "live"}
                  </td>
                  <td className="max-w-[180px] truncate px-3 py-3 text-xs text-moss/60">
                    {row.utm_campaign || "-"}
                  </td>
                </tr>
                {expanded === row.id && (
                  <tr className="border-b border-moss/10 bg-cream/40">
                    <td colSpan={7} className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-moss/60">
                          O que a pessoa preencheu
                        </p>
                        <div
                          className="flex gap-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link
                            href={feedHref(row.role, "cache", "demo")}
                            className="text-xs font-semibold text-moss hover:underline"
                          >
                            Ver cache demo →
                          </Link>
                          <Link
                            href={feedHref(row.role, "analyze", "demo")}
                            className="text-xs font-semibold text-forest hover:underline"
                          >
                            Análise demo →
                          </Link>
                          <Link
                            href={feedHref(row.role, "analyze", "paid")}
                            className="text-xs font-semibold text-ink hover:underline"
                          >
                            Análise pago →
                          </Link>
                        </div>
                      </div>
                      {form.length > 0 ? (
                        <dl className="mt-2 grid gap-1.5 sm:grid-cols-2">
                          {form.map((a) => (
                            <div
                              key={a.id}
                              className="rounded-lg bg-white px-3 py-2 text-sm"
                            >
                              <dt className="text-[11px] font-semibold uppercase tracking-wide text-moss/50">
                                {a.label}
                              </dt>
                              <dd className="mt-0.5 font-medium text-ink">
                                {a.value}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      ) : (
                        <p className="mt-2 text-xs text-moss/50">
                          Sem respostas de formulário (busca rápida / lead
                          antigo).
                        </p>
                      )}
                      <p className="mt-4 text-xs font-semibold text-moss/60">
                        Vagas mostradas no demo
                      </p>
                      <ul className="mt-2 space-y-1 text-sm">
                        {(row.jobs_preview || []).map((job, i) => (
                          <li key={`${row.id}-${i}`}>
                            <span className="font-medium">{job.title}</span>
                            <span className="text-moss/60">
                              {" "}
                              · {job.company}
                              {job.source ? ` · ${job.source}` : ""}
                            </span>
                          </li>
                        ))}
                        {(!row.jobs_preview ||
                          row.jobs_preview.length === 0) && (
                          <li className="text-moss/50">Sem snapshot</li>
                        )}
                      </ul>
                      <p className="mt-2 text-[11px] text-moss/50">
                        {[
                          row.utm_source && `source=${row.utm_source}`,
                          row.utm_medium && `medium=${row.utm_medium}`,
                          row.utm_campaign && `campaign=${row.utm_campaign}`,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Sem UTM"}
                      </p>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
