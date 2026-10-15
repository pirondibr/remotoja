/** Extrai salário, experiência e escolaridade de HTML/texto de página de vaga. */

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function extractSalary(text: string): string | null {
  const patterns = [
    /R\$\s*[\d.]+(?:,\d{2})?\s*(?:a|até|ate|-|–|—)\s*R\$\s*[\d.]+(?:,\d{2})?/i,
    /R\$\s*[\d.]+(?:,\d{2})?\s*(?:a|até|ate|-|–|—)\s*[\d.]+(?:,\d{2})?/i,
    /(?:sal[aá]rio|remunera[cç][aã]o)\s*[:\-]?\s*(R\$\s*[\d.]+(?:,\d{2})?(?:\s*(?:a|até|ate|-|–)\s*R\$\s*[\d.]+(?:,\d{2})?)?)/i,
    /A\s+combinar/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const value = clean(m[1] || m[0]);
      if (/a\s+combinar/i.test(value)) return "A combinar";
      if (value.length >= 4 && value.length <= 80) return value;
    }
  }
  return null;
}

export function extractExperience(text: string): string | null {
  const patterns = [
    /Entre\s+\d+\s+e\s+\d+\s+anos/i,
    /\d+\s*(?:a|até|ate|-|–)\s*\d+\s+anos(?:\s+de\s+experi[eê]ncia)?/i,
    /(?:experi[eê]ncia|tempo\s+de\s+experi[eê]ncia)\s*[:\-]?\s*([^\n.<]{3,60})/i,
    /(?:j[uú]nior|pleno|s[eê]nior|est[aá]gio)(?:\s*\/\s*(?:j[uú]nior|pleno|s[eê]nior))?/i,
    /Sem\s+experi[eê]ncia/i,
    /Experi[eê]ncia\s+n[aã]o\s+exigida/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const value = clean(m[1] || m[0]);
    if (value.length >= 3 && value.length <= 80) return value;
  }
  return null;
}

export function extractEducation(text: string): string | null {
  const patterns = [
    /Ensino\s+Superior(?:\s+completo|\s+incompleto)?/i,
    /Superior\s+completo/i,
    /Ensino\s+M[eé]dio(?:\s+completo|\s+incompleto)?/i,
    /P[oó]s[-\s]?gradua[cç][aã]o/i,
    /MBA/i,
    /(?:escolaridade|forma[cç][aã]o)\s*[:\-]?\s*([^\n.<]{3,60})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const value = clean(m[1] || m[0]);
    if (value.length >= 3 && value.length <= 80) return value;
  }
  return null;
}

export function extractJobDetailsFromText(text: string): {
  salary: string | null;
  experience: string | null;
  education: string | null;
} {
  // Limita para regex mais estável
  const sample = text.slice(0, 120_000);
  return {
    salary: extractSalary(sample),
    experience: extractExperience(sample),
    education: extractEducation(sample),
  };
}
