import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE = "mvr_admin";
const MAX_AGE_SEC = 60 * 60 * 24 * 7;

function secret(): string {
  const value = process.env.ADMIN_SECRET?.trim();
  if (!value) throw new Error("ADMIN_SECRET não configurada");
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function hasAdminSecret(): boolean {
  return Boolean(process.env.ADMIN_SECRET?.trim());
}

export function verifyAdminPassword(password: string): boolean {
  if (!hasAdminSecret()) return false;
  const expected = secret();
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function buildAdminToken(): string {
  const exp = String(Date.now() + MAX_AGE_SEC * 1000);
  const sig = sign(exp);
  return `${exp}.${sig}`;
}

export function isValidAdminToken(token: string | undefined | null): boolean {
  if (!token || !hasAdminSecret()) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig) return false;
  if (Number(exp) < Date.now()) return false;
  const expected = sign(exp);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function isAdminAuthenticated(): Promise<boolean> {
  // MVP: painel aberto sem senha (reativar cookie + ADMIN_SECRET depois)
  return true;
}

export function adminCookieOptions(token: string) {
  return {
    name: COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SEC,
  };
}

export function clearAdminCookieOptions() {
  return {
    name: COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}
