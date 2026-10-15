import { cleanText, fetchScrapingBee } from "@/lib/dashboard/common";
import { PORTAL_FETCH_LIMIT } from "@/lib/dashboard/limits";
import type { DashboardJob, PortalFetchResult } from "@/lib/dashboard/types";

type MosaicRow = {
  jobkey?: string;
  jobKey?: string;
  title?: string;
  company?: string | { name?: string };
  companyName?: string;
  formattedLocation?: string;
  remoteLocation?: boolean;
  jobTypes?: string[];
  snippet?: string;
};

function extractMosaic(html: string): { rows: MosaicRow[]; available: number } {
  const marker = 'window.mosaic.providerData["mosaic-provider-jobcards"]=';
  const idx = html.indexOf(marker);
  if (idx < 0) return { rows: [], available: 0 };
  let start = idx + marker.length;
  let depth = 0;
  let end = start;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  try {
    const blob = JSON.parse(html.slice(start, end));
    const model =
      blob?.metaData?.mosaicProviderJobCardsModel ||
      blob?.mosaicProviderJobCardsModel ||
      {};
    const rows = (model.results || []) as MosaicRow[];
    const available = Number(
      model.totalJobCount ??
        model.estimatedTotalSize ??
        model.totalResults ??
        rows.length
    );
    return {
      rows,
      available:
        Number.isFinite(available) && available > 0 ? available : rows.length,
    };
  } catch {
    return { rows: [], available: 0 };
  }
}

export async function fetchIndeed(term: string): Promise<PortalFetchResult> {
  if (!process.env.SCRAPINGBEE_API_KEY) {
    throw new Error("Indeed exige SCRAPINGBEE_API_KEY");
  }
  const url = `https://br.indeed.com/jobs?q=${encodeURIComponent(term)}&l=Remoto&sort=date`;
  const html = await fetchScrapingBee(url);
  const { rows, available } = extractMosaic(html);
  const out: DashboardJob[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const jk = row.jobkey || row.jobKey || "";
    const title = (row.title || "").trim();
    let company = "";
    if (typeof row.company === "string") company = row.company;
    else if (row.company && typeof row.company === "object")
      company = row.company.name || "";
    if (!company) company = row.companyName || "Indeed";
    if (!title || !jk || seen.has(jk)) continue;
    seen.add(jk);
    out.push({
      title,
      company: company.trim(),
      location: row.formattedLocation || "Remoto",
      source: "indeed",
      source_url: `https://br.indeed.com/viewjob?jk=${jk}`,
      contract_type: (row.jobTypes || []).join(", ") || null,
      job_id: `indeed-${jk}`,
      remote: row.remoteLocation !== false,
      snippet: cleanText(row.snippet || "", 220) || null,
    });
  }
  return {
    jobs: out.slice(0, PORTAL_FETCH_LIMIT),
    available: Math.max(available, out.length),
  };
}
