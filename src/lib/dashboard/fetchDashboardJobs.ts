import { dedupeJobs } from "@/lib/dashboard/common";
import { fetchCatho } from "@/lib/dashboard/catho";
import { fetchGoogleDashboard } from "@/lib/dashboard/google";
import { fetchGupy } from "@/lib/dashboard/gupy";
import { fetchIndeed } from "@/lib/dashboard/indeed";
import { fetchInfoJobs } from "@/lib/dashboard/infojobs";
import { fetchLinkedIn } from "@/lib/dashboard/linkedin";
import { fetchProgramathor } from "@/lib/dashboard/programathor";
import { fetchRemotar } from "@/lib/dashboard/remotar";
import type { DashboardJobsPayload, DashboardJob } from "@/lib/dashboard/types";

type Fetcher = {
  name: string;
  run: (term: string) => Promise<DashboardJob[]>;
  /** Se false, pula quando a chave não existe (Indeed). */
  optional?: boolean;
};

const FETCHERS: Fetcher[] = [
  { name: "gupy", run: fetchGupy },
  { name: "remotar", run: fetchRemotar },
  { name: "programathor", run: fetchProgramathor },
  { name: "infojobs", run: fetchInfoJobs },
  { name: "catho", run: fetchCatho },
  { name: "linkedin", run: fetchLinkedIn },
  { name: "indeed", run: fetchIndeed, optional: true },
  { name: "google_vagas", run: fetchGoogleDashboard },
];

async function runOne(
  fetcher: Fetcher,
  term: string
): Promise<{ name: string; jobs: DashboardJob[]; error?: string }> {
  try {
    if (fetcher.optional && !process.env.SCRAPINGBEE_API_KEY) {
      return { name: fetcher.name, jobs: [], error: "skipped: sem SCRAPINGBEE_API_KEY" };
    }
    const jobs = await fetcher.run(term);
    return { name: fetcher.name, jobs };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { name: fetcher.name, jobs: [], error: message };
  }
}

export async function fetchDashboardJobs(
  role: string
): Promise<DashboardJobsPayload> {
  const term = role.trim();
  const results = await Promise.all(FETCHERS.map((f) => runOne(f, term)));

  const sources: Record<string, number | string> = {};
  const merged: DashboardJob[] = [];

  for (const result of results) {
    if (result.error && result.jobs.length === 0) {
      sources[result.name] = `error: ${result.error}`;
    } else {
      sources[result.name] = result.jobs.length;
      if (result.error) {
        sources[`${result.name}_warning`] = result.error;
      }
      merged.push(...result.jobs);
    }
  }

  const jobs = dedupeJobs(merged);
  return {
    role: term,
    count: jobs.length,
    jobs,
    fetched_via: "dashboard_multi",
    sources,
  };
}
