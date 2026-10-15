import { NextResponse } from "next/server";
import {
  buildDemoToken,
  demoCookieOptions,
  isValidDemoKey,
} from "@/lib/memberAuth";

/**
 * Libera cookie de teste: GET /api/demo/unlock?k=SEGREDO&role=seo
 * Redireciona para /app (só quem tem o segredo).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("k") || "";
  const role = (url.searchParams.get("role") || "SEO").trim() || "SEO";

  if (!isValidDemoKey(key)) {
    return NextResponse.json({ error: "Chave inválida" }, { status: 401 });
  }

  const dest = new URL(`/app?role=${encodeURIComponent(role)}`, url.origin);
  const res = NextResponse.redirect(dest);
  const cookie = demoCookieOptions(buildDemoToken());
  res.cookies.set(cookie.name, cookie.value, cookie);
  return res;
}
