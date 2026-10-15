import { ensureSchema, getSql, hasDatabase } from "@/lib/db";
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
      access_until timestamptz
    )
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
}): Promise<void> {
  if (!hasDatabase()) return;
  await ensureOrdersSchema();
  const sql = getSql();
  await sql`
    INSERT INTO orders (id, plan_id, role, amount_brl, status, payer_email)
    VALUES (
      ${input.id},
      ${input.planId},
      ${input.role},
      ${input.amountBrl},
      'pending',
      ${input.payerEmail || null}
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
