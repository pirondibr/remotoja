import { NextResponse } from "next/server";
import { hasMemberAccess, isAccessGateEnabled } from "@/lib/access";
import { fetchDashboardJobs } from "@/lib/dashboard/fetchDashboardJobs";
import { getCachedJobs, setCachedJobs } from "@/lib/jobCache";
import { hasDatabase } from "@/lib/db";
import { rankJobsForFeed, termMatches } from "@/lib/dashboard/common";
import { extractScrapeReport } from "@/lib/dashboard/scrapeReport";
import type { DemoJob } from "@/lib/demoJobs";
import type { ValidationReport } from "@/lib/dashboard/validateRemoteJobs";
import type { DashboardJob } from "@/lib/dashboard/types";

function filterByRole(jobs: DemoJob[], role: string): DemoJob[] {
  const filtered = jobs.filter((job) =>
    termMatches(`${job.title} ${job.snippet || ""} ${job.company}`, role)
  );
  return rankJobsForFeed(filtered as DashboardJob[], role) as DemoJob[];
}

export const maxDuration = 60;

function extractValidation(
  sources: Record<string, number | string | object> | null | undefined
): ValidationReport | undefined {
  const raw = sources?._validation;
  if (!raw || typeof raw !== "object") return undefined;
  return raw as ValidationReport;
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

  // Cache do membro nunca exige validate. Validate sempre busca live.
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
        // Análise: grava relatório sem trocar o feed que o membro vê
        const existing = await getCachedJobs("paid", role);
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
