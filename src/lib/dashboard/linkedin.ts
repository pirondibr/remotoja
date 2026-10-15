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

/** Captura conteúdo HTML que pode ter quebras de linha entre tags. */
function inner(chunk: string, classRe: RegExp): string {
  const m = chunk.match(
    new RegExp(
      `class="[^"]*${classRe.source}[^"]*"[^>]*>([\\s\\S]*?)</`,
      "i"
    )
  );
  return m?.[1] || "";
}

function parseCards(html: string): DashboardJob[] {
  // class do card costuma quebrar linha (base-card\n base-card--link …)
  const parts = html.split(
    /<div[^>]*class="[^"]*base-card[^"]*"[^>]*>/i
  );
  const jobs: DashboardJob[] = [];
  for (const chunk of parts.slice(1)) {
    const link =
      chunk.match(
        /href="(https:\/\/[a-z.]*linkedin\.com\/jobs\/view\/[^"?]+)/i
      )?.[1] ||
      chunk.match(/href="(\/jobs\/view\/[^"?]+)/i)?.[1] ||
      "";
    const titleRaw =
      inner(chunk, /base-search-card__title/) ||
      inner(chunk, /job-card-list__title/);
    const companyRaw =
      inner(chunk, /base-search-card__subtitle/) ||
      inner(chunk, /job-card-container__primary-description/);
    const locRaw = inner(chunk, /job-search-card__location/);
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

function mergeBatch(
  batch: DashboardJob[],
  seen: Set<string>,
  out: DashboardJob[]
) {
  for (const job of batch) {
    if (!job.job_id || seen.has(job.job_id)) continue;
    seen.add(job.job_id);
    out.push(job);
  }
}

/**
 * LinkedIn remoto BR.
 * Guest API direto costuma tomar 429 em IP de datacenter (Vercel) —
 * aí cai no ScrapingBee na mesma URL guest (HTML estático, sem JS).
 */
export async function fetchLinkedIn(term: string): Promise<PortalFetchResult> {
  const seen = new Set<string>();
  const out: DashboardJob[] = [];
  let guestError: string | null = null;

  try {
    for (let page = 0; page < 3; page++) {
      const html = await fetchHtml(guestUrl(term, page * 25), {
        timeoutMs: 15000,
      });
      const batch = parseCards(html);
      if (!batch.length) break;
      mergeBatch(batch, seen, out);
      if (out.length >= PORTAL_FETCH_LIMIT * 3) break;
    }
  } catch (err) {
    guestError = err instanceof Error ? err.message : String(err);
  }

  if (out.length === 0) {
    if (!process.env.SCRAPINGBEE_API_KEY) {
      throw new Error(
        guestError
          ? `LinkedIn guest falhou (${guestError}) e SCRAPINGBEE_API_KEY ausente`
          : "LinkedIn guest vazio e SCRAPINGBEE_API_KEY ausente"
      );
    }
    // Guest HTML via Bee — sem render_js (endpoint já devolve cards).
    // 1 página (~25) basta pro cap; 2ª só se a 1ª vier curta.
    for (let page = 0; page < 2; page++) {
      const html = await fetchScrapingBee(guestUrl(term, page * 25), {
        render_js: "false",
      });
      const batch = parseCards(html);
      if (!batch.length) break;
      mergeBatch(batch, seen, out);
      if (out.length >= PORTAL_FETCH_LIMIT) break;
    }
  }

  if (out.length === 0) {
    throw new Error(
      guestError
        ? `LinkedIn sem vagas após Bee (guest: ${guestError})`
        : "LinkedIn sem vagas parseáveis (guest + Bee)"
    );
  }

  return {
    jobs: out,
    available: out.length,
  };
}
