import { cleanText, fetchHtml } from "@/lib/dashboard/common";
import type { DashboardJob } from "@/lib/dashboard/types";

export async function fetchCatho(term: string): Promise<DashboardJob[]> {
  const url =
    `https://www.catho.com.br/vagas/?q=${encodeURIComponent(term)}` +
    `&remoto_home_office=true`;
  let html: string;
  try {
    html = await fetchHtml(url, { timeoutMs: 30000 });
  } catch (err) {
    if (!process.env.SCRAPINGBEE_API_KEY) throw err;
    const { fetchScrapingBee } = await import("@/lib/dashboard/common");
    html = await fetchScrapingBee(url);
  }

  const articles = html.split(/data-offer-item="(\d+)"/i);
  const out: DashboardJob[] = [];
  const seen = new Set<string>();

  // split yields [before, id1, chunk1, id2, chunk2, ...]
  for (let i = 1; i < articles.length; i += 2) {
    const id = articles[i];
    const chunk = articles[i + 1] || "";
    const href =
      chunk.match(/href="(\/vagas\/[^"/]+\/\d+)"/i)?.[1] ||
      chunk.match(new RegExp(`href="(/vagas/[^"/]+/${id})"`, "i"))?.[1];
    const titleRaw =
      chunk.match(/<h2[^>]*class="[^"]*title_offer[^"]*"[^>]*>[\s\S]*?<a[^>]*>(.*?)<\/a>/i)?.[1] ||
      chunk.match(/title="([^"]+)"[^>]*data-navigation-offer/i)?.[1] ||
      chunk.match(/<h2[^>]*>(.*?)<\/h2>/i)?.[1];
    const companyRaw =
      chunk.match(/<span class="text-12">([^<]+)<\/span>/i)?.[1] ||
      chunk.match(/Empresa Confidencial/i)?.[0];
    const locRaw =
      chunk.match(/i_job_location[\s\S]{0,200}?-\s*([^<]+)/i)?.[1] ||
      chunk.match(/-\s*([A-ZÁÉÍÓÚ][^<]{2,40})/i)?.[1];
    const salaryRaw = chunk.match(/i_salary[\s\S]{0,120}?<strong>([^<]+)<\/strong>/i)?.[1];
    const postedRaw =
      chunk.match(/(?:Publicada|Atualizada)\s+em\s+([^<]+)/i)?.[1]?.trim() || null;

    const title = cleanText(titleRaw || "", 160);
    const company = cleanText(companyRaw || "Catho", 120);
    if (!title || !id || seen.has(id)) continue;
    seen.add(id);

    out.push({
      title,
      company,
      location: cleanText(locRaw || "Remoto / home office", 80),
      source: "catho",
      source_url: href
        ? `https://www.catho.com.br${href}`
        : `https://www.catho.com.br/vagas/?q=${encodeURIComponent(term)}`,
      salary: salaryRaw ? cleanText(salaryRaw, 40) : null,
      posted: postedRaw,
      job_id: `catho-${id}`,
      remote: true,
    });
  }

  // fallback: só pelos links /vagas/slug/id
  if (!out.length) {
    const re = /href="(\/vagas\/([^"/]+)\/(\d+))"[^>]*title="([^"]+)"/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      const [, path, , id, titleAttr] = m;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        title: cleanText(titleAttr, 160),
        company: "Catho",
        location: "Remoto / home office",
        source: "catho",
        source_url: `https://www.catho.com.br${path}`,
        job_id: `catho-${id}`,
        remote: true,
      });
    }
  }

  return out;
}
