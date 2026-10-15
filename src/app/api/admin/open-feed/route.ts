import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { buildDemoToken, demoCookieOptions } from "@/lib/memberAuth";
import { clearAnalyzeCache } from "@/lib/jobCache";
import { hasDatabase } from "@/lib/db";

/**
 * Libera cookie de inspeção e abre o feed pago.
 *
 * Modes:
 *   ?mode=cache          → o que o usuário viu (só cache)
 *   ?mode=analyze        → análise salva (cache); se não houver, roda e salva
 *   ?mode=analyze_fresh  → força nova análise ao vivo e sobrescreve o cache
 *   ?mode=clear_analyze  → limpa só o cache da análise e volta ao admin
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
    modeParam === "cache" ||
    modeParam === "analyze" ||
    modeParam === "analyze_fresh" ||
    modeParam === "clear_analyze"
      ? modeParam
      : url.searchParams.get("validate") === "0"
        ? "cache"
        : "analyze";

  if (mode === "clear_analyze") {
    if (hasDatabase()) {
      try {
        await clearAnalyzeCache(role);
      } catch {
        // ainda redireciona
      }
    }
    const admin = new URL("/admin", url.origin);
    admin.searchParams.set("cleared_analyze", role);
    return NextResponse.redirect(admin);
  }

  const dest = new URL("/app", url.origin);
  dest.searchParams.set("role", role);
  dest.searchParams.set("inspect", "1");

  if (mode === "cache") {
    dest.searchParams.set("mode", "cache");
    dest.searchParams.set("cache_only", "1");
  } else if (mode === "analyze_fresh") {
    dest.searchParams.set("mode", "analyze");
    dest.searchParams.set("validate", "1");
    dest.searchParams.set("fresh", "1");
  } else {
    // analyze: prefer cache salvo
    dest.searchParams.set("mode", "analyze");
    dest.searchParams.set("validate", "1");
  }

  const res = NextResponse.redirect(dest);
  const cookie = demoCookieOptions(buildDemoToken());
  res.cookies.set(cookie.name, cookie.value, cookie);
  return res;
}
