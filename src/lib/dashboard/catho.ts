import { cleanText, fetchHtml } from "@/lib/dashboard/common";
import { PORTAL_FETCH_LIMIT } from "@/lib/dashboard/limits";
import type { DashboardJob, PortalFetchResult } from "@/lib/dashboard/types";

/** Filtro Home Office real da Catho (remoto_home_office=true é legado e NÃO aplica). */
function cathoSearchUrl(query: string): string {
  return (
    `https://www.catho.com.br/vagas/?q=${encodeURIComponent(query)}` +
    `&work_model%5B0%5D=remote`
  );
}

async function loadCathoHtml(url: string): Promise<string> {
  try {
    return await fetchHtml(url, { timeoutMs: 30000 });
  } catch (err) {
    if (!process.env.SCRAPINGBEE_API_KEY) throw err;
    const { fetchScrapingBee } = await import("@/lib/dashboard/common");
    return fetchScrapingBee(url);
  }
}

/** "11.234 resultados" / "1.234 vagas encontradas" */
function parseCathoTotal(html: string): number | null {
  const patterns = [
    /([\d.]+)\s*resultados/i,
    /([\d.]+)\s*vagas?\s*(?:encontradas|dispon)/i,
    /"total(?:Results|Count|Offers)?"\s*:\s*(\d+)/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (!m) continue;
    const raw = m[1].includes(".") && !m[1].includes(",")
      ? m[1].replace(/\./g, "")
      : m[1].replace(/[^\d]/g, "");
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function parseCathoJobs(html: string, term: string): DashboardJob[] {
  const articles = html.split(/data-offer-item="(\d+)"/i);
  const out: DashboardJob[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < articles.length; i += 2) {
    const id = articles[i];
    const chunk = articles[i + 1] || "";
    const href =
      chunk.match(/href="(\/vagas\/[^"/]+\/\d+)"/i)?.[1] ||
      chunk.match(new RegExp(`href="(/vagas/[^"/]+/${id})"`, "i"))?.[1];
    const titleRaw =
      chunk.match(
        /<h2[^>]*class="[^"]*title_offer[^"]*"[^>]*>[\s\S]*?<a[^>]*>(.*?)<\/a>/i
      )?.[1] ||
      chunk.match(/title="([^"]+)"[^>]*data-navigation-offer/i)?.[1] ||
      chunk.match(/<h2[^>]*>(.*?)<\/h2>/i)?.[1];
    const companyRaw =
      chunk.match(/<span class="text-12">([^<]+)<\/span>/i)?.[1] ||
      chunk.match(/Empresa Confidencial/i)?.[0];
    const locRaw =
      chunk.match(/i_job_location[\s\S]{0,200}?-\s*([^<]+)/i)?.[1] ||
      chunk.match(/-\s*([A-ZÁÉÍÓÚ][^<]{2,40})/i)?.[1];
    const salaryRaw = chunk.match(
      /i_salary[\s\S]{0,120}?<strong>([^<]+)<\/strong>/i
    )?.[1];
    const postedRaw =
      chunk.match(/(?:Publicada|Atualizada)\s+em\s+([^<]+)/i)?.[1]?.trim() ||
      null;

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
      from_remote_filter: true,
    });
  }

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
        from_remote_filter: true,
      });
    }
  }

  return out;
}

async function fetchCathoQuery(
  query: string,
  term: string
): Promise<{ jobs: DashboardJob[]; available: number }> {
  const html = await loadCathoHtml(cathoSearchUrl(query));
  const jobs = parseCathoJobs(html, term);
  return {
    jobs,
    available: parseCathoTotal(html) || jobs.length,
  };
}

/**
 * Catho: 1º busca `cargo home office` + filtro remoto.
 * Se zerar → fallback só com o cargo + filtro `remoto_home_office`.
 */
export async function fetchCatho(term: string): Promise<PortalFetchResult> {
  const base = term.trim();
  const alreadyHasHomeOffice = /home\s*office/i.test(base);
  const titleQuery = alreadyHasHomeOffice ? base : `${base} home office`;

  const primary = await fetchCathoQuery(titleQuery, base);
  if (primary.jobs.length > 0) {
    return {
      jobs: primary.jobs.slice(0, PORTAL_FETCH_LIMIT),
      available: Math.max(primary.available, primary.jobs.length),
    };
  }

  // Título com "home office" zerou → filtro home office do portal com o cargo puro
  if (!alreadyHasHomeOffice) {
    const fallback = await fetchCathoQuery(base, base);
    return {
      jobs: fallback.jobs.slice(0, PORTAL_FETCH_LIMIT),
      available: Math.max(fallback.available, fallback.jobs.length),
    };
  }

  return { jobs: [], available: primary.available || 0 };
}
