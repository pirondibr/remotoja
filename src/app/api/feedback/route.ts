import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db";
import { savePaywallFeedback } from "@/lib/paywallFeedback";

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

  try {
    const result = await savePaywallFeedback({
      reason: String(body.reason || ""),
      detail: body.detail != null ? String(body.detail) : null,
      role: body.role != null ? String(body.role) : null,
      email: body.email != null ? String(body.email) : null,
      funnelVariant:
        body.funnel_variant != null ? String(body.funnel_variant) : null,
      leadId: body.lead_id != null ? String(body.lead_id) : null,
    });
    if (!result) {
      return NextResponse.json({ error: "motivo inválido" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, id: result.id });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao gravar feedback";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
