import { cookies } from "next/headers";
import {
  DEMO_COOKIE,
  MEMBER_COOKIE,
  isValidDemoToken,
  parseMemberToken,
} from "@/lib/memberAuth";
import { hasApprovedOrderForRole } from "@/lib/orders";

/** Sem token MP e sem segredo de demo → feed aberto (dev / pré-checkout). */
export function isAccessGateEnabled(): boolean {
  if (process.env.CHECKOUT_BYPASS === "1") return false;
  return Boolean(
    process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim() ||
      process.env.DEMO_ACCESS_SECRET?.trim()
  );
}

export async function getMemberSession() {
  const jar = await cookies();
  return parseMemberToken(jar.get(MEMBER_COOKIE)?.value);
}

export async function hasMemberAccess(): Promise<boolean> {
  if (!isAccessGateEnabled()) return true;
  if (await getMemberSession()) return true;
  const jar = await cookies();
  if (isValidDemoToken(jar.get(DEMO_COOKIE)?.value)) return true;
  return false;
}

export async function canOpenPaidFeed(role?: string | null): Promise<boolean> {
  if (await hasMemberAccess()) return true;
  return hasApprovedOrderForRole(role || "");
}
