import type {
  PortalScrapeStat,
  ScrapeReport,
  ValidationReport,
} from "@/lib/dashboard/types";
import type { DashboardJob } from "@/lib/dashboard/types";

export function buildScrapeReport(input: {
  /** Contagem bruta por fetcher (nome do portal). */
  foundByPortal: Record<string, number>;
  /** Erros por portal. */
  errorsByPortal: Record<string, string>;
  /** Jobs que ficaram no feed após filtro. */
  keptJobs: DashboardJob[];
  validation?: ValidationReport | null;
}): ScrapeReport {
  const keptByPortal: Record<string, number> = {};
  for (const job of input.keptJobs) {
    const key = (job.source || "unknown").toLowerCase();
    keptByPortal[key] = (keptByPortal[key] || 0) + 1;
  }

  const checkedBy: Record<string, number> = {};
  const fpBy: Record<string, number> = {};
  const invalidBy: Record<string, number> = {};
  const okBy: Record<string, number> = {};

  for (const item of input.validation?.items || []) {
    if (item.status === "skipped") continue;
    const key = (item.source || "unknown").toLowerCase();
    checkedBy[key] = (checkedBy[key] || 0) + 1;
    if (item.status === "false_positive") {
      fpBy[key] = (fpBy[key] || 0) + 1;
    } else if (item.status === "invalid_link") {
      invalidBy[key] = (invalidBy[key] || 0) + 1;
    } else if (item.status === "validated") {
      okBy[key] = (okBy[key] || 0) + 1;
    }
  }

  const portalKeys = new Set([
    ...Object.keys(input.foundByPortal),
    ...Object.keys(keptByPortal),
    ...Object.keys(checkedBy),
    ...Object.keys(input.errorsByPortal),
  ]);

  const portals: PortalScrapeStat[] = [...portalKeys]
    .filter((p) => !p.endsWith("_warning") && p !== "unknown")
    .map((portal) => ({
      portal,
      found: input.foundByPortal[portal] || 0,
      kept: keptByPortal[portal] || 0,
      checked: checkedBy[portal] || 0,
      false_positives: fpBy[portal] || 0,
      invalid_links: invalidBy[portal] || 0,
      validated_ok: okBy[portal] || 0,
      error: input.errorsByPortal[portal] || null,
    }))
    .sort((a, b) => b.found - a.found || a.portal.localeCompare(b.portal));

  return {
    portals,
    updated_at: new Date().toISOString(),
  };
}

export function extractScrapeReport(
  sources: Record<string, number | string | object> | null | undefined
): ScrapeReport | null {
  const raw = sources?._scrape_report;
  if (!raw || typeof raw !== "object") return null;
  const report = raw as ScrapeReport;
  if (!Array.isArray(report.portals)) return null;
  return report;
}
