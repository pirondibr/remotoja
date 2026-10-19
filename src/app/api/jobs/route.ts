import { NextResponse } from "next/server";
import { fetchGoogleJobsByRole } from "@/lib/fetchGoogleJobs";
import { fetchRemotar } from "@/lib/dashboard/remotar";
import { termMatches } from "@/lib/dashboard/common";
import { buildJobsQuery } from "@/lib/buildJobsQuery";
import { getCachedJobs, setCachedJobs } from "@/lib/jobCache";
import { hasDatabase } from "@/lib/db";
import {
  dedupeDemoJobs,
  withDemoFakePosted,
  type DemoJob,
} from "@/lib/demoJobs";

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
    return jobs
      .filter((job) =>
        termMatches(`${job.title} ${job.snippet || ""} ${job.company}`, role)
      )
      .slice(0, 10);
  } catch {
    return [];
  }
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
          termMatches(
            `${job.title} ${job.snippet || ""} ${job.company}`,
            role
          )
        );
        if (filtered.length === 0) {
          // Cache só com lixo → busca live
        } else {
          const jobs = prepareDemoJobs(filtered);
          return NextResponse.json({
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
      depth: 10,
      maxAttempts: 14,
      pollMs: 2000,
    });

    if (result.jobs.length > 0) {
      try {
        await setCachedJobs({
          kind: "demo",
          role,
          jobs: result.jobs,
          fetched_via: result.fetched_via,
        });
      } catch {
        // ignore
      }
      const jobs = prepareDemoJobs(result.jobs);
      return NextResponse.json({
        ...result,
        jobs,
        count: jobs.length,
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
    return NextResponse.json({
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

  return NextResponse.json({
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
