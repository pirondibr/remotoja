import { ensureSchema, getSql, hasDatabase } from "@/lib/db";
import { parseFeedAb, type FeedAbVariant } from "@/lib/funnelAb";
import type { PlanId } from "@/lib/rrPlans";

export type OrderRow = {
  id: string;
  created_at: string;
  plan_id: string;
  role: string;
  amount_brl: number;
  status: string;
  mp_preference_id: string | null;
  mp_payment_id: string | null;
  payer_email: string | null;
  access_until: string | null;
  meta_purchase_sent_at?: string | null;
  funnel_variant?: FeedAbVariant | null;
};

export async function ensureOrdersSchema(): Promise<void> {
  if (!hasDatabase()) return;
  await ensureSchema();
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id text PRIMARY KEY,
      created_at timestamptz NOT NULL DEFAULT now(),
      plan_id text NOT NULL,
      role text NOT NULL DEFAULT '',
      amount_brl numeric(10,2) NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      mp_preference_id text,
      mp_payment_id text,
      payer_email text,
      access_until timestamptz,
      meta_purchase_sent_at timestamptz
    )
  `;
  await sql`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS meta_purchase_sent_at timestamptz
  `;
  await sql`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS funnel_variant text
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status, created_at DESC)
  `;
}

export async function createOrder(input: {
  id: string;
  planId: PlanId;
  role: string;
  amountBrl: number;
  payerEmail?: string;
  funnelVariant?: FeedAbVariant | string | null;
}): Promise<void> {
  if (!hasDatabase()) return;
  await ensureOrdersSchema();
  const sql = getSql();
  const funnelVariant = parseFeedAb(input.funnelVariant);
  await sql`
    INSERT INTO orders (
      id, plan_id, role, amount_brl, status, payer_email, funnel_variant
    )
    VALUES (
      ${input.id},
      ${input.planId},
      ${input.role},
      ${input.amountBrl},
      'pending',
      ${input.payerEmail || null},
      ${funnelVariant}
    )
    ON CONFLICT (id) DO NOTHING
  `;
}

export async function attachPreference(
  orderId: string,
  preferenceId: string
): Promise<void> {
  if (!hasDatabase()) return;
  await ensureOrdersSchema();
  const sql = getSql();
  await sql`
    UPDATE orders
    SET mp_preference_id = ${preferenceId}
    WHERE id = ${orderId}
  `;
}

export async function getOrder(orderId: string): Promise<OrderRow | null> {
  if (!hasDatabase()) return null;
  await ensureOrdersSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM orders WHERE id = ${orderId} LIMIT 1
  `;
  return (rows[0] as OrderRow | undefined) || null;
}

export async function markOrderApproved(input: {
  orderId: string;
  paymentId: string;
  payerEmail?: string | null;
  accessUntil: Date;
}): Promise<OrderRow | null> {
  if (!hasDatabase()) return null;
  await ensureOrdersSchema();
  const sql = getSql();
  const rows = await sql`
    UPDATE orders
    SET
      status = 'approved',
      mp_payment_id = ${input.paymentId},
      payer_email = COALESCE(${input.payerEmail || null}, payer_email),
      access_until = ${input.accessUntil.toISOString()}
    WHERE id = ${input.orderId}
    RETURNING *
  `;
  return (rows[0] as OrderRow | undefined) || null;
}

export async function markOrderStatus(
  orderId: string,
  status: string,
  paymentId?: string
): Promise<void> {
  if (!hasDatabase()) return;
  await ensureOrdersSchema();
  const sql = getSql();
  await sql`
    UPDATE orders
    SET
      status = ${status},
      mp_payment_id = COALESCE(${paymentId || null}, mp_payment_id)
    WHERE id = ${orderId}
  `;
}

/** True se Purchase CAPI ainda não foi gravado (pode tentar enviar). */
export async function shouldSendMetaPurchase(
  orderId: string
): Promise<boolean> {
  if (!hasDatabase()) return true;
  await ensureOrdersSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT meta_purchase_sent_at
    FROM orders
    WHERE id = ${orderId}
    LIMIT 1
  `;
  const row = rows[0] as { meta_purchase_sent_at?: string | null } | undefined;
  return !row?.meta_purchase_sent_at;
}

/** Marca Purchase CAPI enviado com sucesso. */
export async function markMetaPurchaseSent(orderId: string): Promise<void> {
  if (!hasDatabase()) return;
  await ensureOrdersSchema();
  const sql = getSql();
  await sql`
    UPDATE orders
    SET meta_purchase_sent_at = now()
    WHERE id = ${orderId}
      AND meta_purchase_sent_at IS NULL
  `;
}

export type OrderAbCounts = {
  v1: { total: number; approved: number };
  v2: { total: number; approved: number };
  unknown: { total: number; approved: number };
};

export async function countOrderFunnelAb(): Promise<OrderAbCounts> {
  const empty = {
    v1: { total: 0, approved: 0 },
    v2: { total: 0, approved: 0 },
    unknown: { total: 0, approved: 0 },
  };
  if (!hasDatabase()) return empty;
  await ensureOrdersSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT
      COALESCE(funnel_variant, '') AS funnel_variant,
      status,
      COUNT(*)::int AS n
    FROM orders
    GROUP BY 1, 2
  `) as unknown as Array<{
    funnel_variant: string;
    status: string;
    n: number;
  }>;
  const out: OrderAbCounts = empty;
  for (const row of rows) {
    const key = parseFeedAb(row.funnel_variant) ?? "unknown";
    const n = Number(row.n) || 0;
    out[key].total += n;
    if (row.status === "approved") out[key].approved += n;
  }
  return out;
}

export async function listRecentOrders(limit = 40): Promise<OrderRow[]> {
  if (!hasDatabase()) return [];
  await ensureOrdersSchema();
  const sql = getSql();
  const cap = Math.min(Math.max(limit, 1), 100);
  const rows = (await sql`
    SELECT
      id, created_at, plan_id, role, amount_brl, status,
      mp_preference_id, mp_payment_id, payer_email, access_until,
      funnel_variant
    FROM orders
    ORDER BY created_at DESC
    LIMIT ${cap}
  `) as unknown as OrderRow[];
  return rows.map((row) => ({
    ...row,
    amount_brl: Number(row.amount_brl),
    funnel_variant: parseFeedAb(row.funnel_variant),
  }));
}
