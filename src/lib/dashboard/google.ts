import { fetchGoogleJobsByRole } from "@/lib/fetchGoogleJobs";
import type { DashboardJob } from "@/lib/dashboard/types";

/** Google Vagas via DataForSEO (estável no serverless; equivalente ao fallback do worker). */
export async function fetchGoogleDashboard(term: string): Promise<DashboardJob[]> {
  const result = await fetchGoogleJobsByRole(term, { depth: 20 });
  return result.jobs.map((job) => ({
    ...job,
    source: job.source || "google_vagas",
    job_id: job.job_id ? `gjobs-${job.job_id}` : job.job_id,
  }));
}
