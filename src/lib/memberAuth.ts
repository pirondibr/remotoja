import { createHmac, randomBytes, timingSafeEqual } from "crypto";

export const MEMBER_COOKIE = "remotoja_member";
export const DEMO_COOKIE = "remotoja_demo";

const MEMBER_MAX_AGE_SEC = 60 * 60 * 24 * 400; // cobre plano anual + folga
const DEMO_MAX_AGE_SEC = 60 * 60 * 24 * 30;

function signingSecret(): string {
  return (
    process.env.MEMBER_SECRET?.trim() ||
    process.env.ADMIN_SECRET?.trim() ||
    process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim() ||
    ""
  );
}

function sign(payload: string): string {
  const secret = signingSecret();
  if (!secret) throw new Error("MEMBER_SECRET/ADMIN_SECRET não configurada");
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function hasMemberSigningSecret(): boolean {
  return Boolean(signingSecret());
}

export type MemberPayload = {
  orderId: string;
  planId: string;
  role: string;
  exp: number; // ms
};

export function buildMemberToken(payload: MemberPayload): string {
  const body = Buffer.from(
    JSON.stringify({
      o: payload.orderId,
      p: payload.planId,
      r: payload.role,
      e: payload.exp,
    }),
    "utf8"
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function parseMemberToken(
  token: string | undefined | null
): MemberPayload | null {
  if (!token || !hasMemberSigningSecret()) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as { o?: string; p?: string; r?: string; e?: number };
    if (!data.o || !data.p || !data.e) return null;
    if (Number(data.e) < Date.now()) return null;
    return {
      orderId: data.o,
      planId: data.p,
      role: String(data.r || ""),
      exp: Number(data.e),
    };
  } catch {
    return null;
  }
}

export function memberCookieOptions(token: string, maxAgeSec = MEMBER_MAX_AGE_SEC) {
  return {
    name: MEMBER_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSec,
  };
}

export function getDemoAccessSecret(): string {
  return process.env.DEMO_ACCESS_SECRET?.trim() || "";
}

export function isValidDemoKey(key: string | null | undefined): boolean {
  const expected = getDemoAccessSecret();
  if (!expected || !key) return false;
  const a = Buffer.from(key);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function buildDemoToken(): string {
  const exp = String(Date.now() + DEMO_MAX_AGE_SEC * 1000);
  return `${exp}.${sign(`demo:${exp}`)}`;
}

export function isValidDemoToken(token: string | undefined | null): boolean {
  if (!token || !hasMemberSigningSecret()) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig) return false;
  if (Number(exp) < Date.now()) return false;
  const expected = sign(`demo:${exp}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function demoCookieOptions(token: string) {
  return {
    name: DEMO_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DEMO_MAX_AGE_SEC,
  };
}

export function generateOrderId(): string {
  return randomBytes(16).toString("hex");
}
