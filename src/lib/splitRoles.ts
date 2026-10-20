const MAX_ROLES = 4;

const COMPOUNDS = [
  "recrutamento e selecao",
  "recursos humanos",
  "gestao financeira",
  "gestao de pessoas",
  "suporte administrativo",
  "assistente administrativo",
  "auxiliar administrativo",
  "assistente financeiro",
  "analista financeiro",
  "analista de rh",
  "analista de recrutamento",
  "analista de dados",
  "analista de sistemas",
  "customer success",
  "customer service",
  "social media",
  "sucesso do cliente",
  "atendimento ao cliente",
  "product designer",
  "product manager",
  "project manager",
  "gerente de projetos",
  "gerente financeiro",
  "coordenador financeiro",
  "business partner",
  "people partner",
].sort((a, b) => b.length - a.length);

const AFFIXES = new Set([
  "analista",
  "assistente",
  "auxiliar",
  "gestor",
  "gestao",
  "gerente",
  "coordenador",
  "especialista",
  "pleno",
  "senior",
  "sênior",
  "junior",
  "júnior",
  "jr",
  "sr",
  "remoto",
  "remota",
]);

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
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

function significantWords(value: string): string[] {
  return fold(value)
    .split(/\s+/)
    .filter((part) => part.length >= 2 && !["de", "da", "do", "das", "dos", "e", "em"].includes(part));
}

function leftoverIsAffix(value: string): boolean {
  const parts = significantWords(value);
  if (parts.length === 0) return true;
  return parts.every((part) => AFFIXES.has(part) || part.length <= 2);
}

function extractFromChunk(part: string): string[] {
  const trimmed = part.replace(/\s+/g, " ").trim();
  if (!trimmed) return [];
  const folded = fold(trimmed);
  const found: string[] = [];
  let rest = folded;
  for (const compound of COMPOUNDS) {
    if (rest.includes(compound)) {
      found.push(titleCaseRole(compound.replace("selecao", "seleção").replace("gestao", "gestão")));
      rest = rest.replace(compound, " | ");
    }
  }
  const leftovers = rest
    .split("|")
    .map((chunk) => chunk.replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim())
    .filter((chunk) => {
      if (chunk.startsWith("e ")) return false;
      return significantWords(chunk).length >= 2 && !leftoverIsAffix(chunk);
    })
    .map(titleCaseRole);

  if (found.length === 0) return [trimmed];
  if (leftovers.length === 0) {
    return found.length === 1 ? [trimmed] : found;
  }
  return [...found, ...leftovers];
}

function dedupe(roles: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const role of roles) {
    const key = fold(role);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(role.trim());
  }
  return out;
}

/** Separa cargos colados (vírgula, barra, ou títulos conhecidos em sequência). */
export function splitRoleQuery(raw: string): string[] {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const parts = cleaned
    .split(/[,;|/•·\n]+|\s+ou\s+/i)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
  const roles = dedupe(parts.flatMap(extractFromChunk));
  if (roles.length === 0) return [cleaned];
  return roles.slice(0, MAX_ROLES);
}

export function looksLikeMultipleRoles(raw: string): boolean {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (cleaned.length < 8) return false;
  if (splitRoleQuery(cleaned).length > 1) return true;
  if (/[,;|/•·]/.test(cleaned)) return true;
  return significantWords(cleaned).length >= 8;
}
