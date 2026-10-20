import { NextResponse } from "next/server";
import { authenticateMember } from "@/lib/memberAccounts";
import {
  buildMemberToken,
  memberCookieOptions,
} from "@/lib/memberAuth";
import { getOrder } from "@/lib/orders";

export async function POST(request: Request) {
  let body: { username?: string; password?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  const account = await authenticateMember(username, password);
  if (!account) {
    return NextResponse.json(
      { error: "Usuário ou senha incorretos." },
      { status: 401 }
    );
  }

  const order = await getOrder(account.order_id);
  const exp = account.access_until
    ? new Date(account.access_until).getTime()
    : order?.access_until
      ? new Date(order.access_until).getTime()
      : Date.now() + 30 * 24 * 60 * 60 * 1000;
  if (exp < Date.now()) {
    return NextResponse.json(
      { error: "Seu acesso expirou. Faça um novo pagamento." },
      { status: 403 }
    );
  }

  const token = buildMemberToken({
    orderId: account.order_id,
    planId: account.plan_id || order?.plan_id || "monthly",
    role: account.role || order?.role || "",
    exp,
  });
  const cookie = memberCookieOptions(token);
  const res = NextResponse.json({
    ok: true,
    role: account.role || order?.role || "",
  });
  res.cookies.set(cookie.name, cookie.value, cookie);
  return res;
}
