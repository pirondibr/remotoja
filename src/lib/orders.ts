import { ensureSchema, getSql, hasDatabase, normalizeRoleKey } from "@/lib/db";
import { parseCheckoutUi, type CheckoutUi } from "@/lib/checkoutUi";
import { parseFeedAb, type FeedAbVariant } from "@/lib/funnelAb";
import { buildFbc } from "@/lib/metaClickIds";
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
  fbclid?: string | null;
  client_ip?: string | null;
  user_agent?: string | null;
  payer_phone?: string | null;
  checkout_ui?: CheckoutUi | null;
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
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS checkout_ui text
  `;
  await sql`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS fbclid text
  `;
  await sql`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS client_ip text
  `;
  await sql`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS user_agent text
  `;
  await sql`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS payer_phone text
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
  fbclid?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  payerPhone?: string | null;
  checkoutUi?: CheckoutUi | string | null;
}): Promise<void> {
  if (!hasDatabase()) return;
  await ensureOrdersSchema();
  const sql = getSql();
  const funnelVariant = parseFeedAb(input.funnelVariant);
  const checkoutUi = parseCheckoutUi(input.checkoutUi);
  await sql`
    INSERT INTO orders (
      id, plan_id, role, amount_brl, status, payer_email, funnel_variant,
      fbp, fbc, fbclid, client_ip, user_agent, payer_phone, checkout_ui
    )
    VALUES (
      ${input.id},
      ${input.planId},
      ${input.role},
      ${input.amountBrl},
      'pending',
      ${input.payerEmail || null},
      ${funnelVariant},
      ${cleanText(input.fbp, 512)},
      ${cleanText(input.fbc, 512)},
      ${cleanText(input.fbclid, 512)},
      ${cleanText(input.clientIp, 64)},
      ${cleanText(input.userAgent, 512)},
      ${cleanText(input.payerPhone, 32)},
      ${checkoutUi}
    )
    ON CONFLICT (id) DO NOTHING
  `;
}

function cleanText(value?: string | null, max = 512): string | null {
  const next = (value || "").trim();
  return next ? next.slice(0, max) : null;
}

export async function saveOrderClickIds(input: {
  orderId: string;
  fbp?: string | null;
  fbc?: string | null;
  fbclid?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  payerPhone?: string | null;
}): Promise<void> {
  if (!hasDatabase()) return;
  const fbp = cleanText(input.fbp, 512);
  const fbc = cleanText(input.fbc, 512);
  const fbclid = cleanText(input.fbclid, 512);
  const clientIp = cleanText(input.clientIp, 64);
  const userAgent = cleanText(input.userAgent, 512);
  const payerPhone = cleanText(input.payerPhone, 32);
  if (!fbp && !fbc && !fbclid && !clientIp && !userAgent && !payerPhone) return;
  await ensureOrdersSchema();
  const sql = getSql();
  await sql`
    UPDATE orders
    SET
      fbp = COALESCE(${fbp}, fbp),
      fbc = COALESCE(${fbc}, fbc),
      fbclid = COALESCE(${fbclid}, fbclid),
      client_ip = COALESCE(${clientIp}, client_ip),
      user_agent = COALESCE(${userAgent}, user_agent),
      payer_phone = COALESCE(${payerPhone}, payer_phone)
    WHERE id = ${input.orderId}
  `;
}

export function metaUserFromOrder(order: OrderRow | null | undefined): {
  fbp?: string | null;
  fbc?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  email?: string | null;
  phone?: string | null;
} {
  if (!order) return {};
  return {
    fbp: order.fbp,
    fbc: order.fbc || buildFbc(order.fbclid) || null,
    clientIp: order.client_ip,
    userAgent: order.user_agent,
    email: order.payer_email,
    phone: order.payer_phone,
  };
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

export async function findLatestApprovedOrderByEmail(
  email: string
): Promise<OrderRow | null> {
  const needle = email.trim().toLowerCase();
  if (!needle || !hasDatabase()) return null;
  await ensureOrdersSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM orders
    WHERE status = 'approved'
      AND payer_email ILIKE ${needle}
      AND (access_until IS NULL OR access_until > now())
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return (rows[0] as OrderRow | undefined) || null;
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
  v3: { total: number; approved: number };
  unknown: { total: number; approved: number };
};

export async function countOrderFunnelAb(): Promise<OrderAbCounts> {
  const empty = {
    v1: { total: 0, approved: 0 },
    v2: { total: 0, approved: 0 },
    v3: { total: 0, approved: 0 },
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
      funnel_variant, checkout_ui
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
      checkout_ui: parseCheckoutUi(row.checkout_ui),
    })),
  };
}

/** Link /app?role=… funciona sem cookie se existir pedido aprovado vigente daquele cargo. */
export async function hasApprovedOrderForRole(role: string): Promise<boolean> {
  const needle = normalizeRoleKey(role);
  if (needle.length < 2 || !hasDatabase()) return false;
  await ensureOrdersSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT role
    FROM orders
    WHERE status = 'approved'
      AND (access_until IS NULL OR access_until > now())
    ORDER BY created_at DESC
    LIMIT 200
  `) as unknown as Array<{ role: string }>;
  return rows.some((row) => normalizeRoleKey(row.role || "") === needle);
}
