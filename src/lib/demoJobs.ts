import demoJobsData from "@/data/demo-jobs.json";

export type DemoJob = {
  title: string;
  company: string;
  location: string;
  source: string;
  source_url?: string | null;
  contract_type?: string | null;
  salary?: string | null;
  experience?: string | null;
  education?: string | null;
  posted?: string | null;
  job_id?: string | null;
  remote?: boolean;
};

export type DemoJobsPayload = {
  query: string;
  location: string;
  fetched_via: string;
  count: number;
  jobs: DemoJob[];
};

export const demoJobsPayload = demoJobsData as DemoJobsPayload;

export function getDemoJobs(limit = 5): DemoJob[] {
  return demoJobsPayload.jobs.slice(0, limit);
}

export function formatJobMeta(job: DemoJob): string {
  const parts = [
    job.remote ? "Remoto" : null,
    job.location,
    job.contract_type,
  ].filter(Boolean);
  return parts.join(" · ");
}

export function formatJobAgo(job: DemoJob): string {
  return job.posted || "Recente";
}

export function formatJobBadge(job: DemoJob): string {
  const source = (job.source || "").trim();
  if (!source) return "Remoto";
  if (/google\s*vagas?/i.test(source)) return "Remoto";
  return source;
}
