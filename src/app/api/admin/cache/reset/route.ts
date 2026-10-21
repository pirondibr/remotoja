import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { clearCache, type CacheKind } from "@/lib/jobCache";
import { hasDatabase } from "@/lib/db";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!hasDatabase()) {
    return NextResponse.json(
      { error: "DATABASE_URL ausente" },
      { status: 503 }
    );
  }

  let kind: CacheKind | "all" = "demo";
  try {
    const body = (await request.json()) as { kind?: string };
    if (
      body.kind === "paid" ||
      body.kind === "demo" ||
      body.kind === "demo1" ||
      body.kind === "all"
    ) {
      kind = body.kind;
    } else {
      return NextResponse.json(
        { error: "kind deve ser demo | paid | demo1 | all" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  try {
    const result = await clearCache(kind);
    return NextResponse.json({ ok: true, kind, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao resetar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
