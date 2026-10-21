import { formatDemoJobAgo, type DemoJob } from "@/lib/demoJobs";

export type LockedPreviewJob = {
  title: string;
  portal: string;
  when: string;
  fora: boolean;
};

export const VISIBLE_LOCKED_TITLES = 10;

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

/** Só títulos reais do feed. Sem linha inventada. */
export function buildLockedPreviewJobs(
  leftover: DemoJob[]
): LockedPreviewJob[] {
  const seen = new Set<string>();
  const out: LockedPreviewJob[] = [];

  for (const job of leftover) {
    const title = (job.title || "").trim();
    if (!title) continue;
    const key = title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({
      title,
      portal: portalLabel(job.source),
      when: formatDemoJobAgo(job),
      fora: isOffLinkedIn(job.source || ""),
    });
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
