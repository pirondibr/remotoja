"use client";

import { Fragment, useCallback, useEffect, useState } from "react";

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

type SearchesPayload = {
  rows: SearchRow[];
  total: number;
  cache: { demo: number; paid: number };
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

      <div className="mt-6 overflow-x-auto rounded-2xl border border-moss/10 bg-white">
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
                    {row.utm_campaign || "—"}
                  </td>
                </tr>
                {expanded === row.id && (
                  <tr className="border-b border-moss/10 bg-cream/40">
                    <td colSpan={6} className="px-4 py-3">
                      <p className="text-xs font-semibold text-moss/60">
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
