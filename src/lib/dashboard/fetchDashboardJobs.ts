import { dedupeJobs, rankJobsForFeed } from "@/lib/dashboard/common";
import { fetchCatho } from "@/lib/dashboard/catho";
import { fetchGoogleDashboard } from "@/lib/dashboard/google";
import { fetchGupy } from "@/lib/dashboard/gupy";
import { fetchIndeed } from "@/lib/dashboard/indeed";
import { fetchInfoJobs } from "@/lib/dashboard/infojobs";
import { fetchLinkedIn } from "@/lib/dashboard/linkedin";
import { fetchRemotar } from "@/lib/dashboard/remotar";
import { PORTAL_FETCH_LIMIT } from "@/lib/dashboard/limits";
import { filterPortugueseJobs } from "@/lib/dashboard/languageFilter";
import {
  AnalysisLogBuilder,
  BEE_PREMIUM_CREDITS,
  BEE_PREMIUM_JS_CREDITS,
  beeCreditUsd,
} from "@/lib/dashboard/analysisLog";
import {
  buildScrapeReport,
  tagJobsWithMatch,
} from "@/lib/dashboard/scrapeReport";
import { classifyCargoWithLlm } from "@/lib/dashboard/llmJobAnalysis";
import { validateRemoteJobs } from "@/lib/dashboard/validateRemoteJobs";
import type {
  DashboardJobsPayload,
  DashboardJob,
  PortalFetchResult,
} from "@/lib/dashboard/types";

export type FetchDashboardOptions = {
  /** Só para inspeção admin — não roda no fluxo do membro. */
  validate?: boolean;
};

type Fetcher = {
  name: string;
  run: (term: string) => Promise<PortalFetchResult | DashboardJob[]>;
  timeoutMs: number;
  /** Pula se a chave não existe. */
  requiresScrapingBee?: boolean;
  /** Custo estimado Bee por chamada bem-sucedida (créditos). */
  beeCredits?: number;
};

/** Programathor pausado. LinkedIn ativo + filtro PT em todos os scrapes. */
const FETCHERS: Fetcher[] = [
  { name: "gupy", run: fetchGupy, timeoutMs: 12000 },
  { name: "remotar", run: fetchRemotar, timeoutMs: 12000 },
  { name: "infojobs", run: fetchInfoJobs, timeoutMs: 12000 },
  { name: "catho", run: fetchCatho, timeoutMs: 22000 },
  {
    name: "linkedin",
    run: fetchLinkedIn,
    // Bee direto na API guest (1–2 req, sem JS) — guest Vercel é instável
    timeoutMs: 55000,
    requiresScrapingBee: true,
    // ~1–2 páginas premium sem JS
    beeCredits: BEE_PREMIUM_CREDITS * 2,
  },
  {
    name: "indeed",
    run: fetchIndeed,
    timeoutMs: 22000,
    requiresScrapingBee: true,
    beeCredits: BEE_PREMIUM_JS_CREDITS,
  },
  { name: "google_vagas", run: fetchGoogleDashboard, timeoutMs: 55000 },
];

function asPortalResult(
  raw: PortalFetchResult | DashboardJob[]
): PortalFetchResult {
  if (Array.isArray(raw)) return { jobs: raw };
  return raw;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timeout ${ms}ms (${label})`)),
      ms
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function runOne(
  fetcher: Fetcher,
  term: string
): Promise<{
  name: string;
  jobs: DashboardJob[];
  available: number;
  error?: string;
  ms: number;
  cost_usd: number;
  droppedEn: number;
}> {
  const t0 = Date.now();
  try {
    if (fetcher.requiresScrapingBee && !process.env.SCRAPINGBEE_API_KEY) {
      return {
        name: fetcher.name,
        jobs: [],
        available: 0,
        error: "skipped: sem SCRAPINGBEE_API_KEY",
        ms: Date.now() - t0,
        cost_usd: 0,
        droppedEn: 0,
      };
    }
    const raw = await withTimeout(
      fetcher.run(term),
      fetcher.timeoutMs,
      fetcher.name
    );
    const { jobs: all, available } = asPortalResult(raw);
    // Português em todos os portais (principalmente corta inglês do LinkedIn/Remotar).
    const { kept: ptJobs, dropped: droppedEn } = filterPortugueseJobs(all);
    const jobs = ptJobs.slice(0, PORTAL_FETCH_LIMIT);
    const cost_usd =
      jobs.length > 0 && fetcher.beeCredits
        ? beeCreditUsd(fetcher.beeCredits)
        : 0;
    return {
      name: fetcher.name,
      jobs,
      available: Math.max(available ?? 0, all.length),
      ms: Date.now() - t0,
      cost_usd,
      droppedEn,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      name: fetcher.name,
      jobs: [],
      available: 0,
      error: message,
      ms: Date.now() - t0,
      cost_usd: 0,
      droppedEn: 0,
    };
  }
}

export async function fetchDashboardJobs(
  role: string,
  options: FetchDashboardOptions = {}
): Promise<DashboardJobsPayload> {
  const term = role.trim();
  const log = options.validate ? new AnalysisLogBuilder() : null;

  const scrapeStarted = Date.now();
  const results = await Promise.all(FETCHERS.map((f) => runOne(f, term)));
  const scrapeTotalMs = Date.now() - scrapeStarted;

  if (log) {
    let droppedEnTotal = 0;
    for (const r of results) {
      droppedEnTotal += r.droppedEn;
      log.add({
        id: `scrape_${r.name}`,
        label: `Scrape · ${r.name}`,
        ms: r.ms,
        ok: !r.error || r.jobs.length > 0,
        cost_usd: r.cost_usd,
        detail: r.error
          ? `${r.error}${r.jobs.length ? ` · ${r.jobs.length} vagas` : ""}`
          : `${r.jobs.length} vagas PT (cap) · available ${r.available}` +
            (r.droppedEn ? ` · −${r.droppedEn} EN` : ""),
        meta: {
          found: r.jobs.length,
          available: r.available,
          dropped_en: r.droppedEn,
          error: r.error || null,
        },
      });
    }
    if (droppedEnTotal > 0) {
      log.add({
        id: "filter_pt",
        label: "Filtro português",
        ms: 0,
        ok: true,
        detail: `${droppedEnTotal} vagas em inglês removidas (todos os scrapes)`,
        meta: { dropped_en: droppedEnTotal },
      });
    }
    log.add({
      id: "scrape_all",
      label: "Scrapers (paralelo)",
      ms: scrapeTotalMs,
      ok: results.some((r) => r.jobs.length > 0),
      cost_usd: results.reduce((s, r) => s + r.cost_usd, 0),
      detail: `${results.filter((r) => r.jobs.length > 0).length}/${results.length} fontes com vagas`,
    });
  }

  const sources: Record<string, number | string | object> = {};
  const foundByPortal: Record<string, number> = {};
  const availableByPortal: Record<string, number> = {};
  const errorsByPortal: Record<string, string> = {};
  const merged: DashboardJob[] = [];

  for (const result of results) {
    foundByPortal[result.name] = result.jobs.length;
    availableByPortal[result.name] = result.available;
    if (result.error && result.jobs.length === 0) {
      sources[result.name] = `error: ${result.error}`;
      errorsByPortal[result.name] = result.error;
    } else {
      sources[result.name] = result.jobs.length;
      if (result.available > result.jobs.length) {
        sources[`${result.name}_available`] = result.available;
      }
      if (result.error) {
        sources[`${result.name}_warning`] = result.error;
        errorsByPortal[result.name] = result.error;
      }
      const fromRemoteFilter = [
        "catho",
        "gupy",
        "indeed",
        "infojobs",
        "remotar",
        "linkedin",
        "google_vagas",
      ].includes(result.name);
      merged.push(
        ...result.jobs.map((job) => ({
          ...job,
          scrape: result.name,
          source: job.source || result.name,
          from_remote_filter: job.from_remote_filter ?? fromRemoteFilter,
        }))
      );
    }
  }

  let allTagged = tagJobsWithMatch(dedupeJobs(merged), term);

  if (!options.validate) {
    const relevant = rankJobsForFeed(
      allTagged.filter(
        (job) => job.match_tier === "exato" || job.match_tier === "relacionado"
      ),
      term
    );
    const scrape_report = buildScrapeReport({
      foundByPortal,
      availableByPortal,
      errorsByPortal,
      allJobs: allTagged,
      keptJobs: relevant,
    });
    sources._scrape_report = scrape_report;
    return {
      role: term,
      count: relevant.length,
      jobs: relevant,
      fetched_via: "dashboard_multi",
      sources,
      scrape_report,
    };
  }

  const cargoLlm = await log!.timed(
    "llm_cargo",
    "LLM cargo (OpenRouter)",
    () => classifyCargoWithLlm(term, allTagged),
    (r, ms) => ({
      ok: r.usedLlm || !r.error,
      cost_usd: r.cost_usd,
      detail: r.usedLlm
        ? `${r.batches} batch · ${r.prompt_tokens}+${r.completion_tokens} tokens · ${allTagged.length} vagas`
        : r.error || "regras (sem LLM)",
      meta: {
        batches: r.batches,
        prompt_tokens: r.prompt_tokens,
        completion_tokens: r.completion_tokens,
        ms,
      },
    })
  );
  allTagged = cargoLlm.jobs;
  if (cargoLlm.usedLlm) sources._cargo_llm = 1;
  if (cargoLlm.error) sources._cargo_llm_error = cargoLlm.error;

  const relevant = rankJobsForFeed(
    allTagged.filter(
      (job) => job.match_tier === "exato" || job.match_tier === "relacionado"
    ),
    term
  );

  const { jobs, validation, stats } = await validateRemoteJobs(relevant);
  for (const step of stats.steps) log!.add(step);

  const ranked = rankJobsForFeed(jobs, term);
  const analysis_log = log!.build();
  const scrape_report = {
    ...buildScrapeReport({
      foundByPortal,
      availableByPortal,
      errorsByPortal,
      allJobs: allTagged,
      keptJobs: relevant,
      validation,
    }),
    cargo_llm: Boolean(cargoLlm.usedLlm),
    cargo_llm_error: cargoLlm.error || null,
    analysis_log,
  };
  sources._scrape_report = scrape_report;
  sources._validation = validation;

  return {
    role: term,
    count: ranked.length,
    jobs: ranked,
    pulled_jobs: allTagged,
    fetched_via: "dashboard_multi",
    sources,
    validation,
    scrape_report,
  };
}
