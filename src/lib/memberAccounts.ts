import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { randomUUID } from "crypto";
import { ensureSchema, getSql, hasDatabase } from "@/lib/db";

const scrypt = promisify(scryptCb);

export type MemberAccount = {
  id: string;
  username: string;
  email: string | null;
  order_id: string;
  role: string;
  plan_id: string | null;
  access_until: string | null;
};

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().slice(0, 80);
}

export function isValidUsername(raw: string): boolean {
  const value = normalizeUsername(raw);
  return /^[a-z0-9._@+-]{3,80}$/.test(value);
}

export function isValidPassword(raw: string): boolean {
  return raw.length >= 6 && raw.length <= 120;
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${buf.toString("hex")}`;
}

async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const buf = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  if (buf.length !== expected.length) return false;
  return timingSafeEqual(buf, expected);
}

export async function createMemberAccount(input: {
  username: string;
  password: string;
  email?: string | null;
  orderId: string;
  role: string;
  planId?: string | null;
  accessUntil?: string | null;
}): Promise<MemberAccount | { error: string }> {
  if (!hasDatabase()) return { error: "Banco indisponível" };
  if (!isValidUsername(input.username)) {
    return { error: "Usuário inválido. Use e-mail ou 3+ letras e números." };
  }
  if (!isValidPassword(input.password)) {
    return { error: "A senha precisa ter pelo menos 6 caracteres." };
  }
  await ensureSchema();
  const sql = getSql();
  const username = normalizeUsername(input.username);
  const email = (input.email || "").trim().toLowerCase() || username;
  const passwordHash = await hashPassword(input.password);
  const id = randomUUID();
  try {
    await sql`
      INSERT INTO member_accounts (
        id, username, email, password_hash, order_id, role, plan_id, access_until
      ) VALUES (
        ${id},
        ${username},
        ${email},
        ${passwordHash},
        ${input.orderId},
        ${input.role.trim().slice(0, 120)},
        ${input.planId || null},
        ${input.accessUntil || null}
      )
    `;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("member_accounts_username_key") || message.includes("unique")) {
      return { error: "Esse usuário já existe. Entre com sua senha." };
    }
    throw error;
  }
  return {
    id,
    username,
    email,
    order_id: input.orderId,
    role: input.role,
    plan_id: input.planId || null,
    access_until: input.accessUntil || null,
  };
}

export async function findAccountByUsername(
  username: string
): Promise<(MemberAccount & { password_hash: string }) | null> {
  if (!hasDatabase()) return null;
  await ensureSchema();
  const sql = getSql();
  const needle = normalizeUsername(username);
  const rows = await sql`
    SELECT id, username, email, password_hash, order_id, role, plan_id, access_until
    FROM member_accounts
    WHERE username = ${needle} OR email ILIKE ${needle}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return (rows[0] as (MemberAccount & { password_hash: string }) | undefined) || null;
}

export async function findAccountByOrderId(
  orderId: string
): Promise<MemberAccount | null> {
  if (!hasDatabase() || !orderId) return null;
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT id, username, email, order_id, role, plan_id, access_until
    FROM member_accounts
    WHERE order_id = ${orderId}
    LIMIT 1
  `;
  return (rows[0] as MemberAccount | undefined) || null;
}

export async function authenticateMember(
  username: string,
  password: string
): Promise<MemberAccount | null> {
  const row = await findAccountByUsername(username);
  if (!row) return null;
  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) return null;
  const { password_hash: _hash, ...account } = row;
  return account;
}
