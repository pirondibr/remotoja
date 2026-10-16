import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { formatAnswersForAdmin, listLeadSearches } from "@/lib/leadLog";
import { cacheStats, listCacheEntries } from "@/lib/jobCache";
import { hasDatabase } from "@/lib/db";
import { originLabel } from "@/lib/attribution";
import { extractScrapeReport } from "@/lib/dashboard/scrapeReport";
import type { ValidationReport } from "@/lib/dashboard/validateRemoteJobs";
import type { ScrapeReport } from "@/lib/dashboard/types";

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
        feeds: [],
        warning: "DATABASE_URL ausente",
      },
      { status: 200 }
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") || 50);
  const offset = Number(searchParams.get("offset") || 0);

  try {
    const [{ rows, total }, cache, cacheEntries] = await Promise.all([
      listLeadSearches({ limit, offset }),
      cacheStats(),
      listCacheEntries(60),
    ]);

    const feeds = cacheEntries.map((entry) => {
      const sources = entry.sources || {};
      const validation = (
        typeof sources._validation === "object" && sources._validation
          ? sources._validation
          : null
      ) as ValidationReport | null;
      const scrape_report = extractScrapeReport(sources) as ScrapeReport | null;
      const portalSources: Record<string, number | string> = {};
      for (const [key, value] of Object.entries(sources)) {
        if (key.startsWith("_")) continue;
        if (typeof value === "number" || typeof value === "string") {
          portalSources[key] = value;
        }
      }
      const kind = entry.kind === "demo" ? "demo" : "paid";
      return {
        kind,
        role: entry.role_key,
        jobs_count: Number(entry.jobs_count) || 0,
        sources: portalSources,
        validation,
        scrape_report,
        updated_at: entry.updated_at,
        href: `/api/admin/open-feed?role=${encodeURIComponent(entry.role_key)}&mode=cache&script=${kind}`,
      };
    });

    return NextResponse.json({
      total,
      cache,
      feeds,
      /** compat */
      paid_feeds: feeds.filter((f) => f.kind === "paid"),
      rows: rows.map((row) => ({
        ...row,
        origin: originLabel(row),
        form_answers: formatAnswersForAdmin(row.answers),
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
