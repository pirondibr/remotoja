import type { DashboardJob } from "@/lib/dashboard/types";

export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

export function cleanText(html: string, limit = 300): string {
  const text = (html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, h) =>
      String.fromCharCode(parseInt(h, 16))
    )
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, limit);
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function normalizeKey(title: string, company: string): string {
  return `${title} ${company}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function dedupeJobs(jobs: DashboardJob[]): DashboardJob[] {
  const seen = new Set<string>();
  const out: DashboardJob[] = [];
  for (const job of jobs) {
    const key = normalizeKey(job.title || "", job.company || "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(job);
  }
  return out;
}

export async function fetchHtml(
  url: string,
  options?: { timeoutMs?: number; headers?: Record<string, string> }
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options?.timeoutMs ?? 25000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": UA,
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        ...(options?.headers || {}),
      },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} em ${url.split("?")[0]}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchScrapingBee(
  targetUrl: string,
  extras?: Record<string, string>
): Promise<string> {
  const key = process.env.SCRAPINGBEE_API_KEY?.trim();
  if (!key) throw new Error("SCRAPINGBEE_API_KEY não configurada");
  const params = new URLSearchParams({
    api_key: key,
    url: targetUrl,
    country_code: "br",
    premium_proxy: "true",
    render_js: "true",
    ...(extras || {}),
  });
  return fetchHtml(`https://app.scrapingbee.com/api/v1/?${params}`, {
    timeoutMs: 25000,
  });
}

export function termMatches(title: string, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (!t) return true;
  const hay = title.toLowerCase();
  if (hay.includes(t)) return true;
  // termos curtos: aceita se todas as palavras aparecem
  const parts = t.split(/\s+/).filter(Boolean);
  return parts.length > 1 && parts.every((p) => hay.includes(p));
}
