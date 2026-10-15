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
  | "indeciso"
  | "invalid_link"
  | "skipped";

export type ValidationItem = {
  title: string;
  company: string;
  source: string;
  scrape?: string | null;
  match_tier?: "exato" | "relacionado" | "fora" | null;
  source_url: string | null;
  status: ValidationStatus;
  reason?: string;
};

export type ValidationReport = {
  checked: number;
  validated: number;
  false_positives: number;
  indecisos: number;
  invalid_links: number;
  skipped: number;
  kept: number;
  items: ValidationItem[];
};

/** Resultado de um scraper de portal (antes do cap global). */
export type PortalFetchResult = {
  jobs: DashboardJob[];
  /** Total reportado pelo portal (pode ser >> jobs.length). */
  available?: number;
};

/** Métricas por portal para o admin decidir qualidade / corte. */
export type PortalScrapeStat = {
  portal: string;
  /**
   * Total no portal (ex.: 11.000 na Catho).
   * Se o portal não informar, cai para `found`.
   */
  available: number;
  /** Vagas que ingerimos neste scrape (cap por portal, antes do filtro de cargo). */
  found: number;
  /** Vagas que entramos no feed (após filtro de termo + dedupe). */
  kept: number;
  exato: number;
  relacionado: number;
  fora: number;
  remotas: number;
  /**
   * Cargo exato/relacionado + remoto + link ok + não FP.
   * Só preenchido após análise (double-check); senão null.
   */
  validas: number | null;
  /** Quantas passaram pelo double-check (top N da análise). */
  checked: number;
  false_positives: number;
  indecisos: number;
  invalid_links: number;
  validated_ok: number;
  error?: string | null;
};

export type ScrapeSummary = {
  /** Total após dedupe (todas as portas). */
  encontradas: number;
  exato: number;
  relacionado: number;
  fora: number;
  /** Soma exato + relacionado (cargo utilizável). */
  cargo_ok: number;
  remotas: number;
  /** Entraram no feed do membro (hoje: não-fora). */
  no_feed: number;
  /** Válidas (cargo ok + remoto + link + não FP). null sem análise. */
  validas: number | null;
};

export type ScrapeReport = {
  summary: ScrapeSummary;
  portals: PortalScrapeStat[];
  updated_at: string;
  /** Análise de cargo usou OpenRouter (admin). */
  cargo_llm?: boolean;
  cargo_llm_error?: string | null;
};

export type DashboardJobsPayload = {
  role: string;
  count: number;
  jobs: DashboardJob[];
  /**
   * Todas as vagas ingeridas (cap por portal), com match_tier — inclusive "fora".
   * Só no fluxo de análise admin, para revisão manual por portal.
   */
  pulled_jobs?: DashboardJob[];
  fetched_via: "dashboard_multi";
  sources: Record<string, number | string | object>;
  validation?: ValidationReport;
  scrape_report?: ScrapeReport;
};
