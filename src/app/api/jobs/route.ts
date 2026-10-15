import { NextResponse } from "next/server";
import { fetchGoogleJobsByRole } from "@/lib/fetchGoogleJobs";
import { buildJobsQuery } from "@/lib/buildJobsQuery";
import { getCachedJobs, setCachedJobs } from "@/lib/jobCache";
import { hasDatabase } from "@/lib/db";

export const maxDuration = 60;

function isUsableDemoCache(fetchedVia: string | null | undefined): boolean {
  if (!fetchedVia) return false;
  // Fallback antigo gravava vagas de SEO em qualquer cargo — ignora.
  if (fetchedVia === "fallback_demo") return false;
  return true;
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
        return NextResponse.json({
          role,
          query: buildJobsQuery(role),
          count: cached.jobs.length,
          jobs: cached.jobs,
          fetched_via: cached.fetched_via || "cache_demo",
          cached: true,
          cache_updated_at: cached.updated_at,
        });
      }
    } catch {
      // segue para busca live se o cache falhar
    }
  }

  try {
    const result = await fetchGoogleJobsByRole(role, {
      depth: 10,
      maxAttempts: 10,
      pollMs: 2000,
    });

    if (result.jobs.length === 0) {
      return NextResponse.json({
        role,
        query: buildJobsQuery(role),
        count: 0,
        jobs: [],
        fetched_via: "dataforseo_google_jobs",
        note: "sem resultados live para este cargo",
        cached: false,
      });
    }

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

    return NextResponse.json({ ...result, cached: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json(
      {
        role,
        query: buildJobsQuery(role),
        count: 0,
        jobs: [],
        fetched_via: "error",
        error: message,
        cached: false,
      },
      { status: 200 }
    );
  }
}
