import { randomUUID } from "crypto";
import type { DemoJob } from "@/lib/demoJobs";
import type { FunnelAnswer } from "@/lib/funnel";
import { parseFeedAb, type FeedAbVariant } from "@/lib/funnelAb";
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

export type FunnelAnswers = Record<string, FunnelAnswer>;

export type LeadSearchInput = LeadAttribution & {
  role: string;
  channel?: string;
  jobs_shown: DemoJob[];
  cached?: boolean;
  user_agent?: string | null;
  /** Respostas do formulário do funil (work_type, salary, …). */
  answers?: FunnelAnswers | null;
  /** Página de conversão A/B (v1 matches+paywall vs v2 feed). */
  funnel_variant?: FeedAbVariant | string | null;
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
  answers: FunnelAnswers | null;
  funnel_variant: FeedAbVariant | null;
};

/** Labels amigáveis pras chaves do funil (admin). */
export const FUNNEL_ANSWER_LABELS: Record<string, string> = {
  work_type: "Tipo de vaga",
  search_time: "Tempo buscando",
  pain: "Dificuldade",
  salary: "Faixa salarial",
  location: "Localização",
  seniority: "Nível",
  name: "Nome",
  email: "E-mail",
  role: "Cargo",
};

function clean(value?: string | null): string | null {
  const v = (value || "").trim();
  return v ? v.slice(0, 500) : null;
}

/** Só campos de resposta (ignora intro/value/etc.). */
export function sanitizeFunnelAnswers(
  raw: unknown
): FunnelAnswers | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: FunnelAnswers = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = key.trim().slice(0, 40);
    if (!id || !(id in FUNNEL_ANSWER_LABELS)) continue;
    if (typeof value === "string") {
      const v = value.trim().slice(0, 200);
      if (v) out[id] = v;
    } else if (Array.isArray(value)) {
      const list = value
        .filter((x): x is string => typeof x === "string")
        .map((x) => x.trim().slice(0, 120))
        .filter(Boolean)
        .slice(0, 12);
      if (list.length) out[id] = list;
    }
  }
  return Object.keys(out).length ? out : null;
}

export function formatAnswersForAdmin(
  answers: FunnelAnswers | null | undefined
): Array<{ id: string; label: string; value: string }> {
  if (!answers) return [];
  return Object.entries(FUNNEL_ANSWER_LABELS)
    .filter(([id]) => answers[id] != null)
    .map(([id, label]) => {
      const raw = answers[id];
      const value = Array.isArray(raw) ? raw.join(", ") : String(raw || "");
      return { id, label, value };
    })
    .filter((row) => row.value.length > 0);
}

export async function logLeadSearch(
  input: LeadSearchInput
): Promise<{ id: string } | null> {
  if (!hasDatabase()) return null;
  await ensureSchema();
  const sql = getSql();
  const id = randomUUID();
  const jobs = Array.isArray(input.jobs_shown) ? input.jobs_shown : [];
  const answers = sanitizeFunnelAnswers(input.answers);
  const funnelVariant = parseFeedAb(input.funnel_variant);
  await sql`
    INSERT INTO lead_searches (
      id, role, channel,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      fbclid, gclid, referrer,
      jobs_shown, jobs_count, cached, user_agent, answers, funnel_variant
    ) VALUES (
      ${id},
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
      ${sql.json(jobs)},
      ${jobs.length},
      ${Boolean(input.cached)},
      ${clean(input.user_agent)},
      ${answers ? sql.json(answers as never) : null},
      ${funnelVariant}
    )
  `;
  return { id };
}

export async function findLatestLeadAnswersByEmail(
  email: string
): Promise<FunnelAnswers | null> {
  if (!hasDatabase()) return null;
  const needle = email.trim().toLowerCase();
  if (!needle) return null;
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT answers
    FROM lead_searches
    WHERE answers->>'email' ILIKE ${needle}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const row = rows[0] as { answers?: unknown } | undefined;
  return sanitizeFunnelAnswers(row?.answers);
}

export async function hasRecentPaidLead(input: {
  email?: string | null;
  role: string;
}): Promise<boolean> {
  if (!hasDatabase()) return false;
  const email = (input.email || "").trim().toLowerCase();
  const role = input.role.trim();
  if (!email || role.length < 2) return false;
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT id
    FROM lead_searches
    WHERE channel = 'paid'
      AND lower(role) = lower(${role})
      AND answers->>'email' ILIKE ${email}
      AND created_at > now() - interval '6 hours'
    LIMIT 1
  `;
  return rows.length > 0;
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
      jobs_shown, jobs_count, cached, user_agent, answers, funnel_variant
    FROM lead_searches
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `) as unknown as LeadSearchRow[];

  return {
    total,
    rows: rows.map((row) => ({
      ...row,
      jobs_shown: (Array.isArray(row.jobs_shown)
        ? row.jobs_shown
        : []) as DemoJob[],
      answers: sanitizeFunnelAnswers(row.answers),
      funnel_variant: parseFeedAb(row.funnel_variant),
    })),
  };
}

export type FunnelAbCounts = {
  v1: number;
  v2: number;
  unknown: number;
};

export async function countLeadFunnelAb(): Promise<FunnelAbCounts> {
  if (!hasDatabase()) return { v1: 0, v2: 0, unknown: 0 };
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT
      COALESCE(funnel_variant, '') AS funnel_variant,
      COUNT(*)::int AS n
    FROM lead_searches
    GROUP BY 1
  `) as unknown as Array<{ funnel_variant: string; n: number }>;
  const out: FunnelAbCounts = { v1: 0, v2: 0, unknown: 0 };
  for (const row of rows) {
    const variant = parseFeedAb(row.funnel_variant);
    const n = Number(row.n) || 0;
    if (variant === "v1") out.v1 += n;
    else if (variant === "v2") out.v2 += n;
    else out.unknown += n;
  }
  return out;
}
