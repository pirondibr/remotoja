import {
  correctRoleTypos,
  foldRole,
  wordInText,
} from "@/lib/roleRescue";

export type MatchTier = "exato" | "relacionado" | "fora";

function norm(s: string): string {
  return foldRole(s);
}

/** Sinônimos / termos vizinhos por cargo (expandível). */
const RELATED_BY_TERM: Record<string, string[]> = {
  seo: [
    "sem",
    "search engine",
    "otimizacao",
    "otimização",
    "organic",
    "orgânico",
    "growth",
    "inbound",
  ],
  atendimento: [
    "atendente",
    "customer service",
    "customer success",
    "suporte",
    "sac",
    "call center",
    "callcenter",
    "relacionamento",
  ],
  atendente: [
    "atendimento",
    "customer service",
    "suporte",
    "sac",
    "call center",
  ],
  conteudo: ["content", "redator", "copywriter", "copy", "editor", "blog"],
  "social media": ["social", "community", "midias sociais", "mídias sociais"],
  midias: ["social media", "social", "community", "conteudo", "conteúdo"],
  marketing: ["growth", "performance", "inbound", "digital"],
  programador: [
    "desenvolvedor",
    "developer",
    "software engineer",
    "engenharia de software",
  ],
  desenvolvedor: ["programador", "developer", "software engineer"],
  assistente: ["auxiliar", "apoio"],
  auxiliar: ["assistente", "apoio"],
  licitacao: ["licitacoes", "pregao", "editais"],
  licitacoes: ["licitacao", "pregao", "editais"],
};

const STOPWORDS = new Set([
  "a",
  "o",
  "os",
  "as",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "em",
  "no",
  "na",
  "ao",
  "aos",
  "para",
  "por",
  "com",
  "e",
  "ou",
  "um",
  "uma",
]);

function significantParts(term: string): string[] {
  return term
    .split(/\s+/)
    .filter((p) => p.length >= 2 && !STOPWORDS.has(p));
}

function relatedHints(term: string): string[] {
  const t = norm(term);
  const hints = new Set<string>(RELATED_BY_TERM[t] || []);
  for (const [key, values] of Object.entries(RELATED_BY_TERM)) {
    if (t.includes(key) || key.includes(t)) {
      hints.add(key);
      for (const v of values) hints.add(norm(v));
    }
  }
  return [...hints];
}

/**
 * Classifica o alinhamento da vaga com o cargo pesquisado.
 * - exato: termo completo no título
 * - relacionado: palavras do termo / sinônimos no título
 * - fora: só aparece em empresa/snippet, ou não casa de verdade
 */
export function classifyCargoMatch(
  job: { title?: string; company?: string; snippet?: string | null },
  term: string
): MatchTier {
  const t = norm(correctRoleTypos(term) || term);
  if (!t) return "relacionado";

  const title = norm(job.title || "");
  const company = norm(job.company || "");
  const snippet = norm(job.snippet || "");
  const parts = significantParts(t);
  const titleHas = (part: string) => wordInText(part, title);

  if (titleHas(t)) return "exato";
  if (parts.length > 0 && parts.every((p) => titleHas(p))) return "exato";

  const hints = relatedHints(t);
  if (hints.some((h) => h.length >= 3 && titleHas(h))) {
    const extraParts = parts.filter(
      (part) => part.length >= 4 && !hints.includes(part)
    );
    if (extraParts.length === 0 || extraParts.some((part) => titleHas(part))) {
      return "relacionado";
    }
  }

  if (parts.length > 1) {
    const hit = parts.filter((p) => titleHas(p)).length;
    if (hit >= Math.ceil(parts.length * 0.6)) return "relacionado";
  } else if (parts[0] && parts[0].length >= 3 && titleHas(parts[0])) {
    return "exato";
  }

  const blob = `${company} ${snippet}`;
  if (wordInText(t, blob) || parts.every((p) => wordInText(p, blob))) {
    return "fora";
  }
  if (hints.some((h) => h.length >= 3 && wordInText(h, blob))) {
    return "fora";
  }

  return "fora";
}

/** Demo: aceita exato + relacionado (sinônimos), rejeita cargo misturado. */
export function roleFitsDemoJob(
  job: { title?: string; company?: string; snippet?: string | null },
  term: string
): boolean {
  const tier = classifyCargoMatch(job, term);
  return tier === "exato" || tier === "relacionado";
}

export function matchTierLabel(tier: MatchTier): string {
  if (tier === "exato") return "Exato";
  if (tier === "relacionado") return "Relacionado";
  return "Fora";
}
