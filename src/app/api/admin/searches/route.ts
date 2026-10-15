import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { listLeadSearches } from "@/lib/leadLog";
import { cacheStats } from "@/lib/jobCache";
import { hasDatabase } from "@/lib/db";
import { originLabel } from "@/lib/attribution";

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!hasDatabase()) {
    return NextResponse.json(
      {
        rows: [],
        total: 0,
        cache: { demo: 0, paid: 0 },
        warning: "DATABASE_URL ausente",
      },
      { status: 200 }
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") || 50);
  const offset = Number(searchParams.get("offset") || 0);

  try {
    const [{ rows, total }, cache] = await Promise.all([
      listLeadSearches({ limit, offset }),
      cacheStats(),
    ]);

    return NextResponse.json({
      total,
      cache,
      rows: rows.map((row) => ({
        ...row,
        origin: originLabel(row),
        jobs_preview: (row.jobs_shown || []).slice(0, 5).map((j) => ({
          title: j.title,
          company: j.company,
          source: j.source,
        })),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
