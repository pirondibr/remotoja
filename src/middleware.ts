import { NextResponse, type NextRequest } from "next/server";

/**
 * Atalho secreto (Edge-safe): só compara DEMO_ACCESS_SECRET e redireciona
 * para /api/demo/unlock, que seta o cookie no runtime Node.
 *
 * URLs:
 *   /lab?k=SEGREDO&role=seo
 *   /app?k=SEGREDO&role=seo
 *   /dashboard?k=SEGREDO&role=seo  (alias → /app)
 */
export function middleware(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("k");
  if (!key) return NextResponse.next();

  const expected = process.env.DEMO_ACCESS_SECRET?.trim() || "";
  if (!expected || key !== expected) return NextResponse.next();

  const role =
    req.nextUrl.searchParams.get("role") ||
    req.nextUrl.searchParams.get("q") ||
    "SEO";

  const unlock = req.nextUrl.clone();
  unlock.pathname = "/api/demo/unlock";
  unlock.search = `?k=${encodeURIComponent(key)}&role=${encodeURIComponent(role)}`;
  return NextResponse.redirect(unlock);
}

export const config = {
  matcher: ["/app", "/lab", "/dashboard"],
};
