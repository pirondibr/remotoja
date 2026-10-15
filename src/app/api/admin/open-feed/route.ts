import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { buildDemoToken, demoCookieOptions } from "@/lib/memberAuth";

/**
 * Libera cookie de inspeção e abre o feed pago com relatório.
 * GET /api/admin/open-feed?role=seo&validate=1
 */
export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const role = (url.searchParams.get("role") || "SEO").trim() || "SEO";
  const validate = url.searchParams.get("validate") !== "0";
  const inspect = url.searchParams.get("inspect") !== "0";

  const dest = new URL("/app", url.origin);
  dest.searchParams.set("role", role);
  if (inspect) dest.searchParams.set("inspect", "1");
  if (validate) dest.searchParams.set("validate", "1");

  const res = NextResponse.redirect(dest);
  const cookie = demoCookieOptions(buildDemoToken());
  res.cookies.set(cookie.name, cookie.value, cookie);
  return res;
}
