"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import type { ValidationReport } from "@/lib/dashboard/validateRemoteJobs";
import type { ScrapeReport } from "@/lib/dashboard/types";

type JobPreview = { title: string; company: string; source?: string };

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
};

type PaidFeed = {
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
};

function portalLabel(key: string) {
  return PORTAL_LABELS[key.toLowerCase()] || key;
}

type SearchesPayload = {
  rows: SearchRow[];
  total: number;
  cache: { demo: number; paid: number };
  paid_feeds?: PaidFeed[];
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

export function AdminDashboard() {
  const [data, setData] = useState<SearchesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [expandedFeed, setExpandedFeed] = useState<string | null>(null);
  const [paidRole, setPaidRole] = useState("SEO");

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

  function openPaidFeed(mode: "cache" | "analyze") {
    const role = paidRole.trim();
    if (role.length < 2) return;
    window.location.href = feedHref(role, mode);
  }

  function feedHref(role: string, mode: "cache" | "analyze") {
    const q = new URLSearchParams({ role, mode });
    return `/api/admin/open-feed?${q}`;
  }

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

      {/* PAID FEED ACCESS */}
      <section className="mt-8 rounded-2xl border border-moss/10 bg-white p-5">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-ink">
          Feed pago (inspeção)
        </h2>
        <p className="mt-1 text-sm text-moss/70">
          <strong>Cache</strong> = o que o membro viu (rápido).{" "}
          <strong>Análise</strong> = busca ao vivo + double-check de
          remoto/link.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={paidRole}
            onChange={(e) => setPaidRole(e.target.value)}
            placeholder="Cargo, ex.: gestor de trafego"
            className="flex-1 rounded-xl border border-moss/15 bg-cream/50 px-4 py-2.5 text-sm outline-none focus:border-moss/40"
          />
          <button
            type="button"
            onClick={() => openPaidFeed("cache")}
            className="rounded-xl border border-moss/20 bg-white px-4 py-2.5 text-sm font-bold text-ink hover:border-moss/40"
          >
            Ver cache
          </button>
          <button
            type="button"
            onClick={() => openPaidFeed("analyze")}
            className="rounded-xl bg-ink px-4 py-2.5 text-sm font-bold text-cream hover:bg-forest"
          >
            Rodar análise
          </button>
        </div>

        {(data?.paid_feeds || []).length > 0 && (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-moss/10 text-xs uppercase tracking-wide text-moss/60">
                <tr>
                  <th className="py-2 pr-3 font-semibold">Cargo</th>
                  <th className="py-2 pr-3 font-semibold">No feed</th>
                  <th className="py-2 pr-3 font-semibold">Scrape</th>
                  <th className="py-2 pr-3 font-semibold">Atualizado</th>
                  <th className="py-2 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {(data?.paid_feeds || []).map((feed) => {
                  const portals = feed.scrape_report?.portals || [];
                  const found = portals.reduce((s, p) => s + p.found, 0);
                  const kept = portals.reduce((s, p) => s + p.kept, 0);
                  const fps = portals.reduce(
                    (s, p) => s + (p.false_positives || 0),
                    0
                  );
                  const open = expandedFeed === feed.role;
                  return (
                    <Fragment key={feed.role}>
                      <tr
                        className="cursor-pointer border-b border-moss/5 hover:bg-cream/40"
                        onClick={() =>
                          setExpandedFeed((r) =>
                            r === feed.role ? null : feed.role
                          )
                        }
                      >
                        <td className="py-2.5 pr-3 font-medium">{feed.role}</td>
                        <td className="py-2.5 pr-3">{feed.jobs_count}</td>
                        <td className="py-2.5 pr-3 text-xs text-moss/70">
                          {portals.length > 0
                            ? `achou ${found} · pegou ${kept}${
                                feed.validation
                                  ? ` · FP ${fps}`
                                  : " · sem análise"
                              }`
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
                              href={feedHref(feed.role, "cache")}
                              className="text-xs font-semibold text-moss hover:underline"
                            >
                              Cache
                            </Link>
                            <Link
                              href={feedHref(feed.role, "analyze")}
                              className="text-xs font-semibold text-forest hover:underline"
                            >
                              Análise
                            </Link>
                          </div>
                        </td>
                      </tr>
                      {open && (
                        <tr className="border-b border-moss/10 bg-cream/50">
                          <td colSpan={5} className="px-3 py-3">
                            <p className="mb-2 text-xs font-semibold text-moss/60">
                              Detalhe por portal —{" "}
                              <span className="font-normal">
                                Encontradas = scraper trouxe · Pegamos = ficaram
                                no feed após filtro · FP = falso positivo na
                                análise
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
                                      Portal
                                    </th>
                                    <th className="py-1.5 pr-3 font-semibold">
                                      Encontradas
                                    </th>
                                    <th className="py-1.5 pr-3 font-semibold">
                                      Pegamos
                                    </th>
                                    <th className="py-1.5 pr-3 font-semibold">
                                      Checadas
                                    </th>
                                    <th className="py-1.5 pr-3 font-semibold">
                                      OK
                                    </th>
                                    <th className="py-1.5 pr-3 font-semibold">
                                      Falso +
                                    </th>
                                    <th className="py-1.5 pr-3 font-semibold">
                                      Link ruim
                                    </th>
                                    <th className="py-1.5 font-semibold">
                                      Aproveit.
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {portals.map((p) => {
                                    const rate =
                                      p.found > 0
                                        ? Math.round((p.kept / p.found) * 100)
                                        : null;
                                    const fpRate =
                                      p.checked > 0
                                        ? Math.round(
                                            (p.false_positives / p.checked) *
                                              100
                                          )
                                        : null;
                                    return (
                                      <tr
                                        key={p.portal}
                                        className="border-t border-moss/10"
                                      >
                                        <td className="py-1.5 pr-3 font-medium text-ink">
                                          {portalLabel(p.portal)}
                                          {p.error ? (
                                            <span className="ml-1 text-amber-700">
                                              (erro)
                                            </span>
                                          ) : null}
                                        </td>
                                        <td className="py-1.5 pr-3">{p.found}</td>
                                        <td className="py-1.5 pr-3">{p.kept}</td>
                                        <td className="py-1.5 pr-3">
                                          {p.checked || "—"}
                                        </td>
                                        <td className="py-1.5 pr-3 text-forest">
                                          {p.validated_ok || "—"}
                                        </td>
                                        <td className="py-1.5 pr-3 text-amber-800">
                                          {p.checked
                                            ? `${p.false_positives}${
                                                fpRate != null
                                                  ? ` (${fpRate}%)`
                                                  : ""
                                              }`
                                            : "—"}
                                        </td>
                                        <td className="py-1.5 pr-3 text-red-700">
                                          {p.checked
                                            ? p.invalid_links
                                            : "—"}
                                        </td>
                                        <td className="py-1.5 text-moss/70">
                                          {rate != null ? `${rate}%` : "—"}
                                          {p.error ? (
                                            <span className="mt-0.5 block text-[10px] text-amber-700">
                                              {p.error.slice(0, 80)}
                                            </span>
                                          ) : null}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
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
              <th className="px-3 py-3 font-semibold">Vagas</th>
              <th className="px-3 py-3 font-semibold">Cache</th>
              <th className="px-3 py-3 font-semibold">Campanha</th>
            </tr>
          </thead>
          <tbody>
            {(data?.rows || []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-moss/50">
                  Nenhuma pesquisa ainda. Abra o funil com UTMs (ex.:
                  ?utm_source=meta&role=SEO).
                </td>
              </tr>
            )}
            {(data?.rows || []).map((row) => (
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
                    <td colSpan={6} className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-moss/60">
                          Vagas mostradas no demo
                        </p>
                        <div
                          className="flex gap-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link
                            href={feedHref(row.role, "cache")}
                            className="text-xs font-semibold text-moss hover:underline"
                          >
                            Ver cache →
                          </Link>
                          <Link
                            href={feedHref(row.role, "analyze")}
                            className="text-xs font-semibold text-forest hover:underline"
                          >
                            Rodar análise →
                          </Link>
                        </div>
                      </div>
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
