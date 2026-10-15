import { NextResponse } from "next/server";
import {
  adminCookieOptions,
  buildAdminToken,
  hasAdminSecret,
  verifyAdminPassword,
} from "@/lib/adminAuth";

export async function POST(request: Request) {
  if (!hasAdminSecret()) {
    return NextResponse.json(
      { error: "ADMIN_SECRET não configurada no servidor" },
      { status: 503 }
    );
  }

  let password = "";
  try {
    const body = (await request.json()) as { password?: string };
    password = String(body.password || "");
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!verifyAdminPassword(password)) {
    return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  const cookie = adminCookieOptions(buildAdminToken());
  res.cookies.set(cookie.name, cookie.value, cookie);
  return res;
}
