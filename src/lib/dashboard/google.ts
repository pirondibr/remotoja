import { fetchGoogleJobsByRole } from "@/lib/fetchGoogleJobs";
import { PORTAL_FETCH_LIMIT_DEEP } from "@/lib/dashboard/limits";
import type { DashboardJob, PortalFetchResult } from "@/lib/dashboard/types";

/**
 * Google Vagas via DataForSEO.
 * depth 40 ≈ +1 página além do 20 (cobrado em blocos de 10).
 */
export async function fetchGoogleDashboard(
  term: string
): Promise<PortalFetchResult> {
  const result = await fetchGoogleJobsByRole(term, {
    depth: 40,
    maxAttempts: 22,
    pollMs: 2500,
    priority: 2,
  });
  const jobs: DashboardJob[] = result.jobs.map((job) => ({
    ...job,
    // Portal exibido = board original (Gupy, LinkedIn…). scrape=google_vagas no merge.
    source: job.source || "Remoto",
    scrape: "google_vagas",
    job_id: job.job_id ? `gjobs-${job.job_id}` : job.job_id,
  }));
  return {
    jobs: jobs.slice(0, PORTAL_FETCH_LIMIT_DEEP),
    available: result.count || jobs.length,
  };
}
