import { NextResponse } from "next/server";
import { fetchGoogleJobsByRole } from "@/lib/fetchGoogleJobs";
import { fetchRemotar } from "@/lib/dashboard/remotar";
import { roleFitsDemoJob } from "@/lib/dashboard/jobMatch";
import { buildJobsQuery } from "@/lib/buildJobsQuery";
import { getCachedJobs, setCachedJobs } from "@/lib/jobCache";
import { hasDatabase } from "@/lib/db";
import { sendMetaSearch } from "@/lib/metaCapi";
import { searchEventId } from "@/lib/metaPixel";
import { appBaseUrl } from "@/lib/mercadoPago";
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

async function fetchRemotarFallback(role: string): Promise<DemoJob[]> {
  try {
    const { jobs } = await fetchRemotar(role);
    return jobs.filter((job) => roleFitsDemoJob(job, role)).slice(0, 12);
  } catch {
    return [];
  }
}

function clientIp(request: Request): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || undefined;
  return request.headers.get("x-real-ip")?.trim() || undefined;
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
  void sendMetaSearch({
    eventId,
    searchString: role,
    fbp: url.searchParams.get("fbp"),
    fbc: url.searchParams.get("fbc"),
    clientIp: clientIp(request),
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

  if (!role) {
    return NextResponse.json(
      { error: "Informe ?role=programador (ou ?q=...)" },
      { status: 400 }
    );
  }

  if (preview) {
    return NextResponse.json({
      role,
      query: buildJobsQuery(role),
      note: "preview only",
    });
  }

  if (!bypassCache && hasDatabase()) {
    try {
      const cached = await getCachedJobs("demo", role);
      if (
        cached &&
        cached.jobs.length > 0 &&
        isUsableDemoCache(cached.fetched_via)
      ) {
        // Reaplica filtro de cargo (cache antigo podia ter Full Stack em busca SEO)
        const filtered = (cached.jobs as DemoJob[]).filter((job) =>
          roleFitsDemoJob(job, role)
        );
        if (filtered.length < MIN_DEMO_JOBS) {
          // Poucas vagas / cache antigo estreito → busca live e completa
        } else {
          const jobs = prepareDemoJobs(filtered);
          return jsonWithSearch(request, role, {
            role,
            query: buildJobsQuery(role),
            count: jobs.length,
            jobs,
            fetched_via: cached.fetched_via || "cache_demo",
            cached: true,
            cache_updated_at: cached.updated_at,
          });
        }
      }
    } catch {
      // segue para busca live se o cache falhar
    }
  }

  let googleError: string | null = null;

  try {
    const result = await fetchGoogleJobsByRole(role, {
      depth: 20,
      maxAttempts: 14,
      pollMs: 2000,
    });

    let merged = result.jobs;
    if (merged.length < MIN_DEMO_JOBS) {
      const extra = await fetchRemotarFallback(role);
      merged = dedupeDemoJobs([...merged, ...extra]);
    }

    if (merged.length > 0) {
      try {
        await setCachedJobs({
          kind: "demo",
          role,
          jobs: merged,
          fetched_via:
            merged.length > result.jobs.length
              ? "dataforseo_google_jobs+remotar"
              : result.fetched_via,
        });
      } catch {
        // ignore
      }
      const jobs = prepareDemoJobs(merged);
      return jsonWithSearch(request, role, {
        ...result,
        jobs,
        count: jobs.length,
        fetched_via:
          merged.length > result.jobs.length
            ? "dataforseo_google_jobs+remotar"
            : result.fetched_via,
        cached: false,
      });
    }
  } catch (error) {
    googleError =
      error instanceof Error ? error.message : "Erro desconhecido no Google Jobs";
  }

  // Se o Google atrasar/falhar: Remotar (rápido) com o mesmo cargo — não SEO genérico
  const remotarJobs = await fetchRemotarFallback(role);
  if (remotarJobs.length > 0) {
    try {
      await setCachedJobs({
        kind: "demo",
        role,
        jobs: remotarJobs,
        fetched_via: "fallback_remotar",
      });
    } catch {
      // ignore
    }
    const jobs = prepareDemoJobs(remotarJobs);
    return jsonWithSearch(request, role, {
      role,
      query: buildJobsQuery(role),
      count: jobs.length,
      jobs,
      fetched_via: "fallback_remotar",
      note: googleError
        ? `Google Jobs indisponível (${googleError}). Prévia via Remotar.`
        : "Prévia via Remotar",
      cached: false,
    });
  }

  return jsonWithSearch(request, role, {
    role,
    query: buildJobsQuery(role),
    count: 0,
    jobs: [],
    fetched_via: "error",
    error:
      googleError ||
      `Não encontramos vagas remotas para “${role}” agora. Continue para o feed completo.`,
    cached: false,
  });
}
