import type { DemoJob } from "@/lib/demoJobs";

export type DashboardJob = DemoJob & {
  snippet?: string | null;
};

export type SourceResult = {
  source: string;
  jobs: DashboardJob[];
  error?: string;
};

export type ValidationStatus =
  | "validated"
  | "false_positive"
  | "invalid_link"
  | "skipped";

export type ValidationItem = {
  title: string;
  company: string;
  source: string;
  source_url: string | null;
  status: ValidationStatus;
  reason?: string;
};

export type ValidationReport = {
  checked: number;
  validated: number;
  false_positives: number;
  invalid_links: number;
  skipped: number;
  kept: number;
  items: ValidationItem[];
};

export type DashboardJobsPayload = {
  role: string;
  count: number;
  jobs: DashboardJob[];
  fetched_via: "dashboard_multi";
  sources: Record<string, number | string>;
  validation?: ValidationReport;
};
