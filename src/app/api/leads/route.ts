import { NextResponse } from "next/server";
import { logLeadSearch, sanitizeFunnelAnswers } from "@/lib/leadLog";
import { hasDatabase } from "@/lib/db";
import type { DemoJob } from "@/lib/demoJobs";

export async function POST(request: Request) {
  if (!hasDatabase()) {
    return NextResponse.json(
      { ok: false, skipped: true, reason: "DATABASE_URL ausente" },
      { status: 200 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const role = String(body.role || "").trim();
  if (role.length < 2) {
    return NextResponse.json({ error: "role obrigatório" }, { status: 400 });
  }

  const jobs_shown = Array.isArray(body.jobs_shown)
    ? (body.jobs_shown as DemoJob[]).slice(0, 50)
    : [];

  try {
    const result = await logLeadSearch({
      role,
      channel: String(body.channel || "demo"),
      utm_source: body.utm_source as string | undefined,
      utm_medium: body.utm_medium as string | undefined,
      utm_campaign: body.utm_campaign as string | undefined,
      utm_content: body.utm_content as string | undefined,
      utm_term: body.utm_term as string | undefined,
      fbclid: body.fbclid as string | undefined,
      gclid: body.gclid as string | undefined,
      referrer: body.referrer as string | undefined,
      jobs_shown,
      cached: Boolean(body.cached),
      user_agent: request.headers.get("user-agent"),
      answers: sanitizeFunnelAnswers(body.answers),
    });
    return NextResponse.json({ ok: true, id: result?.id ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao gravar lead";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
