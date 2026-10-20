import { NextResponse } from "next/server";
import { getMemberSession } from "@/lib/access";
import {
  createMemberAccount,
  findAccountByOrderId,
  isValidPassword,
  isValidUsername,
} from "@/lib/memberAccounts";
import {
  buildMemberToken,
  memberCookieOptions,
} from "@/lib/memberAuth";
import {
  findLatestApprovedOrderByEmail,
  getOrder,
} from "@/lib/orders";

export async function POST(request: Request) {
  let body: { username?: string; password?: string; email?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  const emailHint = String(body.email || "").trim();
  if (!isValidUsername(username)) {
    return NextResponse.json(
      { error: "Usuário inválido. Use seu e-mail ou 3+ letras e números." },
      { status: 400 }
    );
  }
  if (!isValidPassword(password)) {
    return NextResponse.json(
      { error: "A senha precisa ter pelo menos 6 caracteres." },
      { status: 400 }
    );
  }

  const session = await getMemberSession();
  let order = session ? await getOrder(session.orderId) : null;
  if (!order) {
    const email = emailHint || username;
    order = await findLatestApprovedOrderByEmail(email);
  }
  if (!order || order.status !== "approved") {
    return NextResponse.json(
      {
        error:
          "Não achamos um pagamento aprovado com esses dados. Use o e-mail da compra.",
      },
      { status: 403 }
    );
  }

  const existing = await findAccountByOrderId(order.id);
  if (existing) {
    return NextResponse.json(
      { error: "Você já tem login. Entre com usuário e senha." },
      { status: 409 }
    );
  }

  const created = await createMemberAccount({
    username,
    password,
    email: order.payer_email || emailHint || username,
    orderId: order.id,
    role: order.role,
    planId: order.plan_id,
    accessUntil: order.access_until,
  });
  if ("error" in created) {
    return NextResponse.json({ error: created.error }, { status: 400 });
  }

  const exp = order.access_until
    ? new Date(order.access_until).getTime()
    : Date.now() + 30 * 24 * 60 * 60 * 1000;
  const token = buildMemberToken({
    orderId: order.id,
    planId: order.plan_id,
    role: order.role,
    exp,
  });
  const res = NextResponse.json({
    ok: true,
    role: order.role,
    username: created.username,
  });
  const cookie = memberCookieOptions(token);
  res.cookies.set(cookie.name, cookie.value, cookie);
  return res;
}
