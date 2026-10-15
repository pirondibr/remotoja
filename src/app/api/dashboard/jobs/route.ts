import { NextResponse } from "next/server";
import { fetchDashboardJobs } from "@/lib/dashboard/fetchDashboardJobs";
import { getCachedJobs, setCachedJobs } from "@/lib/jobCache";
import { hasDatabase } from "@/lib/db";

export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const role = (searchParams.get("role") || searchParams.get("q") || "").trim();
  const bypassCache = searchParams.get("fresh") === "1";

  if (role.length < 2) {
    return NextResponse.json(
      { error: "Informe ?role=SEO (mín. 2 caracteres)" },
      { status: 400 }
    );
  }

  if (!bypassCache && hasDatabase()) {
    try {
      const cached = await getCachedJobs("paid", role);
      if (cached && cached.jobs.length > 0) {
        return NextResponse.json({
          role,
          count: cached.jobs.length,
          jobs: cached.jobs,
          fetched_via: cached.fetched_via || "cache_paid",
          sources: cached.sources || {},
          cached: true,
          cache_updated_at: cached.updated_at,
        });
      }
    } catch {
      // segue live
    }
  }

  try {
    const payload = await fetchDashboardJobs(role);
    if (payload.jobs.length > 0) {
      try {
        await setCachedJobs({
          kind: "paid",
          role,
          jobs: payload.jobs,
          fetched_via: payload.fetched_via,
          sources: payload.sources,
        });
      } catch {
        // ignore
      }
    }
    return NextResponse.json({ ...payload, cached: false });
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
