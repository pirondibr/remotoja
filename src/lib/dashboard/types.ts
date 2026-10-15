import type { DemoJob } from "@/lib/demoJobs";

export type DashboardJob = DemoJob & {
  snippet?: string | null;
};

export type SourceResult = {
  source: string;
  jobs: DashboardJob[];
  error?: string;
};

export type DashboardJobsPayload = {
  role: string;
  count: number;
  jobs: DashboardJob[];
  fetched_via: "dashboard_multi";
  sources: Record<string, number | string>;
};
