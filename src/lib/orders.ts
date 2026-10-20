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
  fbp?: string | null;
  fbc?: string | null;
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
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS fbp text
  `;
  await sql`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS fbc text
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
  fbp?: string | null;
  fbc?: string | null;
}): Promise<void> {
  if (!hasDatabase()) return;
  await ensureOrdersSchema();
  const sql = getSql();
  const funnelVariant = parseFeedAb(input.funnelVariant);
  await sql`
    INSERT INTO orders (
      id, plan_id, role, amount_brl, status, payer_email, funnel_variant, fbp, fbc
    )
    VALUES (
      ${input.id},
      ${input.planId},
      ${input.role},
      ${input.amountBrl},
      'pending',
      ${input.payerEmail || null},
      ${funnelVariant},
      ${cleanClickId(input.fbp)},
      ${cleanClickId(input.fbc)}
    )
    ON CONFLICT (id) DO NOTHING
  `;
}

function cleanClickId(value?: string | null): string | null {
  const next = (value || "").trim();
  return next ? next.slice(0, 200) : null;
}

export async function saveOrderClickIds(input: {
  orderId: string;
  fbp?: string | null;
  fbc?: string | null;
}): Promise<void> {
  if (!hasDatabase()) return;
  const fbp = cleanClickId(input.fbp);
  const fbc = cleanClickId(input.fbc);
  if (!fbp && !fbc) return;
  await ensureOrdersSchema();
  const sql = getSql();
  await sql`
    UPDATE orders
    SET
      fbp = COALESCE(${fbp}, fbp),
      fbc = COALESCE(${fbc}, fbc)
    WHERE id = ${input.orderId}
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

/** Reserva o envio do Purchase: só um caller ganha, mesmo com webhook + confirm juntos. */
export async function claimMetaPurchaseSend(
  orderId: string
): Promise<boolean> {
  if (!hasDatabase()) return true;
  await ensureOrdersSchema();
  const sql = getSql();
  const rows = await sql`
    UPDATE orders
    SET meta_purchase_sent_at = now()
    WHERE id = ${orderId}
      AND meta_purchase_sent_at IS NULL
    RETURNING id
  `;
  return rows.length > 0;
}

export async function releaseMetaPurchaseSend(
  orderId: string
): Promise<void> {
  if (!hasDatabase()) return;
  await ensureOrdersSchema();
  const sql = getSql();
  await sql`
    UPDATE orders
    SET meta_purchase_sent_at = NULL
    WHERE id = ${orderId}
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

export async function listRecentOrders(options?: {
  limit?: number;
  offset?: number;
}): Promise<{ rows: OrderRow[]; total: number }> {
  if (!hasDatabase()) return { rows: [], total: 0 };
  await ensureOrdersSchema();
  const sql = getSql();
  const limit = Math.min(Math.max(options?.limit ?? 40, 1), 100);
  const offset = Math.max(options?.offset ?? 0, 0);
  const countRows = await sql`SELECT COUNT(*)::int AS total FROM orders`;
  const total = Number((countRows[0] as { total: number })?.total || 0);
  const rows = (await sql`
    SELECT
      id, created_at, plan_id, role, amount_brl, status,
      mp_preference_id, mp_payment_id, payer_email, access_until,
      funnel_variant
    FROM orders
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `) as unknown as OrderRow[];
  return {
    total,
    rows: rows.map((row) => ({
      ...row,
      amount_brl: Number(row.amount_brl),
      funnel_variant: parseFeedAb(row.funnel_variant),
    })),
  };
}
