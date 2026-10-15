import { cleanText, slugify } from "@/lib/dashboard/common";
import type { DashboardJob } from "@/lib/dashboard/types";

type RemotarJob = {
  id?: number;
  title?: string;
  subtitle?: string;
  description?: string;
  type?: string;
  city?: string | null;
  state?: string | null;
  createdAt?: string;
  externalLink?: string | null;
  thumbnailUrl?: string | null;
  jobSalary?: { min?: number | null; max?: number | null; currency?: string | null } | null;
  company?: {
    name?: string;
    companyProfilePicture?: {
      url?: string | null;
      smallUrl?: string | null;
      mediumUrl?: string | null;
    } | null;
  } | null;
  companyDisplayName?: string | null;
};

function remotarLogo(row: RemotarJob): string | null {
  const pic = row.company?.companyProfilePicture;
  const url =
    pic?.smallUrl || pic?.mediumUrl || pic?.url || row.thumbnailUrl || "";
  return url.trim() || null;
}

function remotarSalary(row: RemotarJob): string | null {
  const s = row.jobSalary;
  if (!s) return null;
  const min = s.min != null ? Number(s.min) : null;
  const max = s.max != null ? Number(s.max) : null;
  if (min == null && max == null) return null;
  const fmt = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  if (min != null && max != null && min !== max) return `${fmt(min)} a ${fmt(max)}`;
  if (min != null) return fmt(min);
  if (max != null) return fmt(max);
  return null;
}

export async function fetchRemotar(term: string): Promise<DashboardJob[]> {
  const url = `https://api.remotar.com.br/jobs?search=${encodeURIComponent(term.trim())}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129.0.0.0 Safari/537.36",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Remotar HTTP ${res.status}`);
  const data = (await res.json()) as { data?: RemotarJob[] };
  const rows = data.data || [];
  const out: DashboardJob[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const title = (row.title || "").trim();
    const company = (
      row.company?.name ||
      row.companyDisplayName ||
      "Remotar"
    ).trim();
    if (!title || !row.id) continue;
    const id = String(row.id);
    if (seen.has(id)) continue;
    seen.add(id);
    const companySlug = slugify(company) || "empresa";
    const titleSlug = slugify(title) || "vaga";
    const typeText = `${row.type || ""} ${row.subtitle || ""}`;
    const cityState = [row.city, row.state].filter(Boolean).join(", ");
    const looksRemote = /remot|home\s*office|dist[aâ]ncia/i.test(
      `${typeText} ${cityState} ${title}`
    );
    const looksHybrid = /h[ií]brid|hybrid|presencial/i.test(
      `${typeText} ${title}`
    );
    const location = cityState || (looksRemote && !looksHybrid ? "Remoto" : "");
    out.push({
      title,
      company,
      location: location || "Brasil",
      source: "remotar",
      source_url:
        row.externalLink ||
        `https://remotar.com.br/job/${id}/${companySlug}/${titleSlug}`,
      company_logo: remotarLogo(row),
      salary: remotarSalary(row),
      posted: (row.createdAt || "").slice(0, 10) || null,
      job_id: `remotar-${id}`,
      // Não assumir remoto: a validação da página decide de verdade
      remote: looksRemote && !looksHybrid,
      snippet: cleanText(row.subtitle || row.description || "", 220) || null,
    });
  }
  return out;
}
