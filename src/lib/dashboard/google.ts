import { fetchGoogleJobsByRole } from "@/lib/fetchGoogleJobs";
import type { DashboardJob } from "@/lib/dashboard/types";

/** Google Vagas via DataForSEO — poll curto para caber no maxDuration do Vercel. */
export async function fetchGoogleDashboard(term: string): Promise<DashboardJob[]> {
  const result = await fetchGoogleJobsByRole(term, {
    depth: 10,
    maxAttempts: 8,
    pollMs: 2000,
  });
  return result.jobs.map((job) => ({
    ...job,
    // Portal exibido = board original (Gupy, LinkedIn…). scrape=google_vagas no merge.
    source: job.source || "Remoto",
    scrape: "google_vagas",
    job_id: job.job_id ? `gjobs-${job.job_id}` : job.job_id,
  }));
}
