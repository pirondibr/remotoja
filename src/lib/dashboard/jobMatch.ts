export type MatchTier = "exato" | "relacionado" | "fora";

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
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
};

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
  const t = norm(term);
  if (!t) return "relacionado";

  const title = norm(job.title || "");
  const company = norm(job.company || "");
  const snippet = norm(job.snippet || "");
  const parts = t.split(/\s+/).filter(Boolean);

  if (title.includes(t)) return "exato";
  if (parts.length > 1 && parts.every((p) => title.includes(p))) return "exato";

  const hints = relatedHints(t);
  if (hints.some((h) => h.length >= 3 && title.includes(h))) {
    return "relacionado";
  }

  // Maioria das palavras do termo no título
  if (parts.length > 1) {
    const hit = parts.filter((p) => title.includes(p)).length;
    if (hit >= Math.ceil(parts.length * 0.6)) return "relacionado";
  } else if (parts[0] && parts[0].length >= 3) {
    // termo curto: aceita raiz parcial no título (seo → seospecialist já coberto por includes)
    if (title.includes(parts[0])) return "exato";
  }

  const blob = `${company} ${snippet}`;
  if (blob.includes(t) || parts.every((p) => blob.includes(p))) {
    return "fora";
  }
  if (hints.some((h) => h.length >= 3 && blob.includes(h))) {
    return "fora";
  }

  return "fora";
}

export function matchTierLabel(tier: MatchTier): string {
  if (tier === "exato") return "Exato";
  if (tier === "relacionado") return "Relacionado";
  return "Fora";
}
