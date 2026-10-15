import { cleanText, fetchHtml, fetchScrapingBee } from "@/lib/dashboard/common";
import { PORTAL_FETCH_LIMIT } from "@/lib/dashboard/limits";
import type { DashboardJob, PortalFetchResult } from "@/lib/dashboard/types";

const GEO_BRAZIL = "106057199";

function guestUrl(term: string, start: number) {
  const kw = encodeURIComponent(term);
  return (
    `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search` +
    `?keywords=${kw}&location=Brazil&geoId=${GEO_BRAZIL}&f_WT=2&start=${start}`
  );
}

function parseCards(html: string): DashboardJob[] {
  const parts = html.split(/<div[^>]+class="[^"]*base-card[^"]*"[^>]*>/i);
  const jobs: DashboardJob[] = [];
  for (const chunk of parts.slice(1)) {
    const link =
      chunk.match(/href="(https:\/\/[a-z.]*linkedin\.com\/jobs\/view\/[^"?]+)/i)?.[1] ||
      chunk.match(/href="(\/jobs\/view\/[^"?]+)/i)?.[1] ||
      "";
    const titleRaw =
      chunk.match(/class="[^"]*base-search-card__title[^"]*"[^>]*>(.*?)<\//i)?.[1] ||
      chunk.match(/class="[^"]*job-card-list__title[^"]*"[^>]*>(.*?)<\//i)?.[1];
    const companyRaw =
      chunk.match(/class="[^"]*base-search-card__subtitle[^"]*"[^>]*>(.*?)<\//i)?.[1] ||
      chunk.match(
        /class="[^"]*job-card-container__primary-description[^"]*"[^>]*>(.*?)<\//i
      )?.[1];
    const locRaw = chunk.match(
      /class="[^"]*job-search-card__location[^"]*"[^>]*>(.*?)<\//i
    )?.[1];
    const posted =
      chunk.match(/<time[^>]*datetime="([^"]+)"/i)?.[1]?.slice(0, 10) || null;
    const title = cleanText(titleRaw || "", 160);
    const company = cleanText(companyRaw || "LinkedIn", 120);
    if (!title) continue;
    let href = link.startsWith("/") ? `https://www.linkedin.com${link}` : link;
    href = href.split("?")[0];
    const idMatch = href.match(/\/jobs\/view\/[^/]*?(\d+)/);
    const jobId = idMatch?.[1] || encodeURIComponent(title).slice(0, 24);
    jobs.push({
      title,
      company,
      location: cleanText(locRaw || "Brasil · Remoto", 80),
      source: "linkedin",
      scrape: "linkedin",
      source_url: href || null,
      posted,
      job_id: `linkedin-${jobId}`,
      remote: true,
      from_remote_filter: true,
    });
  }
  return jobs;
}

/** LinkedIn remoto BR (guest; ScrapingBee só se guest zerar). */
export async function fetchLinkedIn(term: string): Promise<PortalFetchResult> {
  const seen = new Set<string>();
  const out: DashboardJob[] = [];

  try {
    // Até 3 páginas guest (~75) — filtro PT depois corta inglês.
    for (let page = 0; page < 3; page++) {
      const html = await fetchHtml(guestUrl(term, page * 25), {
        timeoutMs: 18000,
      });
      const batch = parseCards(html);
      if (!batch.length) break;
      for (const job of batch) {
        if (!job.job_id || seen.has(job.job_id)) continue;
        seen.add(job.job_id);
        out.push(job);
      }
      if (out.length >= PORTAL_FETCH_LIMIT * 3) break;
    }
  } catch {
    // guest bloqueado → ScrapingBee
  }

  if (out.length === 0) {
    if (!process.env.SCRAPINGBEE_API_KEY) {
      throw new Error("LinkedIn guest falhou e SCRAPINGBEE_API_KEY ausente");
    }
    const search =
      `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(term)}` +
      `&location=Brazil&geoId=${GEO_BRAZIL}&f_WT=2&position=1&pageNum=0`;
    const html = await fetchScrapingBee(search, { wait: "2000" });
    for (const job of parseCards(html)) {
      if (!job.job_id || seen.has(job.job_id)) continue;
      seen.add(job.job_id);
      out.push(job);
    }
  }

  return {
    jobs: out,
    available: out.length,
  };
}
