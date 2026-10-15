/**
 * Transforma o cargo digitado no funil em query do Google Vagas (BR).
 *
 * Exemplos:
 *   programador  → vagas de programador home office
 *   SEO          → vagas de seo home office
 *   vagas de designer remoto → (mantém, só normaliza espaços)
 */
export function buildJobsQuery(roleOrKeyword: string): string {
  const cleaned = roleOrKeyword.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return "vagas remotas home office";
  }

  const lower = cleaned.toLowerCase();
  const alreadyQualified =
    lower.includes("vagas") ||
    lower.includes("home office") ||
    lower.includes("remoto") ||
    lower.includes("remote") ||
    lower.includes("trabalho em casa");

  if (alreadyQualified) {
    return cleaned;
  }

  return `vagas de ${cleaned} home office`;
}
