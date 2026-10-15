import { NextResponse } from "next/server";
import { fetchGoogleJobsByRole } from "@/lib/fetchGoogleJobs";
import { getDemoJobs, demoJobsPayload } from "@/lib/demoJobs";
import { buildJobsQuery } from "@/lib/buildJobsQuery";
import { getCachedJobs, setCachedJobs } from "@/lib/jobCache";
import { hasDatabase } from "@/lib/db";

export const maxDuration = 60;

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
      note: "preview only — sem chamar DataForSEO",
    });
  }

  if (!bypassCache && hasDatabase()) {
    try {
      const cached = await getCachedJobs("demo", role);
      if (cached && cached.jobs.length > 0) {
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
      const fallback = getDemoJobs(5);
      const payload = {
        ...result,
        count: fallback.length,
        jobs: fallback,
        fetched_via: "fallback_demo",
        note: "sem resultados live — preview estático",
        cached: false,
      };
      try {
        await setCachedJobs({
          kind: "demo",
          role,
          jobs: fallback,
          fetched_via: "fallback_demo",
        });
      } catch {
        // ignore
      }
      return NextResponse.json(payload);
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
    const fallback = getDemoJobs(5);
    try {
      await setCachedJobs({
        kind: "demo",
        role,
        jobs: fallback,
        fetched_via: "fallback_demo",
      });
    } catch {
      // ignore
    }
    return NextResponse.json(
      {
        role,
        query: buildJobsQuery(role),
        count: fallback.length,
        jobs: fallback,
        fetched_via: "fallback_demo",
        error: message,
        fallback_query: demoJobsPayload.query,
        cached: false,
      },
      { status: 200 }
    );
  }
}
