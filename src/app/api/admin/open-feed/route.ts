import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { buildDemoToken, demoCookieOptions } from "@/lib/memberAuth";

/**
 * Libera cookie de inspeção e abre o feed pago.
 *
 * Modes:
 *   ?mode=cache   → o que o usuário viu (só cache, sem refazer scrapers)
 *   ?mode=analyze → análise ao vivo + double-check
 *
 * GET /api/admin/open-feed?role=seo&mode=cache
 */
export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const role = (url.searchParams.get("role") || "SEO").trim() || "SEO";
  const modeParam = (url.searchParams.get("mode") || "").toLowerCase();
  // Compat: validate=1 antigo = analyze
  const mode =
    modeParam === "cache" || modeParam === "analyze"
      ? modeParam
      : url.searchParams.get("validate") === "0"
        ? "cache"
        : "analyze";

  const dest = new URL("/app", url.origin);
  dest.searchParams.set("role", role);
  dest.searchParams.set("inspect", "1");
  dest.searchParams.set("mode", mode);
  if (mode === "analyze") {
    dest.searchParams.set("validate", "1");
  } else {
    dest.searchParams.set("cache_only", "1");
  }

  const res = NextResponse.redirect(dest);
  const cookie = demoCookieOptions(buildDemoToken());
  res.cookies.set(cookie.name, cookie.value, cookie);
  return res;
}
