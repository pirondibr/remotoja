import demoJobsData from "@/data/demo-jobs.json";

export type DemoJob = {
  title: string;
  company: string;
  location: string;
  source: string;
  /** Como a vaga entrou no agregador (ex.: google_vagas). Pode diferir de source. */
  scrape?: string | null;
  source_url?: string | null;
  company_logo?: string | null;
  contract_type?: string | null;
  salary?: string | null;
  experience?: string | null;
  education?: string | null;
  posted?: string | null;
  job_id?: string | null;
  remote?: boolean;
  snippet?: string | null;
  /**
   * Veio do filtro remoto/home office do portal (Catho, Gupy, etc.).
   * Sem confirmação clara na página → status "indeciso" na análise.
   */
  from_remote_filter?: boolean;
  /** Alinhamento com o cargo pesquisado (feed pago / admin). */
  match_tier?: "exato" | "relacionado" | "fora" | null;
  /** Motivo curto da classificação de cargo (ex.: LLM). */
  match_reason?: string | null;
};

export type DemoJobsPayload = {
  query: string;
  location: string;
  fetched_via: string;
  count: number;
  jobs: DemoJob[];
};

export const demoJobsPayload = demoJobsData as DemoJobsPayload;

export function getDemoJobs(limit = 5): DemoJob[] {
  return demoJobsPayload.jobs.slice(0, limit);
}

function demoDedupeKey(job: DemoJob): string {
  const titleCompany = `${job.title || ""} ${job.company || ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  const id = (job.job_id || "").trim().toLowerCase();
  const url = (job.source_url || "").split("?")[0].trim().toLowerCase();
  return id ? `id:${id}` : url ? `url:${url}` : titleCompany;
}

/** Remove vagas repetidas (mesmo job_id / URL / título+empresa). */
export function dedupeDemoJobs(jobs: DemoJob[]): DemoJob[] {
  const seen = new Set<string>();
  const out: DemoJob[] = [];
  for (const job of jobs) {
    const key = demoDedupeKey(job);
    if (!key || seen.has(key)) continue;
    // Também bloqueia título+empresa se já entrou por id/url
    const titleKey = `${job.title || ""} ${job.company || ""}`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
    if (titleKey && seen.has(`tc:${titleKey}`)) continue;
    seen.add(key);
    if (titleKey) seen.add(`tc:${titleKey}`);
    out.push(job);
  }
  return out;
}

export function formatJobMeta(job: DemoJob): string {
  const parts = [
    job.remote ? "Remoto" : null,
    job.location,
    job.contract_type,
  ].filter(Boolean);
  return parts.join(" · ");
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many} atrás`;
}

/** Converte posted (ISO, "há X dias", "2 days ago"…) em "28 minutos atrás". */
export function formatRelativePosted(posted: string | null | undefined): string {
  const raw = (posted || "").trim();
  if (!raw) return "Recente";

  const lower = raw.toLowerCase();

  // Já no formato alvo
  if (/\batrás\b/.test(lower)) return raw.replace(/^há\s+/i, "");

  // "há 7 dias" / "ha 2 horas"
  const ha = lower.match(
    /^h[aá]\s+(\d+)\s+(minutos?|horas?|dias?|semanas?|m[eê]s(?:es)?)\b/
  );
  if (ha) {
    const n = Number(ha[1]);
    const u = ha[2];
    if (u.startsWith("minuto")) return plural(n, "minuto", "minutos");
    if (u.startsWith("hora")) return plural(n, "hora", "horas");
    if (u.startsWith("dia")) return plural(n, "dia", "dias");
    if (u.startsWith("semana")) return plural(n, "semana", "semanas");
    return plural(n, "mês", "meses");
  }

  // Inglês: "28 minutes ago", "5 days ago"
  const en = lower.match(
    /^(\d+)\s+(minute|minutes|hour|hours|day|days|week|weeks|month|months)\s+ago$/
  );
  if (en) {
    const n = Number(en[1]);
    const map: Record<string, [string, string]> = {
      minute: ["minuto", "minutos"],
      minutes: ["minuto", "minutos"],
      hour: ["hora", "horas"],
      hours: ["hora", "horas"],
      day: ["dia", "dias"],
      days: ["dia", "dias"],
      week: ["semana", "semanas"],
      weeks: ["semana", "semanas"],
      month: ["mês", "meses"],
      months: ["mês", "meses"],
    };
    const [one, many] = map[en[2]];
    return plural(n, one, many);
  }

  // dd/mm/yyyy ou dd-mm-yyyy
  const br = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  let date: Date | null = null;
  if (br) {
    date = new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
  } else {
    // ISO / yyyy-mm-dd
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  }

  if (!date || Number.isNaN(date.getTime())) return raw;

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return "Recente";

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return plural(minutes, "minuto", "minutos");

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return plural(hours, "hora", "horas");

  const days = Math.floor(hours / 24);
  if (days < 7) return plural(days, "dia", "dias");

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return plural(weeks, "semana", "semanas");

  const months = Math.floor(days / 30);
  if (months < 12) return plural(Math.max(1, months), "mês", "meses");

  const years = Math.floor(days / 365);
  return plural(Math.max(1, years), "ano", "anos");
}

export function formatJobAgo(job: DemoJob): string {
  return formatRelativePosted(job.posted);
}

/** Seed estável → 1..20 (mesma vaga não “pisca” a cada render). */
export function demoFakePostedHours(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 20) + 1;
}

/**
 * Tempo relativo fake pro funil demo (1–20 horas atrás).
 * Evita mostrar “3 dias / 2 semanas” de fontes baratas — no pago o scrape traz frescas.
 */
export function formatDemoJobAgo(job: DemoJob): string {
  const seed = job.job_id || `${job.title}|${job.company}`;
  return plural(demoFakePostedHours(seed), "hora", "horas");
}

export function withDemoFakePosted(jobs: DemoJob[]): DemoJob[] {
  return jobs.map((job) => {
    const seed = job.job_id || `${job.title}|${job.company}`;
    const n = demoFakePostedHours(seed);
    return {
      ...job,
      posted: n === 1 ? "há 1 hora" : `há ${n} horas`,
    };
  });
}

export function formatJobBadge(job: DemoJob): string {
  const source = (job.source || "").trim();
  if (!source) return "Remoto";
  if (/google\s*vagas?/i.test(source)) return "Remoto";
  return source;
}
