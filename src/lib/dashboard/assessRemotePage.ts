import type { DashboardJob } from "@/lib/dashboard/types";

export type RemoteAssess =
  | { ok: true; reason: string }
  | {
      ok: false;
      kind: "false_positive" | "indeciso" | "invalid_link";
      reason: string;
    };

const DEAD_PAGE_RE =
  /link you accessed isn'?t valid|oops,?\s*looks like|vaga\s+(n[aã]o\s+encontrada|indispon[ií]vel|encerrada|expirada|removida)|job\s+(not\s+found|no\s+longer\s+available)|p[aá]gina\s+n[aã]o\s+encontrada|this\s+job\s+is\s+no\s+longer|conte[uú]do\s+n[aã]o\s+encontrado|error\s*404|http\s*404/i;

/** Modalidade claramente remota (forte). */
const STRONG_REMOTE_RE =
  /100%\s*remoto|totalmente\s+remoto|fully\s*remote|apenas\s+remoto|somente\s+remoto|remote\s*only|trabalho\s+(100%\s*)?a\s+dist[aâ]ncia|home\s*office|work\s+from\s+home|\bwfh\b|modelo\s*[:\-]?\s*remoto|regime\s*[:\-]?\s*remoto|formato\s*[:\-]?\s*remoto|localidade\s*[:\-]?\s*remoto|localization\s*[:\-]?\s*remote|\bremoto\b|\bremota\b|\bremote\b/i;

/** Sinais de híbrido / presencial como modalidade. */
const HYBRID_OR_ONSITE_RE =
  /\bh[ií]brido\b|\bhybrid\b|\bpresencial\b|\bon[\s-]?site\b|\bno\s+escrit[oó]rio\b|\bem\s+escrit[oó]rio\b|modelo\s*[:\-]?\s*h[ií]brido|regime\s*[:\-]?\s*h[ií]brido|formato\s*[:\-]?\s*h[ií]brido/i;

/** Título/lixo que não é vaga real. */
const JUNK_TITLE_RE =
  /buscas?\s+de\s+empregos?\s+relacionad|vagas?\s+relacionad|similar\s+jobs|recommended\s+jobs/i;

/**
 * Modalidade estruturada (Gupy __NEXT_DATA__, JSON-LD, etc.).
 * Não usar só o HTML visível: SPAs guardam "Remoto" em <script>,
 * e o i18n da página também lista "Híbrido" como label — isso gerava FP.
 */
const STRUCTURED_WORKPLACE_RE =
  /"workplaceType"\s*:\s*"(remote|remoto|hybrid|h[ií]brido|on[\s_-]?site|onsite|presencial)"/i;

const STRUCTURED_TELECOMMUTE_RE =
  /jobLocationType"\s*:\s*"TELECOMMUTE"|"@type"\s*:\s*"Telecommute"/i;

type StructuredModality = "remote" | "hybrid" | "onsite" | null;

function structuredModality(html: string): StructuredModality {
  const wt = html.match(STRUCTURED_WORKPLACE_RE)?.[1]?.toLowerCase() || "";
  if (wt === "remote" || wt === "remoto") return "remote";
  if (wt.startsWith("hybrid") || /h[ií]brid/.test(wt)) return "hybrid";
  if (wt.includes("on") || wt.includes("site") || wt.includes("presencial")) {
    return "onsite";
  }
  if (STRUCTURED_TELECOMMUTE_RE.test(html)) return "remote";
  return null;
}

function normalize(text: string): string {
  return (text || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasStrongRemote(text: string): boolean {
  return STRONG_REMOTE_RE.test(text);
}

function hasHybridOrOnsite(text: string): boolean {
  return HYBRID_OR_ONSITE_RE.test(text);
}

/**
 * Decide se a vaga é 100% remota com base no título/local + conteúdo da página.
 * NÃO confia no flag `job.remote` dos scrapers (Remotar etc. marcam quase tudo como remoto).
 */
export function assessRemotePage(
  job: DashboardJob,
  pageHtml: string
): RemoteAssess {
  if (JUNK_TITLE_RE.test(job.title || "")) {
    return {
      ok: false,
      kind: "false_positive",
      reason: "título não é uma vaga real",
    };
  }

  const page = normalize(pageHtml).slice(0, 80_000);
  if (page.length < 80) {
    return {
      ok: false,
      kind: "invalid_link",
      reason: "página vazia ou bloqueada",
    };
  }

  if (DEAD_PAGE_RE.test(page)) {
    return {
      ok: false,
      kind: "invalid_link",
      reason: "página indica vaga inválida/encerrada",
    };
  }

  const structured = structuredModality(pageHtml);
  if (structured === "hybrid" || structured === "onsite") {
    return {
      ok: false,
      kind: "false_positive",
      reason: "modalidade híbrida/presencial (não 100% remoto)",
    };
  }
  if (structured === "remote") {
    return {
      ok: true,
      reason: "modalidade remota nos dados da página (workplaceType/JSON-LD)",
    };
  }

  const meta = [job.title || "", job.location || "", job.snippet || ""].join(
    " "
  );
  const combined = `${meta} ${page}`;

  const metaRemote = hasStrongRemote(meta);
  const pageRemote = hasStrongRemote(page);
  const metaHybrid = hasHybridOrOnsite(meta);
  const pageHybrid = hasHybridOrOnsite(page);

  // "Híbrido ou Remoto" / Hybrid como modalidade → não é 100% remoto
  if (metaHybrid || pageHybrid) {
    const exclusiveRemote =
      /100%\s*remoto|totalmente\s+remoto|fully\s*remote|apenas\s+remoto|somente\s+remoto|remote\s*only/i.test(
        combined
      );
    if (!exclusiveRemote) {
      return {
        ok: false,
        kind: "false_positive",
        reason: "modalidade híbrida/presencial (não 100% remoto)",
      };
    }
  }

  if (metaRemote || pageRemote) {
    return {
      ok: true,
      reason: metaRemote
        ? "título/local indica remoto"
        : "página menciona remoto/home office",
    };
  }

  // Veio do filtro remoto do portal, mas a página não deixa claro → indeciso
  if (job.from_remote_filter) {
    return {
      ok: false,
      kind: "indeciso",
      reason:
        "filtro remoto do portal, mas página não deixa claro (sem menção explícita)",
    };
  }

  return {
    ok: false,
    kind: "false_positive",
    reason: "sem menção a remoto/home office na página",
  };
}
