import { NextResponse } from "next/server";
import { canOpenPaidFeed, isAccessGateEnabled } from "@/lib/access";
import { fetchDashboardJobs } from "@/lib/dashboard/fetchDashboardJobs";
import {
  getCachedJobs,
  parseCacheKind,
  setCachedJobs,
  type CacheKind,
} from "@/lib/jobCache";
import { sendMetaSearch } from "@/lib/metaCapi";
import { clientIpFromRequest, resolveMetaClickIds } from "@/lib/metaClickIds";
import { searchEventId } from "@/lib/metaPixel";
import { appBaseUrl } from "@/lib/mercadoPago";
import { hasDatabase } from "@/lib/db";
import { rankJobsForFeed } from "@/lib/dashboard/common";
import { classifyCargoMatch } from "@/lib/dashboard/jobMatch";
import { extractScrapeReport } from "@/lib/dashboard/scrapeReport";
import type { DemoJob } from "@/lib/demoJobs";
import type { ValidationReport } from "@/lib/dashboard/validateRemoteJobs";
import type { DashboardJob } from "@/lib/dashboard/types";
import { logPaidMemberView } from "@/lib/paidLeadLog";
import { planRoleSearch, type RoleSearchPlan } from "@/lib/roleRescue";

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

async function firstCachedJobs(kind: CacheKind, plan: RoleSearchPlan) {
  for (const term of plan.attempts) {
    const cached = await getCachedJobs(kind, term);
    if (cached && cached.jobs.length > 0) return cached;
  }
  return null;
}

/** Scrape + LLM cargo + validate remoto; 60s estourava. */
export const maxDuration = 120;

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

function hasValidatedFeed(
  sources: Record<string, number | string | object> | null | undefined
): boolean {
  if (!sources) return false;
  if (sources._validated_feed === 1) return true;
  return Boolean(extractValidation(sources));
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

function buildAnalyzeSources(
  existing: Record<string, number | string | object> | null | undefined,
  payload: Awaited<ReturnType<typeof fetchDashboardJobs>>
): Record<string, number | string | object> {
  const analyzeAt = new Date().toISOString();
  return {
    ...sourcesPlainCounts(existing),
    ...sourcesPlainCounts(payload.sources),
    ...(payload.scrape_report
      ? { _scrape_report: payload.scrape_report }
      : {}),
    ...(payload.validation ? { _validation: payload.validation } : {}),
    _analyze_jobs: payload.jobs,
    ...(payload.pulled_jobs ? { _pulled_jobs: payload.pulled_jobs } : {}),
    _analyze_at: analyzeAt,
    _validated_feed: 1,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const role = (searchParams.get("role") || searchParams.get("q") || "").trim();
  const plan = planRoleSearch(role);
  const openPreview = searchParams.get("preview") === "1";
  const cacheKind: CacheKind = parseCacheKind(
    searchParams.get("script") || searchParams.get("kind") || "paid"
  );
  if (
    isAccessGateEnabled() &&
    !openPreview &&
    cacheKind !== "demo1" &&
    !(await canOpenPaidFeed(role))
  ) {
    return NextResponse.json(
      { error: "Acesso de membro necessário. Conclua o pagamento." },
      { status: 401 }
    );
  }
  const bypassCache = searchParams.get("fresh") === "1";
  /**
   * Admin analyze explícito (logs). Feed pago também valida — ver `runValidate`.
   */
  const analyzeFlag = searchParams.get("validate") === "1";
  /** Admin: só o que o usuário viu — não refaz scrapers. */
  const cacheOnly = searchParams.get("cache_only") === "1";
  const cacheLabel =
    cacheKind === "demo" ? "demo" : cacheKind === "demo1" ? "demo1" : "pago";
  const publicFunnel = cacheKind === "demo1";
  /** Pago e demo1 validam; demo live só se admin pediu analyze. */
  const runValidate = cacheKind === "paid" || cacheKind === "demo1" || analyzeFlag;
  const adminInspect =
    searchParams.get("inspect") === "1" ||
    cacheOnly ||
    analyzeFlag ||
    cacheKind === "demo" ||
    publicFunnel;

  const reply = (body: Record<string, unknown>, jobs: DemoJob[], cached: boolean) => {
    if (!adminInspect && !openPreview && !publicFunnel) {
      void logPaidMemberView({ request, role, jobs, cached });
    }
    if (publicFunnel && role.length >= 2) {
      const clickIds = resolveMetaClickIds({
        cookieHeader: request.headers.get("cookie"),
        fbp: searchParams.get("fbp"),
        fbc: searchParams.get("fbc"),
        fbclid: searchParams.get("fbclid"),
      });
      const eventId =
        searchParams.get("event_id")?.trim() || searchEventId(role);
      void sendMetaSearch({
        eventId,
        searchString: role,
        fbp: clickIds.fbp,
        fbc: clickIds.fbc,
        clientIp: clientIpFromRequest(request),
        userAgent: request.headers.get("user-agent"),
        eventSourceUrl: `${appBaseUrl()}/onboard`,
      }).catch(() => {});
      return NextResponse.json({ ...body, eventId });
    }
    return NextResponse.json(body);
  };

  if (role.length < 2) {
    return NextResponse.json(
      { error: "Informe ?role=SEO (mín. 2 caracteres)" },
      { status: 400 }
    );
  }

  // Feed validado / análise em cache (sem fresh).
  if (runValidate && !bypassCache && hasDatabase()) {
    try {
      const cached = await firstCachedJobs(cacheKind, plan);
      if (
        cached &&
        cached.jobs.length > 0 &&
        hasValidatedFeed(cached.sources)
      ) {
        const validation = extractValidation(cached.sources);
        // Admin analyze precisa do relatório; sem ele, reanalisa.
        if (!analyzeFlag || validation) {
          const analyzeJobs = extractAnalyzeJobs(cached.sources);
          const jobs =
            analyzeJobs ??
            (cacheKind === "demo"
              ? (cached.jobs as DemoJob[])
              : filterByRole(cached.jobs as DemoJob[], plan.primary));
          const pulled_jobs = extractPulledJobs(cached.sources) ?? undefined;
          return reply(
            {
              role,
              count: jobs.length,
              jobs,
              ...(pulled_jobs ? { pulled_jobs } : {}),
              fetched_via: analyzeFlag ? "cache_analyze" : "cache_paid_validated",
              sources: sourcesPlainCounts(cached.sources),
              validation: validation ?? null,
              scrape_report: extractScrapeReport(cached.sources),
              cached: true,
              script: cacheKind,
              cache_updated_at: cached.updated_at,
              analyze_at:
                typeof cached.sources?._analyze_at === "string"
                  ? cached.sources._analyze_at
                  : cached.updated_at,
            },
            jobs,
            true
          );
        }
      }
    } catch {
      // segue para live
    }
  }

  // Cache do demo (sem validate) ou admin cache_only.
  if (cacheOnly || (!bypassCache && !runValidate)) {
    if (hasDatabase()) {
      try {
        const cached = await firstCachedJobs(cacheKind, plan);
        if (cached && cached.jobs.length > 0) {
          const jobs =
            cacheKind === "demo"
              ? (cached.jobs as DemoJob[])
              : filterByRole(cached.jobs as DemoJob[], plan.primary);
          if (
            jobs.length === 0 &&
            !cacheOnly &&
            (cacheKind === "paid" || cacheKind === "demo1")
          ) {
            // Cache antigo misturado → força live (exceto cache_only)
          } else {
            return reply(
              {
                role,
                count: jobs.length,
                jobs,
                fetched_via: cached.fetched_via || `cache_${cacheKind}`,
                sources: sourcesPlainCounts(cached.sources),
                validation: extractValidation(cached.sources),
                scrape_report: extractScrapeReport(cached.sources),
                ...(extractPulledJobs(cached.sources)
                  ? { pulled_jobs: extractPulledJobs(cached.sources) }
                  : {}),
                cached: true,
                script: cacheKind,
                cache_updated_at: cached.updated_at,
              },
              jobs,
              true
            );
          }
        }
        if (cacheOnly) {
          return NextResponse.json({
            role,
            count: 0,
            jobs: [],
            fetched_via: `cache_${cacheKind}`,
            sources: {},
            cached: true,
            script: cacheKind,
            error: `Sem cache ${cacheLabel} para esse cargo ainda. O usuário ainda não gerou feed, ou o cache foi resetado.`,
          });
        }
      } catch {
        if (cacheOnly) {
          return NextResponse.json(
            {
              role,
              count: 0,
              jobs: [],
              error: `Falha ao ler cache ${cacheLabel}`,
              cached: true,
              script: cacheKind,
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
        script: cacheKind,
      });
    }
  }

  try {
    let searchTerm = plan.primary;
    let payload = await fetchDashboardJobs(searchTerm, {
      validate: runValidate,
    });

    if (payload.jobs.length === 0) {
      for (const term of plan.attempts) {
        if (term.toLowerCase() === searchTerm.toLowerCase()) continue;
        payload = await fetchDashboardJobs(term, { validate: runValidate });
        searchTerm = term;
        if (payload.jobs.length > 0) break;
      }
    }

    try {
      if (payload.jobs.length > 0 || payload.validation) {
        const existing = await getCachedJobs(cacheKind, role);
        const sources = runValidate
          ? buildAnalyzeSources(existing?.sources, payload)
          : payload.sources;
        await setCachedJobs({
          kind: cacheKind,
          role,
          jobs: payload.jobs,
          fetched_via: payload.fetched_via,
          sources,
        });
        if (searchTerm !== role) {
          await setCachedJobs({
            kind: cacheKind,
            role: searchTerm,
            jobs: payload.jobs,
            fetched_via: payload.fetched_via,
            sources,
          });
        }
      }
    } catch {
      // ignore cache write
    }

    return reply(
      {
        ...payload,
        sources: sourcesPlainCounts(payload.sources),
        cached: false,
        script: cacheKind,
      },
      payload.jobs as DemoJob[],
      false
    );
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
        script: cacheKind,
      },
      { status: 500 }
    );
  }
}
