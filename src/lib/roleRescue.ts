import { looksLikeMultipleRoles, splitRoleQuery } from "@/lib/splitRoles";

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
  "para",
  "por",
  "com",
  "e",
  "ou",
  "um",
  "uma",
]);

/** Vocabulário de cargos/áreas — usado só para corrigir typo próximo. */
const ROLE_VOCAB = [
  "administrativo",
  "administrativa",
  "assistente",
  "auxiliar",
  "analista",
  "coordenador",
  "coordenadora",
  "gerente",
  "gestor",
  "gestora",
  "supervisor",
  "supervisora",
  "especialista",
  "consultor",
  "consultora",
  "secretario",
  "secretaria",
  "recepcionista",
  "licitacao",
  "licitacoes",
  "pregao",
  "contratos",
  "compras",
  "comprador",
  "financeiro",
  "financeira",
  "atendimento",
  "atendente",
  "desenvolvedor",
  "desenvolvedora",
  "programador",
  "programadora",
  "designer",
  "redator",
  "redatora",
  "vendedor",
  "vendedora",
  "comercial",
  "marketing",
  "recrutamento",
  "selecao",
  "suporte",
  "operacoes",
  "operacao",
  "logistica",
  "relacionamento",
  "recepcao",
  "faturamento",
  "contabil",
  "contabilidade",
  "departamento",
  "pessoal",
  "sucesso",
  "cliente",
  "clientes",
  "produto",
  "projetos",
  "projeto",
  "dados",
  "sistemas",
  "qualidade",
  "facilities",
  "tesouraria",
  "cobranca",
  "fiscal",
  "juridico",
  "juridica",
  "enfermagem",
  "enfermeiro",
  "enfermeira",
];

export type RoleSearchPlan = {
  original: string;
  corrected: string;
  primary: string;
  attempts: string[];
  multiple: boolean;
  split: string[];
};

export function foldRole(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const next = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = next;
    }
  }
  return row[b.length];
}

function correctWord(folded: string): string {
  if (folded.length < 4 || STOPWORDS.has(folded)) return folded;
  if (ROLE_VOCAB.includes(folded)) return folded;
  const max = folded.length >= 8 ? 2 : 1;
  let best: { word: string; dist: number } | null = null;
  for (const word of ROLE_VOCAB) {
    if (Math.abs(word.length - folded.length) > max) continue;
    const dist = levenshtein(folded, word);
    if (dist === 0) return word;
    if (dist > max) continue;
    if (!best || dist < best.dist) best = { word, dist };
  }
  return best?.word || folded;
}

function titleCaseRole(value: string): string {
  const small = new Set(["e", "de", "da", "do", "das", "dos", "em"]);
  return value
    .trim()
    .split(/\s+/)
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (i > 0 && small.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/** Corrige typo óbvio (admistrativo → administrativo) sem mudar o sentido. */
export function correctRoleTypos(raw: string): string {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const next = cleaned
    .split(/\s+/)
    .map((word) => {
      const folded = foldRole(word);
      const corrected = correctWord(folded);
      return corrected === folded ? word : corrected;
    })
    .join(" ");
  return titleCaseRole(next);
}

/** Radical PT simples: plural, ção/ções, gênero o/a. */
export function stemRoleWord(word: string): string {
  let t = foldRole(word);
  if (t.endsWith("coes") || t.endsWith("caes")) t = `${t.slice(0, -4)}cao`;
  else if (t.endsWith("oes") || t.endsWith("aes")) t = `${t.slice(0, -3)}ao`;
  else if (t.endsWith("ais")) t = `${t.slice(0, -3)}al`;
  else if (t.endsWith("eis")) t = `${t.slice(0, -3)}el`;
  else if (t.endsWith("ois")) t = `${t.slice(0, -3)}ol`;
  else if (t.endsWith("s") && t.length > 4) t = t.slice(0, -1);
  if (/[oa]$/.test(t) && t.length > 6) t = t.slice(0, -1);
  return t;
}

function stemsClose(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;
  if (a.includes(b) || b.includes(a)) {
    return Math.abs(a.length - b.length) <= 3;
  }
  return false;
}

/** A palavra do cargo aparece no texto, inclusive plural/gênero. */
export function wordInText(needle: string, hay: string): boolean {
  const n = foldRole(needle);
  const h = foldRole(hay);
  if (!n || !h) return false;
  if (h.includes(n)) return true;
  const nStem = stemRoleWord(n);
  if (nStem.length >= 4 && h.includes(nStem)) return true;
  return h
    .split(/\s+/)
    .some((part) => stemsClose(stemRoleWord(part), nStem));
}

function uniqueTerms(terms: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const term of terms) {
    const cleaned = term.replace(/\s+/g, " ").trim();
    const key = foldRole(cleaned);
    if (key.length < 2 || seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

/**
 * Plano de busca: corrige typo, separa cargos colados e lista tentativas
 * da mais específica para a mais larga.
 */
export function planRoleSearch(raw: string): RoleSearchPlan {
  const original = raw.replace(/\s+/g, " ").trim();
  const corrected = correctRoleTypos(original) || original;
  const split = splitRoleQuery(corrected);
  const multiple = split.length > 1 || looksLikeMultipleRoles(corrected);
  const roles = multiple && split.length > 1 ? split : [corrected];
  const primary = [...roles].sort((a, b) => b.length - a.length)[0] || corrected;
  const attempts = uniqueTerms([primary, ...roles, corrected, original]);
  return {
    original,
    corrected,
    primary,
    attempts,
    multiple,
    split,
  };
}

/** Remotar às vezes ignora o termo e devolve o feed inteiro. */
export function isUnfilteredDump(available: number, matched: number): boolean {
  return available > 400 && matched === 0;
}
