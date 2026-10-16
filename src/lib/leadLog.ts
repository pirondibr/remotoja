import { randomUUID } from "crypto";
import type { DemoJob } from "@/lib/demoJobs";
import type { FunnelAnswer } from "@/lib/funnel";
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
};

/** Labels amigáveis pras chaves do funil (admin). */
export const FUNNEL_ANSWER_LABELS: Record<string, string> = {
  work_type: "Tipo de vaga",
  search_time: "Tempo buscando",
  pain: "Dificuldade",
  salary: "Faixa salarial",
  location: "Localização",
  seniority: "Nível",
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
  await sql`
    INSERT INTO lead_searches (
      id, role, channel,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      fbclid, gclid, referrer,
      jobs_shown, jobs_count, cached, user_agent, answers
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
      ${answers ? sql.json(answers as never) : null}
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
      jobs_shown, jobs_count, cached, user_agent, answers
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
    })),
  };
}
