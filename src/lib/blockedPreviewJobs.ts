import { formatDemoJobAgo, type DemoJob } from "@/lib/demoJobs";

export type LockedPreviewJob = {
  title: string;
  portal: string;
  when: string;
  fora: boolean;
};

export const MIN_LOCKED_PREVIEW = 16;
export const VISIBLE_LOCKED_TITLES = 10;

const PORTALS = [
  { name: "Gupy", fora: true },
  { name: "Programathor", fora: true },
  { name: "InfoJobs", fora: true },
  { name: "Indeed", fora: false },
  { name: "Catho", fora: true },
  { name: "Remotar", fora: true },
  { name: "LinkedIn", fora: false },
] as const;

const WHENS = [
  "hoje",
  "8 horas atrás",
  "1 dia atrás",
  "hoje",
  "2 dias atrás",
  "3 horas atrás",
  "1 dia atrás",
  "hoje",
];

const SUFFIXES = [
  "– Home Office",
  "Pleno",
  "Sênior — 100% remoto",
  "Júnior",
  "Pleno – Remoto",
  "(PJ) remoto",
  "Sênior",
  "— vaga urgente",
];

export function isOffLinkedIn(source: string): boolean {
  return !source.toLowerCase().includes("linkedin");
}

function portalLabel(source: string): string {
  const raw = (source || "").trim();
  if (!raw) return "Portal";
  const lower = raw.toLowerCase();
  if (lower.includes("gupy")) return "Gupy";
  if (lower.includes("linkedin")) return "LinkedIn";
  if (lower.includes("indeed")) return "Indeed";
  if (lower.includes("catho")) return "Catho";
  if (lower.includes("infojobs")) return "InfoJobs";
  if (lower.includes("programathor")) return "Programathor";
  if (lower.includes("remotar")) return "Remotar";
  return raw.split(/[·|]/)[0]?.trim() || "Portal";
}

/** Completa a lista bloqueada com pelo menos 16 linhas (demo é só amostra). */
export function buildLockedPreviewJobs(
  role: string,
  leftover: DemoJob[],
  min = MIN_LOCKED_PREVIEW
): LockedPreviewJob[] {
  const cargo = role.trim() || "vaga remota";
  const seen = new Set<string>();
  const out: LockedPreviewJob[] = [];

  const push = (row: LockedPreviewJob) => {
    const key = row.title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(row);
  };

  for (const job of leftover) {
    const title = (job.title || "").trim();
    if (!title) continue;
    push({
      title,
      portal: portalLabel(job.source),
      when: formatDemoJobAgo(job),
      fora: isOffLinkedIn(job.source || ""),
    });
  }

  let i = 0;
  while (out.length < min && i < 48) {
    const portal = PORTALS[i % PORTALS.length];
    push({
      title: `${cargo} ${SUFFIXES[i % SUFFIXES.length]}`.replace(/\s+/g, " ").trim(),
      portal: portal.name,
      when: WHENS[i % WHENS.length],
      fora: portal.fora,
    });
    i += 1;
  }
  return out;
}

export function isPublishedToday(when: string): boolean {
  const lower = when.toLowerCase();
  return (
    lower === "hoje" ||
    lower === "agora" ||
    lower.includes("minuto") ||
    lower.includes("hora")
  );
}
