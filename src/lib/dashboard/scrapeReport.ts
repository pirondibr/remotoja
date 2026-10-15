import { classifyCargoMatch } from "@/lib/dashboard/jobMatch";
import type {
  DashboardJob,
  PortalScrapeStat,
  ScrapeReport,
  ScrapeSummary,
  ValidationReport,
} from "@/lib/dashboard/types";

export { classifyCargoMatch };

function emptyPortal(portal: string, error?: string | null): PortalScrapeStat {
  return {
    portal,
    found: 0,
    kept: 0,
    exato: 0,
    relacionado: 0,
    fora: 0,
    remotas: 0,
    validas: null,
    checked: 0,
    false_positives: 0,
    invalid_links: 0,
    validated_ok: 0,
    error: error || null,
  };
}

function itemKey(item: {
  title: string;
  company: string;
  scrape?: string | null;
  source: string;
}): string {
  return `${(item.scrape || item.source || "").toLowerCase()}|${item.title}|${item.company}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function tagJobsWithMatch(
  jobs: DashboardJob[],
  term: string
): DashboardJob[] {
  return jobs.map((job) => ({
    ...job,
    match_tier: classifyCargoMatch(job, term),
  }));
}

export function buildScrapeReport(input: {
  foundByPortal: Record<string, number>;
  errorsByPortal: Record<string, string>;
  /** Todas as vagas dedupeadas (já com match_tier). */
  allJobs: DashboardJob[];
  /** Vagas que vão para o feed. */
  keptJobs: DashboardJob[];
  validation?: ValidationReport | null;
}): ScrapeReport {
  const byPortal = new Map<string, PortalScrapeStat>();

  for (const [portal, found] of Object.entries(input.foundByPortal)) {
    byPortal.set(
      portal,
      emptyPortal(portal, input.errorsByPortal[portal] || null)
    );
    const row = byPortal.get(portal)!;
    row.found = found;
  }

  for (const [portal, err] of Object.entries(input.errorsByPortal)) {
    if (!byPortal.has(portal)) byPortal.set(portal, emptyPortal(portal, err));
    else byPortal.get(portal)!.error = err;
  }

  const scrapeKey = (job: DashboardJob) =>
    (job.scrape || job.source || "unknown").toLowerCase();

  for (const job of input.allJobs) {
    const key = scrapeKey(job);
    if (!byPortal.has(key)) byPortal.set(key, emptyPortal(key));
    const row = byPortal.get(key)!;
    const tier = job.match_tier || "fora";
    if (tier === "exato") row.exato += 1;
    else if (tier === "relacionado") row.relacionado += 1;
    else row.fora += 1;
    if (job.remote) row.remotas += 1;
  }

  for (const job of input.keptJobs) {
    const key = scrapeKey(job);
    if (!byPortal.has(key)) byPortal.set(key, emptyPortal(key));
    byPortal.get(key)!.kept += 1;
  }

  const hasAnalysis = Boolean(
    input.validation?.items?.some((i) => i.status !== "skipped")
  );
  const validatedKeys = new Set<string>();

  for (const item of input.validation?.items || []) {
    if (item.status === "skipped") continue;
    const key = (item.scrape || item.source || "unknown").toLowerCase();
    if (!byPortal.has(key)) byPortal.set(key, emptyPortal(key));
    const row = byPortal.get(key)!;
    row.checked += 1;
    if (item.status === "false_positive") row.false_positives += 1;
    else if (item.status === "invalid_link") row.invalid_links += 1;
    else if (item.status === "validated") {
      row.validated_ok += 1;
      validatedKeys.add(itemKey(item));
    }
  }

  // Válidas = no feed (exato/rel) + passou double-check (remoto+link+não FP)
  let validasTotal = 0;
  if (hasAnalysis) {
    for (const row of byPortal.values()) {
      row.validas = 0;
    }
    for (const job of input.keptJobs) {
      const tier = job.match_tier;
      if (tier !== "exato" && tier !== "relacionado") continue;
      const portal = scrapeKey(job);
      const key = itemKey({
        title: job.title,
        company: job.company,
        scrape: job.scrape,
        source: job.source,
      });
      if (!validatedKeys.has(key)) continue;
      validasTotal += 1;
      if (!byPortal.has(portal)) byPortal.set(portal, emptyPortal(portal));
      const row = byPortal.get(portal)!;
      row.validas = (row.validas || 0) + 1;
    }
  }

  const portals = [...byPortal.values()]
    .filter((p) => !p.portal.endsWith("_warning") && p.portal !== "unknown")
    .sort((a, b) => b.found - a.found || a.portal.localeCompare(b.portal));

  let exato = 0;
  let relacionado = 0;
  let fora = 0;
  let remotas = 0;
  for (const job of input.allJobs) {
    const tier = job.match_tier || "fora";
    if (tier === "exato") exato += 1;
    else if (tier === "relacionado") relacionado += 1;
    else fora += 1;
    if (job.remote) remotas += 1;
  }

  const summary: ScrapeSummary = {
    encontradas: input.allJobs.length,
    exato,
    relacionado,
    fora,
    cargo_ok: exato + relacionado,
    remotas,
    no_feed: input.keptJobs.length,
    validas: hasAnalysis ? validasTotal : null,
  };

  return {
    summary,
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
  if (!report.summary) {
    // Relatórios antigos sem summary
    const validasSum = report.portals.reduce(
      (s, p) => s + (typeof p.validas === "number" ? p.validas : p.validated_ok || 0),
      0
    );
    const hadAnalysis = report.portals.some((p) => (p.checked || 0) > 0);
    report.summary = {
      encontradas: report.portals.reduce((s, p) => s + (p.found || 0), 0),
      exato: report.portals.reduce((s, p) => s + (p.exato || 0), 0),
      relacionado: report.portals.reduce((s, p) => s + (p.relacionado || 0), 0),
      fora: report.portals.reduce((s, p) => s + (p.fora || 0), 0),
      cargo_ok: 0,
      remotas: report.portals.reduce((s, p) => s + (p.remotas || 0), 0),
      no_feed: report.portals.reduce((s, p) => s + (p.kept || 0), 0),
      validas: hadAnalysis ? validasSum : null,
    };
    report.summary.cargo_ok =
      report.summary.exato + report.summary.relacionado;
  } else if (report.summary.validas === undefined) {
    const hadAnalysis = report.portals.some((p) => (p.checked || 0) > 0);
    report.summary.validas = hadAnalysis
      ? report.portals.reduce(
          (s, p) =>
            s + (typeof p.validas === "number" ? p.validas : p.validated_ok || 0),
          0
        )
      : null;
  }
  return report;
}
