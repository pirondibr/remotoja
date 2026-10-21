import { NextResponse } from "next/server";
import { fetchGoogleJobsByRole } from "@/lib/fetchGoogleJobs";
import { fetchRemotar } from "@/lib/dashboard/remotar";
import { filterJobsByCargo } from "@/lib/dashboard/llmJobAnalysis";
import { roleFitsDemoJob } from "@/lib/dashboard/jobMatch";
import { buildJobsQuery } from "@/lib/buildJobsQuery";
import { getCachedJobs, setCachedJobs } from "@/lib/jobCache";
import { hasDatabase } from "@/lib/db";
import { sendMetaSearch } from "@/lib/metaCapi";
import { clientIpFromRequest, resolveMetaClickIds } from "@/lib/metaClickIds";
import { searchEventId } from "@/lib/metaPixel";
import { appBaseUrl } from "@/lib/mercadoPago";
import {
  isUnfilteredDump,
  planRoleSearch,
} from "@/lib/roleRescue";
import {
  dedupeDemoJobs,
  withDemoFakePosted,
  type DemoJob,
} from "@/lib/demoJobs";

/** Funil mostra 3+1; abaixo disso a prévia parece quebrada. */
const MIN_DEMO_JOBS = 4;

function prepareDemoJobs(jobs: DemoJob[]): DemoJob[] {
  return withDemoFakePosted(dedupeDemoJobs(jobs));
}

export const maxDuration = 60;

function isUsableDemoCache(fetchedVia: string | null | undefined): boolean {
  if (!fetchedVia) return false;
  // Fallback antigo gravava vagas de SEO em qualquer cargo — ignora.
  if (fetchedVia === "fallback_demo") return false;
  return true;
}

/** Cache: regras baratas (já tratam front-end = frontend). Sem LLM em todo pageview. */
function keepMatching(jobs: DemoJob[], term: string): DemoJob[] {
  return jobs.filter((job) => roleFitsDemoJob(job, term));
}

async function fetchRemotarFallback(role: string): Promise<DemoJob[]> {
  try {
    const { jobs, available } = await fetchRemotar(role);
    // Remotar às vezes devolve o feed inteiro — LLM (ou regras) corta o resto.
    const matched = await filterJobsByCargo(role, jobs);
    if (isUnfilteredDump(available ?? 0, matched.length)) return [];
    return matched.slice(0, 12);
  } catch {
    return [];
  }
}

async function searchLive(term: string): Promise<{
  jobs: DemoJob[];
  fetchedVia: string;
  query: string;
  googleError: string | null;
}> {
  let googleError: string | null = null;
  let jobs: DemoJob[] = [];
  let fetchedVia = "error";
  let query = buildJobsQuery(term);

  try {
    const result = await fetchGoogleJobsByRole(term, {
      depth: 20,
      maxAttempts: 14,
      pollMs: 2000,
    });
    jobs = await filterJobsByCargo(term, result.jobs);
    fetchedVia = result.fetched_via;
    query = result.query;
  } catch (error) {
    googleError =
      error instanceof Error ? error.message : "Erro desconhecido no Google Jobs";
  }

  if (jobs.length < MIN_DEMO_JOBS) {
    const extra = await fetchRemotarFallback(term);
    if (extra.length > 0) {
      jobs = dedupeDemoJobs([...jobs, ...extra]);
      fetchedVia =
        jobs.length > extra.length
          ? `${fetchedVia}+remotar`
          : "fallback_remotar";
    }
  }

  return { jobs, fetchedVia, query, googleError };
}

/** Search padrão Meta (CAPI). Não mexe no Purchase / otimização do conjunto. */
function jsonWithSearch(
  request: Request,
  role: string,
  payload: Record<string, unknown>
) {
  const url = new URL(request.url);
  const eventId =
    url.searchParams.get("event_id")?.trim() || searchEventId(role);
  const clickIds = resolveMetaClickIds({
    cookieHeader: request.headers.get("cookie"),
    fbp: url.searchParams.get("fbp"),
    fbc: url.searchParams.get("fbc"),
    fbclid: url.searchParams.get("fbclid"),
  });
  void sendMetaSearch({
    eventId,
    searchString: role,
    fbp: clickIds.fbp,
    fbc: clickIds.fbc,
    clientIp: clientIpFromRequest(request),
    userAgent: request.headers.get("user-agent"),
    eventSourceUrl: `${appBaseUrl()}/onboard`,
  }).catch(() => {});
  return NextResponse.json({ ...payload, eventId });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const role = (searchParams.get("role") || searchParams.get("q") || "").trim();
  const preview = searchParams.get("preview") === "1";
  const bypassCache = searchParams.get("fresh") === "1";
  const plan = planRoleSearch(role);

  if (!role) {
    return NextResponse.json(
      { error: "Informe ?role=programador (ou ?q=...)" },
      { status: 400 }
    );
  }

  if (preview) {
    return NextResponse.json({
      role,
      query: buildJobsQuery(plan.primary),
      search_term: plan.primary,
      note: "preview only",
    });
  }

  if (!bypassCache && hasDatabase()) {
    try {
      for (const term of plan.attempts) {
        const cached = await getCachedJobs("demo", term);
        if (
          !cached ||
          cached.jobs.length === 0 ||
          !isUsableDemoCache(cached.fetched_via)
        ) {
          continue;
        }
        const filtered = keepMatching(cached.jobs as DemoJob[], plan.primary);
        if (filtered.length < MIN_DEMO_JOBS) continue;
        if (filtered.length < (cached.jobs as DemoJob[]).length) {
          void setCachedJobs({
            kind: "demo",
            role: term,
            jobs: filtered,
            fetched_via: cached.fetched_via || "cache_demo",
          }).catch(() => {});
        }
        const jobs = prepareDemoJobs(filtered);
        return jsonWithSearch(request, role, {
          role,
          query: buildJobsQuery(plan.primary),
          count: jobs.length,
          jobs,
          fetched_via: cached.fetched_via || "cache_demo",
          cached: true,
          cache_updated_at: cached.updated_at,
        });
      }
    } catch {
      // segue para busca live se o cache falhar
    }
  }

  let googleError: string | null = null;
  let merged: DemoJob[] = [];
  let fetchedVia = "error";
  let query = buildJobsQuery(plan.primary);

  const first = await searchLive(plan.primary);
  merged = first.jobs;
  fetchedVia = first.fetchedVia;
  query = first.query;
  googleError = first.googleError;

  if (merged.length < MIN_DEMO_JOBS) {
    for (const term of plan.attempts) {
      if (term.toLowerCase() === plan.primary.toLowerCase()) continue;
      const extra = await fetchRemotarFallback(term);
      if (extra.length === 0) continue;
      merged = dedupeDemoJobs([...merged, ...extra]);
      fetchedVia = "rescue_remotar";
      if (merged.length >= MIN_DEMO_JOBS) break;
    }
  }

  if (merged.length === 0) {
    const next = plan.attempts.find(
      (term) => term.toLowerCase() !== plan.primary.toLowerCase()
    );
    if (next) {
      const rescued = await searchLive(next);
      merged = rescued.jobs;
      if (rescued.jobs.length > 0) fetchedVia = "rescue_google";
      query = rescued.query;
      googleError = googleError || rescued.googleError;
    }
  }

  if (merged.length > 0) {
    try {
      await setCachedJobs({
        kind: "demo",
        role,
        jobs: merged,
        fetched_via: fetchedVia,
      });
      if (plan.primary !== role) {
        await setCachedJobs({
          kind: "demo",
          role: plan.primary,
          jobs: merged,
          fetched_via: fetchedVia,
        });
      }
    } catch {
      // ignore
    }
    const jobs = prepareDemoJobs(merged);
    return jsonWithSearch(request, role, {
      role,
      query,
      count: jobs.length,
      jobs,
      fetched_via: fetchedVia,
      cached: false,
    });
  }

  return jsonWithSearch(request, role, {
    role,
    query,
    count: 0,
    jobs: [],
    fetched_via: "error",
    error:
      googleError ||
      `Não encontramos vagas remotas para “${role}” agora. Continue para o feed completo.`,
    cached: false,
  });
}
