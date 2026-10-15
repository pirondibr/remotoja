import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { listLeadSearches } from "@/lib/leadLog";
import { cacheStats, listPaidCacheEntries } from "@/lib/jobCache";
import { hasDatabase } from "@/lib/db";
import { originLabel } from "@/lib/attribution";
import type { ValidationReport } from "@/lib/dashboard/validateRemoteJobs";

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
    const [{ rows, total }, cache, paidEntries] = await Promise.all([
      listLeadSearches({ limit, offset }),
      cacheStats(),
      listPaidCacheEntries(30),
    ]);

    const paid_feeds = paidEntries.map((entry) => {
      const sources = entry.sources || {};
      const validation = (
        typeof sources._validation === "object" && sources._validation
          ? sources._validation
          : null
      ) as ValidationReport | null;
      const portalSources: Record<string, number | string> = {};
      for (const [key, value] of Object.entries(sources)) {
        if (key === "_validation") continue;
        if (typeof value === "number" || typeof value === "string") {
          portalSources[key] = value;
        }
      }
      return {
        role: entry.role_key,
        jobs_count: Number(entry.jobs_count) || 0,
        sources: portalSources,
        validation,
        updated_at: entry.updated_at,
        href: `/app?role=${encodeURIComponent(entry.role_key)}&inspect=1`,
      };
    });

    return NextResponse.json({
      total,
      cache,
      paid_feeds,
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
