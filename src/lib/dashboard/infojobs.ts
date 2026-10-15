import { cleanText, fetchHtml, slugify } from "@/lib/dashboard/common";
import type { DashboardJob } from "@/lib/dashboard/types";

function buildUrl(term: string): string {
  const slug = slugify(term) || "emprego";
  return `https://www.infojobs.com.br/vagas-de-emprego-${slug}-trabalho-home-office.aspx`;
}

function decodeEntities(text: string): string {
  return cleanText(text, 300);
}

export async function fetchInfoJobs(term: string): Promise<DashboardJob[]> {
  let html: string;
  try {
    html = await fetchHtml(buildUrl(term));
  } catch {
    // fallback sem filtro home-office
    const slug = slugify(term) || "emprego";
    html = await fetchHtml(
      `https://www.infojobs.com.br/vagas-de-emprego-${slug}.aspx`
    );
  }

  const parts = html.split(/<div[^>]+class="[^"]*card[^"]*js_rowCard[^"]*"/i);
  const out: DashboardJob[] = [];
  const seen = new Set<string>();

  for (const part of parts.slice(1)) {
    const href =
      part.match(/data-href="([^"]+)"/i)?.[1] ||
      part.match(/href="(\/vaga-de-[^"]+\.aspx)"/i)?.[1];
    const titleRaw = part.match(/<h2[^>]*>(.*?)<\/h2>/i)?.[1];
    const title = decodeEntities(titleRaw || "");
    if (!href || !title) continue;

    const companySlug = part.match(/\/empresa-([^_"]+)__/i);
    let company = companySlug?.[1]
      ? companySlug[1]
          .replace(/-/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase())
      : "";
    if (!company) {
      const companyLink = part.match(
        /href="https?:\/\/www\.infojobs\.com\.br\/empresa-[^"]+"[^>]*>(.*?)<\/a>/i
      );
      company = decodeEntities(
        (companyLink?.[1] || "").split(/Este selo/i)[0] || ""
      );
    }
    if (!company && /Empresa\s+confidencial/i.test(part)) {
      company = "Empresa confidencial";
    }
    if (!company) company = "InfoJobs";

    const locMatch =
      part.match(
        /(Todo Brasil|Home Office|[^|<]{3,40}\s-\s[A-Z]{2})/i
      ) || part.match(/([A-ZÁÉÍÓÚ][^|<]{2,40}\s-\s[A-Z]{2})/);
    const location = decodeEntities(locMatch?.[1] || "Home office");

    const idMatch = href.match(/__(\d+)\.aspx/);
    const id = idMatch?.[1] || slugify(title);
    if (seen.has(id)) continue;
    seen.add(id);

    const url = href.startsWith("http")
      ? href
      : `https://www.infojobs.com.br${href}`;

    out.push({
      title,
      company,
      location,
      source: "infojobs",
      source_url: url,
      job_id: `infojobs-${id}`,
      remote: true,
    });
  }
  return out;
}
