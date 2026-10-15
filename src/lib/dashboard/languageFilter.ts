/**
 * Filtro de idioma PT-BR para vagas.
 * Serve principalmente o LinkedIn (muita vaga em inglês), mas aplica a todos os scrapes.
 */

const PT_DIACRITICS =
  /[áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ]/;

/** Palavras/cargos típicos de anúncios em português. */
const PT_MARKERS =
  /\b(atendimento|atendente|analista|assistente|desenvolvedor|programador|est[aá]gio|estagi[aá]rio|j[uú]nior|pleno|s[eê]nior|coordenador|supervisor|gerente|gestor|vendedor|vendas|comercial|financeiro|recursos?\s*humanos|\brh\b|marketing|conte[uú]do|redator|designer|produto|suporte|cliente|relacionamento|opera[cç][oõ]es|administrativ[oa]|recepcionista|secret[aá]ri[oa]|home\s*office|remoto|remota|vaga|sal[aá]rio|benef[ií]cios|requisitos|experi[eê]ncia|ensino\s+m[eé]dio|superior\s+comple|clt|pj\b|trabalho|empresa|candidato)\b/i;

/** Sinais fortes de anúncio só em inglês (sem PT). */
const EN_MARKERS =
  /\b(customer\s+service|customer\s+support|customer\s+success|retention\s+specialist|representative|we'?re\s+looking|looking\s+for|years?\s+of\s+experience|bachelor'?s|native\s+english|fluent\s+english|based\s+in\s+the\s+(us|usa|uk|united\s+states)|work\s+from\s+home\s+usa|full[\s-]?time|part[\s-]?time|must\s+have|responsibilities|requirements|about\s+the\s+role|join\s+our\s+team|software\s+engineer|account\s+executive|inside\s+sales|outbound|inbound\s+sales)\b/i;

function jobText(job: {
  title?: string;
  snippet?: string | null;
  location?: string;
  company?: string;
}): string {
  return [job.title, job.snippet, job.location, job.company]
    .filter(Boolean)
    .join(" ");
}

/**
 * true = manter no feed (português / ambíguo BR).
 * false = descartar (claramente inglês).
 */
export function isPortugueseJob(job: {
  title?: string;
  snippet?: string | null;
  location?: string;
  company?: string;
}): boolean {
  const text = jobText(job).trim();
  if (!text) return false;

  if (PT_DIACRITICS.test(text)) return true;
  if (PT_MARKERS.test(text)) return true;

  // Título/descrição tipicamente em inglês, sem marca PT
  if (EN_MARKERS.test(text)) return false;

  // Título só ASCII “Customer Retention Specialist” etc.
  const title = (job.title || "").trim();
  if (
    title &&
    /^[A-Za-z0-9\s\-\/&,().:+#']+$/.test(title) &&
    /\b(specialist|representative|engineer|manager|associate|officer|analyst|developer|designer|executive|coordinator)\b/i.test(
      title
    ) &&
    !PT_MARKERS.test(title)
  ) {
    return false;
  }

  // Ambíguo (portais BR costumam ser PT) → mantém
  return true;
}

export function filterPortugueseJobs<T extends {
  title?: string;
  snippet?: string | null;
  location?: string;
  company?: string;
}>(jobs: T[]): { kept: T[]; dropped: number } {
  const kept: T[] = [];
  let dropped = 0;
  for (const job of jobs) {
    if (isPortugueseJob(job)) kept.push(job);
    else dropped += 1;
  }
  return { kept, dropped };
}
