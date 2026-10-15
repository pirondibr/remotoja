import { NextResponse } from "next/server";
import { fetchGoogleJobsByRole } from "@/lib/fetchGoogleJobs";
import { getDemoJobs, demoJobsPayload } from "@/lib/demoJobs";
import { buildJobsQuery } from "@/lib/buildJobsQuery";

export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const role = (searchParams.get("role") || searchParams.get("q") || "").trim();
  const preview = searchParams.get("preview") === "1";

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

  try {
    // Poll curto: no Vercel o funil precisa responder antes do timeout (~60s)
    const result = await fetchGoogleJobsByRole(role, {
      depth: 10,
      maxAttempts: 10,
      pollMs: 2000,
    });
    if (result.jobs.length === 0) {
      const fallback = getDemoJobs(5);
      return NextResponse.json({
        ...result,
        count: fallback.length,
        jobs: fallback,
        fetched_via: "fallback_demo",
        note: "sem resultados live — preview estático",
      });
    }
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    const fallback = getDemoJobs(5);
    return NextResponse.json(
      {
        role,
        query: buildJobsQuery(role),
        count: fallback.length,
        jobs: fallback,
        fetched_via: "fallback_demo",
        error: message,
        fallback_query: demoJobsPayload.query,
      },
      { status: 200 }
    );
  }
}
