import { cleanText, fetchHtml, termMatches } from "@/lib/dashboard/common";
import type { DashboardJob } from "@/lib/dashboard/types";

export async function fetchProgramathor(term: string): Promise<DashboardJob[]> {
  const url =
    `https://programathor.com.br/jobs?locale=en&q=${encodeURIComponent(term)}` +
    `&worktype=remoto`;
  const html = await fetchHtml(url);
  const blocks = html.split(/<div class="cell-list\s*">/);
  const out: DashboardJob[] = [];
  const seen = new Set<string>();

  for (const block of blocks.slice(1)) {
    const href = block.match(/href="(\/jobs\/(\d+)-[^"]+)"/)?.[1];
    const id = block.match(/href="\/jobs\/(\d+)-/)?.[1];
    const titleRaw =
      block.match(/<h[1-4][^>]*>(.*?)<\/h[1-4]>/i)?.[1] ||
      block.match(/<(?:strong|b)[^>]*>(.*?)<\/(?:strong|b)>/i)?.[1];
    const company =
      block.match(/fa-briefcase'><\/i>([^<]+)/)?.[1]?.trim() ||
      block.match(/img alt="([^"]+)"/)?.[1]?.trim() ||
      "Programathor";
    const loc =
      block.match(/fa-map-marker-alt'><\/i>([^<]+)/)?.[1]?.trim() || "Remoto";
    const title = cleanText(titleRaw || "", 160);
    if (!href || !id || !title) continue;
    if (loc.toLowerCase().includes("híbrido") || loc.toLowerCase().includes("hibrido")) {
      // worktype=remoto already filters; keep only remoto
      if (!loc.toLowerCase().includes("remoto")) continue;
    }
    if (!termMatches(title, term) && !termMatches(company, term)) {
      // Programathor às vezes ignora q — filtra no cliente
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      title,
      company: cleanText(company, 120),
      location: cleanText(loc, 80),
      source: "programathor",
      source_url: `https://programathor.com.br${href}`,
      job_id: `programathor-${id}`,
      remote: true,
    });
  }
  return out;
}
