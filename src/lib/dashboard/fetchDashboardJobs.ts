import { dedupeJobs, rankJobsForFeed } from "@/lib/dashboard/common";
import { fetchCatho } from "@/lib/dashboard/catho";
import { fetchGoogleDashboard } from "@/lib/dashboard/google";
import { fetchGupy } from "@/lib/dashboard/gupy";
import { fetchIndeed } from "@/lib/dashboard/indeed";
import { fetchInfoJobs } from "@/lib/dashboard/infojobs";
import { fetchLinkedIn } from "@/lib/dashboard/linkedin";
import { fetchProgramathor } from "@/lib/dashboard/programathor";
import { fetchRemotar } from "@/lib/dashboard/remotar";
import {
  buildScrapeReport,
  tagJobsWithMatch,
} from "@/lib/dashboard/scrapeReport";
import { validateRemoteJobs } from "@/lib/dashboard/validateRemoteJobs";
import type { DashboardJobsPayload, DashboardJob } from "@/lib/dashboard/types";

export type FetchDashboardOptions = {
  /** Só para inspeção admin — não roda no fluxo do membro. */
  validate?: boolean;
};

type Fetcher = {
  name: string;
  run: (term: string) => Promise<DashboardJob[]>;
  timeoutMs: number;
  /** Pula se a chave não existe. */
  requiresScrapingBee?: boolean;
};

const FETCHERS: Fetcher[] = [
  { name: "gupy", run: fetchGupy, timeoutMs: 12000 },
  { name: "remotar", run: fetchRemotar, timeoutMs: 12000 },
  { name: "programathor", run: fetchProgramathor, timeoutMs: 12000 },
  { name: "infojobs", run: fetchInfoJobs, timeoutMs: 12000 },
  { name: "catho", run: fetchCatho, timeoutMs: 15000 },
  { name: "linkedin", run: fetchLinkedIn, timeoutMs: 18000 },
  {
    name: "indeed",
    run: fetchIndeed,
    timeoutMs: 22000,
    requiresScrapingBee: true,
  },
  { name: "google_vagas", run: fetchGoogleDashboard, timeoutMs: 22000 },
];

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
): Promise<{ name: string; jobs: DashboardJob[]; error?: string }> {
  try {
    if (fetcher.requiresScrapingBee && !process.env.SCRAPINGBEE_API_KEY) {
      return {
        name: fetcher.name,
        jobs: [],
        error: "skipped: sem SCRAPINGBEE_API_KEY",
      };
    }
    const jobs = await withTimeout(
      fetcher.run(term),
      fetcher.timeoutMs,
      fetcher.name
    );
    return { name: fetcher.name, jobs };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { name: fetcher.name, jobs: [], error: message };
  }
}

export async function fetchDashboardJobs(
  role: string,
  options: FetchDashboardOptions = {}
): Promise<DashboardJobsPayload> {
  const term = role.trim();
  const results = await Promise.all(FETCHERS.map((f) => runOne(f, term)));

  const sources: Record<string, number | string | object> = {};
  const foundByPortal: Record<string, number> = {};
  const errorsByPortal: Record<string, string> = {};
  const merged: DashboardJob[] = [];

  for (const result of results) {
    foundByPortal[result.name] = result.jobs.length;
    if (result.error && result.jobs.length === 0) {
      sources[result.name] = `error: ${result.error}`;
      errorsByPortal[result.name] = result.error;
    } else {
      sources[result.name] = result.jobs.length;
      if (result.error) {
        sources[`${result.name}_warning`] = result.error;
        errorsByPortal[result.name] = result.error;
      }
      // scrape = método; source = portal exibido (Google Vagas pode ser Gupy/LinkedIn/…)
      merged.push(
        ...result.jobs.map((job) => ({
          ...job,
          scrape: result.name,
          source: job.source || result.name,
        }))
      );
    }
  }

  // Dedupe + classifica cargo (exato / relacionado / fora)
  const allTagged = tagJobsWithMatch(dedupeJobs(merged), term);

  // Feed do membro: só cargo exato ou relacionado (fora fica só no relatório)
  const relevant = rankJobsForFeed(
    allTagged.filter(
      (job) => job.match_tier === "exato" || job.match_tier === "relacionado"
    ),
    term
  );

  const scrapeBase = {
    foundByPortal,
    errorsByPortal,
    allJobs: allTagged,
    keptJobs: relevant,
  };

  // Rotina do usuário: só agrega portais. Validação remoto/link é opt-in (admin).
  if (!options.validate) {
    const scrape_report = buildScrapeReport(scrapeBase);
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

  const { jobs, validation } = await validateRemoteJobs(relevant);
  const ranked = rankJobsForFeed(jobs, term);
  const scrape_report = buildScrapeReport({
    ...scrapeBase,
    validation,
  });
  sources._scrape_report = scrape_report;
  sources._validation = validation;

  return {
    role: term,
    count: ranked.length,
    jobs: ranked,
    fetched_via: "dashboard_multi",
    sources,
    validation,
    scrape_report,
  };
}
