import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { buildDemoToken, demoCookieOptions } from "@/lib/memberAuth";
import { clearAnalyzeCache, parseCacheKind } from "@/lib/jobCache";
import { hasDatabase } from "@/lib/db";

/**
 * Libera cookie de inspeção e abre o feed (demo ou pago).
 *
 * Modes:
 *   ?mode=member         → visão do membro (sem inspect/logs)
 *   ?mode=cache          → o que o usuário viu (só cache)
 *   ?mode=analyze        → análise salva (cache); se não houver, roda e salva
 *   ?mode=analyze_fresh  → força nova análise ao vivo e sobrescreve o cache
 *   ?mode=clear_analyze  → limpa só o cache da análise e volta ao admin
 *   ?script=demo|paid|demo1 → qual cache usar (default paid)
 *
 * GET /api/admin/open-feed?role=seo&mode=cache&script=demo
 */
export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const role = (url.searchParams.get("role") || "SEO").trim() || "SEO";
  const kind = parseCacheKind(url.searchParams.get("script") || "paid");
  const modeParam = (url.searchParams.get("mode") || "").toLowerCase();
  // Compat: validate=1 antigo = analyze
  const mode =
    modeParam === "member" ||
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
        await clearAnalyzeCache(role, kind);
      } catch {
        // ainda redireciona
      }
    }
    const admin = new URL("/admin", url.origin);
    admin.searchParams.set("cleared_analyze", `${kind}:${role}`);
    return NextResponse.redirect(admin);
  }

  const dest = new URL("/app", url.origin);
  dest.searchParams.set("role", role);

  if (mode === "member") {
    // Mesma tela do membro pago — sem inspect, logs ou abas de análise
    const res = NextResponse.redirect(dest);
    const cookie = demoCookieOptions(buildDemoToken());
    res.cookies.set(cookie.name, cookie.value, cookie);
    return res;
  }

  dest.searchParams.set("inspect", "1");
  dest.searchParams.set("script", kind);

  if (mode === "cache") {
    dest.searchParams.set("mode", "cache");
    dest.searchParams.set("cache_only", "1");
  } else if (mode === "analyze_fresh") {
    dest.searchParams.set("mode", "analyze");
    dest.searchParams.set("validate", "1");
    dest.searchParams.set("fresh", "1");
  } else {
    // analyze: prefer cache salvo — NUNCA incluir fresh=1 (link compartilhável)
    dest.searchParams.set("mode", "analyze");
    dest.searchParams.set("validate", "1");
  }

  const res = NextResponse.redirect(dest);
  const cookie = demoCookieOptions(buildDemoToken());
  res.cookies.set(cookie.name, cookie.value, cookie);
  return res;
}
