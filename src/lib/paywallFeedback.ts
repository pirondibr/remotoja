import { randomUUID } from "crypto";
import { ensureSchema, getSql, hasDatabase } from "@/lib/db";
import { parseFeedAb } from "@/lib/funnelAb";
import {
  PAYWALL_REASONS,
  parsePaywallReasonId,
  paywallReasonLabel,
} from "@/lib/paywallReasons";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function savePaywallFeedback(input: {
  reason: string;
  detail?: string | null;
  role?: string | null;
  email?: string | null;
  funnelVariant?: string | null;
  leadId?: string | null;
}): Promise<{ id: string } | null> {
  if (!hasDatabase()) return null;
  await ensureSchema();
  const sql = getSql();
  const reasonId = parsePaywallReasonId(input.reason);
  if (!reasonId) return null;
  const detail = (input.detail || "").trim().slice(0, 280) || null;
  const label = paywallReasonLabel(reasonId, detail);
  const email = (input.email || "").trim().toLowerCase() || null;
  const role = (input.role || "").trim().slice(0, 120) || null;
  const variant = parseFeedAb(input.funnelVariant);
  const rawLeadId = (input.leadId || "").trim();
  const leadId = UUID_RE.test(rawLeadId) ? rawLeadId : null;
  const id = randomUUID();

  await sql`
    INSERT INTO paywall_feedback (
      id, reason, detail, role, email, funnel_variant, lead_id
    ) VALUES (
      ${id},
      ${reasonId},
      ${detail},
      ${role},
      ${email},
      ${variant},
      ${leadId}
    )
  `;

  const patchJson = JSON.stringify({ paywall_feedback: label });
  try {
    if (leadId) {
      await sql`
        UPDATE lead_searches
        SET answers = COALESCE(answers, '{}'::jsonb) || ${patchJson}::jsonb
        WHERE id = ${leadId}
      `;
    } else if (email) {
      await sql`
        UPDATE lead_searches
        SET answers = COALESCE(answers, '{}'::jsonb) || ${patchJson}::jsonb
        WHERE id = (
          SELECT id FROM lead_searches
          WHERE answers->>'email' ILIKE ${email}
          ORDER BY created_at DESC
          LIMIT 1
        )
      `;
    }
  } catch {
    /* a tabela paywall_feedback já gravou o motivo */
  }

  return { id };
}

export type PaywallFeedbackCount = {
  reason: string;
  label: string;
  n: number;
};

export async function countPaywallFeedback(): Promise<PaywallFeedbackCount[]> {
  if (!hasDatabase()) return [];
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT reason, COUNT(*)::int AS n
    FROM paywall_feedback
    GROUP BY reason
    ORDER BY n DESC
  `) as unknown as Array<{ reason: string; n: number }>;
  const counted = new Map(
    rows.map((row) => [row.reason, Number(row.n) || 0])
  );
  return PAYWALL_REASONS.map((item) => ({
    reason: item.id,
    label: item.label,
    n: counted.get(item.id) || 0,
  }));
}
