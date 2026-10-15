import type { DemoJob } from "@/lib/demoJobs";
import { ensureSchema, getSql, hasDatabase, normalizeRoleKey } from "@/lib/db";

export type CacheKind = "demo" | "paid";

export type CachedJobsRow = {
  kind: CacheKind;
  role_key: string;
  jobs: DemoJob[];
  fetched_via: string | null;
  sources: Record<string, number | string | object> | null;
  updated_at: string;
};

export async function getCachedJobs(
  kind: CacheKind,
  role: string
): Promise<CachedJobsRow | null> {
  if (!hasDatabase()) return null;
  await ensureSchema();
  const sql = getSql();
  const roleKey = normalizeRoleKey(role);
  const rows = await sql`
    SELECT kind, role_key, jobs, fetched_via, sources, updated_at
    FROM job_cache
    WHERE kind = ${kind} AND role_key = ${roleKey}
    LIMIT 1
  `;
  const row = rows[0] as unknown as CachedJobsRow | undefined;
  if (!row) return null;
  return {
    ...row,
    jobs: (Array.isArray(row.jobs) ? row.jobs : []) as DemoJob[],
    sources:
      (row.sources as Record<string, number | string | object> | null) ?? null,
  };
}

export async function setCachedJobs(input: {
  kind: CacheKind;
  role: string;
  jobs: DemoJob[];
  fetched_via?: string | null;
  sources?: Record<string, number | string | object> | null;
}): Promise<void> {
  if (!hasDatabase()) return;
  await ensureSchema();
  const sql = getSql();
  const roleKey = normalizeRoleKey(input.role);
  await sql`
    INSERT INTO job_cache (kind, role_key, jobs, fetched_via, sources, updated_at)
    VALUES (
      ${input.kind},
      ${roleKey},
      ${sql.json(input.jobs ?? [])},
      ${input.fetched_via ?? null},
      ${input.sources ? sql.json(input.sources as never) : null},
      now()
    )
    ON CONFLICT (kind, role_key) DO UPDATE SET
      jobs = EXCLUDED.jobs,
      fetched_via = EXCLUDED.fetched_via,
      sources = EXCLUDED.sources,
      updated_at = now()
  `;
}

export async function clearCache(
  kind: CacheKind | "all"
): Promise<{ deleted: number }> {
  if (!hasDatabase()) return { deleted: 0 };
  await ensureSchema();
  const sql = getSql();
  if (kind === "all") {
    const rows = await sql`DELETE FROM job_cache RETURNING kind`;
    return { deleted: rows.length };
  }
  const rows = await sql`
    DELETE FROM job_cache WHERE kind = ${kind} RETURNING kind
  `;
  return { deleted: rows.length };
}

export async function cacheStats(): Promise<{
  demo: number;
  paid: number;
}> {
  if (!hasDatabase()) return { demo: 0, paid: 0 };
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT kind, COUNT(*)::int AS count
    FROM job_cache
    GROUP BY kind
  `;
  const out = { demo: 0, paid: 0 };
  for (const row of rows as unknown as Array<{ kind: string; count: number }>) {
    if (row.kind === "demo") out.demo = Number(row.count);
    if (row.kind === "paid") out.paid = Number(row.count);
  }
  return out;
}

export async function listPaidCacheEntries(limit = 30): Promise<
  Array<{
    role_key: string;
    jobs_count: number;
    sources: Record<string, number | string | object> | null;
    fetched_via: string | null;
    updated_at: string;
  }>
> {
  if (!hasDatabase()) return [];
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT
      role_key,
      jsonb_array_length(jobs) AS jobs_count,
      sources,
      fetched_via,
      updated_at
    FROM job_cache
    WHERE kind = 'paid'
    ORDER BY updated_at DESC
    LIMIT ${limit}
  `;
  return rows as unknown as Array<{
    role_key: string;
    jobs_count: number;
    sources: Record<string, number | string | object> | null;
    fetched_via: string | null;
    updated_at: string;
  }>;
}
