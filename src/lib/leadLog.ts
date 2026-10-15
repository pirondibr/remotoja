import { randomUUID } from "crypto";
import type { DemoJob } from "@/lib/demoJobs";
import { ensureSchema, getSql, hasDatabase } from "@/lib/db";

export type LeadAttribution = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  fbclid?: string | null;
  gclid?: string | null;
  referrer?: string | null;
};

export type LeadSearchInput = LeadAttribution & {
  role: string;
  channel?: string;
  jobs_shown: DemoJob[];
  cached?: boolean;
  user_agent?: string | null;
};

export type LeadSearchRow = {
  id: string;
  created_at: string;
  role: string;
  channel: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  fbclid: string | null;
  gclid: string | null;
  referrer: string | null;
  jobs_shown: DemoJob[];
  jobs_count: number;
  cached: boolean;
  user_agent: string | null;
};

function clean(value?: string | null): string | null {
  const v = (value || "").trim();
  return v ? v.slice(0, 500) : null;
}

export async function logLeadSearch(
  input: LeadSearchInput
): Promise<{ id: string } | null> {
  if (!hasDatabase()) return null;
  await ensureSchema();
  const sql = getSql();
  const id = randomUUID();
  const jobs = Array.isArray(input.jobs_shown) ? input.jobs_shown : [];
  const jobsJson = JSON.stringify(jobs);
  await sql`
    INSERT INTO lead_searches (
      id, role, channel,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      fbclid, gclid, referrer,
      jobs_shown, jobs_count, cached, user_agent
    ) VALUES (
      ${id}::uuid,
      ${input.role.trim().slice(0, 120)},
      ${(input.channel || "demo").slice(0, 40)},
      ${clean(input.utm_source)},
      ${clean(input.utm_medium)},
      ${clean(input.utm_campaign)},
      ${clean(input.utm_content)},
      ${clean(input.utm_term)},
      ${clean(input.fbclid)},
      ${clean(input.gclid)},
      ${clean(input.referrer)},
      ${jobsJson}::jsonb,
      ${jobs.length},
      ${Boolean(input.cached)},
      ${clean(input.user_agent)}
    )
  `;
  return { id };
}

export async function listLeadSearches(options?: {
  limit?: number;
  offset?: number;
}): Promise<{ rows: LeadSearchRow[]; total: number }> {
  if (!hasDatabase()) return { rows: [], total: 0 };
  await ensureSchema();
  const sql = getSql();
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
  const offset = Math.max(options?.offset ?? 0, 0);

  const countRows = await sql`SELECT COUNT(*)::int AS total FROM lead_searches`;
  const total = Number((countRows[0] as { total: number })?.total || 0);

  const rows = (await sql`
    SELECT
      id, created_at, role, channel,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      fbclid, gclid, referrer,
      jobs_shown, jobs_count, cached, user_agent
    FROM lead_searches
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `) as LeadSearchRow[];

  return {
    total,
    rows: rows.map((row) => ({
      ...row,
      jobs_shown: (Array.isArray(row.jobs_shown) ? row.jobs_shown : []) as DemoJob[],
    })),
  };
}
