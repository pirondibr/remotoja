import postgres, { type Sql } from "postgres";

let sqlSingleton: Sql | null = null;
let schemaReady: Promise<void> | null = null;

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getSql(): Sql {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL não configurada");
  }
  if (!sqlSingleton) {
    sqlSingleton = postgres(url, {
      ssl: "require",
      max: 1,
      idle_timeout: 20,
      connect_timeout: 15,
      prepare: false,
    });
  }
  return sqlSingleton;
}

export async function ensureSchema(): Promise<void> {
  if (!hasDatabase()) return;
  if (!schemaReady) {
    schemaReady = (async () => {
      const sql = getSql();
      await sql`
        CREATE TABLE IF NOT EXISTS job_cache (
          kind text NOT NULL,
          role_key text NOT NULL,
          jobs jsonb NOT NULL DEFAULT '[]'::jsonb,
          fetched_via text,
          sources jsonb,
          updated_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (kind, role_key)
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS lead_searches (
          id uuid PRIMARY KEY,
          created_at timestamptz NOT NULL DEFAULT now(),
          role text NOT NULL,
          channel text NOT NULL DEFAULT 'demo',
          utm_source text,
          utm_medium text,
          utm_campaign text,
          utm_content text,
          utm_term text,
          fbclid text,
          gclid text,
          referrer text,
          jobs_shown jsonb NOT NULL DEFAULT '[]'::jsonb,
          jobs_count int NOT NULL DEFAULT 0,
          cached boolean NOT NULL DEFAULT false,
          user_agent text
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS lead_searches_created_at_idx
        ON lead_searches (created_at DESC)
      `;
      // Respostas do formulário do funil (1 linha por visita, mesmo com cache)
      await sql`
        ALTER TABLE lead_searches
        ADD COLUMN IF NOT EXISTS answers jsonb
      `;
      await sql`
        ALTER TABLE lead_searches
        ADD COLUMN IF NOT EXISTS funnel_variant text
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS paywall_feedback (
          id uuid PRIMARY KEY,
          created_at timestamptz NOT NULL DEFAULT now(),
          reason text NOT NULL,
          detail text,
          role text,
          email text,
          funnel_variant text,
          lead_id uuid
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS paywall_feedback_created_at_idx
        ON paywall_feedback (created_at DESC)
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS member_accounts (
          id uuid PRIMARY KEY,
          created_at timestamptz NOT NULL DEFAULT now(),
          username text NOT NULL UNIQUE,
          email text,
          password_hash text NOT NULL,
          order_id text NOT NULL,
          role text NOT NULL DEFAULT '',
          plan_id text,
          access_until timestamptz
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS member_accounts_email_idx
        ON member_accounts (email)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS member_accounts_order_id_idx
        ON member_accounts (order_id)
      `;
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  await schemaReady;
}

export function normalizeRoleKey(role: string): string {
  return role
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}
