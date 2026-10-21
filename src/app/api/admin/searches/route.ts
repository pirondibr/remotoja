import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import {
  countLeadFunnelAb,
  formatAnswersForAdmin,
  listLeadSearches,
} from "@/lib/leadLog";
import { countOrderFunnelAb, listRecentOrders } from "@/lib/orders";
import { cacheStats, listCacheEntries, parseCacheKind } from "@/lib/jobCache";
import { hasDatabase } from "@/lib/db";
import { countPaywallFeedback } from "@/lib/paywallFeedback";
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
        cache: { demo: 0, paid: 0, demo1: 0 },
        feeds: [],
        ab: {
          leads: { v1: 0, v2: 0, unknown: 0 },
          orders: {
            v1: { total: 0, approved: 0 },
            v2: { total: 0, approved: 0 },
            unknown: { total: 0, approved: 0 },
          },
        },
        orders: [],
        orders_total: 0,
        feeds_total: 0,
        page_size: 10,
        paywall_feedback: [],
        paywall_feedback_total: 0,
        warning: "DATABASE_URL ausente",
      },
      { status: 200 }
    );
  }

  const { searchParams } = new URL(request.url);
  const pageSize = 10;
  const leadsOffset = Number(searchParams.get("leads_offset") || 0);
  const ordersOffset = Number(searchParams.get("orders_offset") || 0);
  const feedsOffset = Number(searchParams.get("feeds_offset") || 0);

  try {
    const [
      { rows, total },
      cache,
      cachePage,
      abLeads,
      abOrders,
      ordersPage,
      paywallFeedback,
    ] = await Promise.all([
      listLeadSearches({ limit: pageSize, offset: leadsOffset }),
      cacheStats(),
      listCacheEntries({ limit: pageSize, offset: feedsOffset }),
      countLeadFunnelAb(),
      countOrderFunnelAb(),
      listRecentOrders({ limit: pageSize, offset: ordersOffset }),
      countPaywallFeedback(),
    ]);

    const feeds = cachePage.rows.map((entry) => {
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
      const kind = parseCacheKind(entry.kind);
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
      ab: { leads: abLeads, orders: abOrders },
      paywall_feedback: paywallFeedback,
      paywall_feedback_total: paywallFeedback.reduce((sum, row) => sum + row.n, 0),
      page_size: pageSize,
      feeds_total: cachePage.total,
      orders_total: ordersPage.total,
      orders: ordersPage.rows.map((order) => ({
        id: order.id,
        created_at: order.created_at,
        plan_id: order.plan_id,
        role: order.role,
        amount_brl: Number(order.amount_brl),
        status: order.status,
        payer_email: order.payer_email,
        funnel_variant: order.funnel_variant || null,
        checkout_ui: order.checkout_ui || null,
      })),
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
