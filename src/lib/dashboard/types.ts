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

/** Métricas por portal para o admin decidir qualidade / corte. */
export type PortalScrapeStat = {
  portal: string;
  /** Vagas que o scraper trouxe (antes do filtro de cargo). */
  found: number;
  /** Vagas que entramos no feed (após filtro de termo + dedupe). */
  kept: number;
  /** Quantas passaram pelo double-check (top N da análise). */
  checked: number;
  false_positives: number;
  invalid_links: number;
  validated_ok: number;
  error?: string | null;
};

export type ScrapeReport = {
  portals: PortalScrapeStat[];
  updated_at: string;
};

export type DashboardJobsPayload = {
  role: string;
  count: number;
  jobs: DashboardJob[];
  fetched_via: "dashboard_multi";
  sources: Record<string, number | string | object>;
  validation?: ValidationReport;
  scrape_report?: ScrapeReport;
};
