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
    const result = await fetchGoogleJobsByRole(role);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    // Fallback: demos estáticas se a API falhar (ex.: sem credencial no ambiente)
    return NextResponse.json(
      {
        role,
        query: buildJobsQuery(role),
        count: 0,
        jobs: getDemoJobs(5),
        fetched_via: "fallback_demo",
        error: message,
        fallback_query: demoJobsPayload.query,
      },
      { status: 200 }
    );
  }
}
