import demoJobsData from "@/data/demo-jobs.json";

export type DemoJob = {
  title: string;
  company: string;
  location: string;
  source: string;
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
  /** Alinhamento com o cargo pesquisado (feed pago / admin). */
  match_tier?: "exato" | "relacionado" | "fora" | null;
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

export function formatJobBadge(job: DemoJob): string {
  const source = (job.source || "").trim();
  if (!source) return "Remoto";
  if (/google\s*vagas?/i.test(source)) return "Remoto";
  return source;
}
