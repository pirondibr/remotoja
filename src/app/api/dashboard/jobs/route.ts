import { NextResponse } from "next/server";
import { hasMemberAccess, isAccessGateEnabled } from "@/lib/access";
import { fetchDashboardJobs } from "@/lib/dashboard/fetchDashboardJobs";
import { getCachedJobs, setCachedJobs } from "@/lib/jobCache";
import { hasDatabase } from "@/lib/db";
import { rankJobsForFeed } from "@/lib/dashboard/common";
import { classifyCargoMatch } from "@/lib/dashboard/jobMatch";
import { extractScrapeReport } from "@/lib/dashboard/scrapeReport";
import type { DemoJob } from "@/lib/demoJobs";
import type { ValidationReport } from "@/lib/dashboard/validateRemoteJobs";
import type { DashboardJob } from "@/lib/dashboard/types";

function filterByRole(jobs: DemoJob[], role: string): DemoJob[] {
  const tagged = (jobs as DashboardJob[]).map((job) => ({
    ...job,
    match_tier: job.match_tier || classifyCargoMatch(job, role),
  }));
  const filtered = tagged.filter(
    (job) => job.match_tier === "exato" || job.match_tier === "relacionado"
  );
  return rankJobsForFeed(filtered, role) as DemoJob[];
}

export const maxDuration = 60;

function extractValidation(
  sources: Record<string, number | string | object> | null | undefined
): ValidationReport | undefined {
  const raw = sources?._validation;
  if (!raw || typeof raw !== "object") return undefined;
  return raw as ValidationReport;
}

function extractAnalyzeJobs(
  sources: Record<string, number | string | object> | null | undefined
): DemoJob[] | null {
  const raw = sources?._analyze_jobs;
  if (!Array.isArray(raw)) return null;
  return raw as DemoJob[];
}

function extractPulledJobs(
  sources: Record<string, number | string | object> | null | undefined
): DemoJob[] | null {
  const raw = sources?._pulled_jobs;
  if (!Array.isArray(raw)) return null;
  return raw as DemoJob[];
}

function sourcesPlainCounts(
  sources: Record<string, number | string | object> | null | undefined
): Record<string, number | string> {
  const out: Record<string, number | string> = {};
  if (!sources) return out;
  for (const [key, value] of Object.entries(sources)) {
    if (key.startsWith("_")) continue;
    if (typeof value === "number" || typeof value === "string") {
      out[key] = value;
    }
  }
  return out;
}

export async function GET(request: Request) {
  if (isAccessGateEnabled() && !(await hasMemberAccess())) {
    return NextResponse.json(
      { error: "Acesso de membro necessário. Conclua o pagamento." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const role = (searchParams.get("role") || searchParams.get("q") || "").trim();
  const bypassCache = searchParams.get("fresh") === "1";
  /** Double-check remoto/link: só sob demanda (admin análise). */
  const validate = searchParams.get("validate") === "1";
  /** Admin: só o que o usuário viu — não refaz scrapers. */
  const cacheOnly = searchParams.get("cache_only") === "1";

  if (role.length < 2) {
    return NextResponse.json(
      { error: "Informe ?role=SEO (mín. 2 caracteres)" },
      { status: 400 }
    );
  }

  // Análise salva: validate sem fresh → devolve cache (compartilhável).
  if (validate && !bypassCache && hasDatabase()) {
    try {
      const cached = await getCachedJobs("paid", role);
      const validation = extractValidation(cached?.sources);
      if (cached && validation) {
        const analyzeJobs = extractAnalyzeJobs(cached.sources);
        const jobs =
          analyzeJobs ?? filterByRole(cached.jobs as DemoJob[], role);
        const pulled_jobs = extractPulledJobs(cached.sources) ?? undefined;
        return NextResponse.json({
          role,
          count: jobs.length,
          jobs,
          ...(pulled_jobs ? { pulled_jobs } : {}),
          fetched_via: "cache_analyze",
          sources: sourcesPlainCounts(cached.sources),
          validation,
          scrape_report: extractScrapeReport(cached.sources),
          cached: true,
          cache_updated_at: cached.updated_at,
          analyze_at:
            typeof cached.sources?._analyze_at === "string"
              ? cached.sources._analyze_at
              : cached.updated_at,
        });
      }
    } catch {
      // segue para análise live
    }
  }

  // Cache do membro (sem validate) ou admin cache_only.
  if ((!bypassCache && !validate) || cacheOnly) {
    if (hasDatabase()) {
      try {
        const cached = await getCachedJobs("paid", role);
        if (cached && cached.jobs.length > 0) {
          const jobs = filterByRole(cached.jobs as DemoJob[], role);
          if (jobs.length === 0 && !cacheOnly) {
            // Cache antigo misturado → força live (exceto cache_only)
          } else {
            return NextResponse.json({
              role,
              count: jobs.length,
              jobs,
              fetched_via: cached.fetched_via || "cache_paid",
              sources: sourcesPlainCounts(cached.sources),
              validation: extractValidation(cached.sources),
              scrape_report: extractScrapeReport(cached.sources),
              cached: true,
              cache_updated_at: cached.updated_at,
            });
          }
        }
        if (cacheOnly) {
          return NextResponse.json({
            role,
            count: 0,
            jobs: [],
            fetched_via: "cache_paid",
            sources: {},
            cached: true,
            error: "Sem cache pago para esse cargo ainda. O usuário ainda não gerou feed, ou o cache foi resetado.",
          });
        }
      } catch {
        if (cacheOnly) {
          return NextResponse.json(
            {
              role,
              count: 0,
              jobs: [],
              error: "Falha ao ler cache pago",
              cached: true,
            },
            { status: 500 }
          );
        }
        // segue live
      }
    } else if (cacheOnly) {
      return NextResponse.json({
        role,
        count: 0,
        jobs: [],
        error: "DATABASE_URL não configurada",
        cached: true,
      });
    }
  }

  try {
    const payload = await fetchDashboardJobs(role, { validate });

    try {
      if (!validate && payload.jobs.length > 0) {
        // Feed do membro + métricas de scrape
        await setCachedJobs({
          kind: "paid",
          role,
          jobs: payload.jobs,
          fetched_via: payload.fetched_via,
          sources: payload.sources,
        });
      } else if (validate) {
        // Análise: grava relatório + jobs analisados; não troca o feed do membro
        const existing = await getCachedJobs("paid", role);
        const analyzeAt = new Date().toISOString();
        await setCachedJobs({
          kind: "paid",
          role,
          jobs: existing?.jobs?.length ? existing.jobs : payload.jobs,
          fetched_via: existing?.fetched_via || payload.fetched_via,
          sources: {
            ...sourcesPlainCounts(existing?.sources),
            ...sourcesPlainCounts(payload.sources),
            ...(payload.scrape_report
              ? { _scrape_report: payload.scrape_report }
              : {}),
            ...(payload.validation
              ? { _validation: payload.validation }
              : {}),
            _analyze_jobs: payload.jobs,
            ...(payload.pulled_jobs
              ? { _pulled_jobs: payload.pulled_jobs }
              : {}),
            _analyze_at: analyzeAt,
          },
        });
      }
    } catch {
      // ignore cache write
    }

    return NextResponse.json({
      ...payload,
      sources: sourcesPlainCounts(payload.sources),
      cached: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json(
      {
        role,
        count: 0,
        jobs: [],
        fetched_via: "dashboard_multi",
        sources: {},
        error: message,
        cached: false,
      },
      { status: 500 }
    );
  }
}
