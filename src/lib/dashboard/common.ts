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
  const byKey = new Map<string, DashboardJob>();
  for (const job of jobs) {
    const key = normalizeKey(job.title || "", job.company || "");
    if (!key) continue;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, job);
      continue;
    }
    // Prefere a cópia que tem logo / salário / link
    byKey.set(key, {
      ...prev,
      ...job,
      company_logo: job.company_logo || prev.company_logo || null,
      salary: job.salary || prev.salary || null,
      experience: job.experience || prev.experience || null,
      education: job.education || prev.education || null,
      source_url: job.source_url || prev.source_url || null,
    });
  }
  return Array.from(byKey.values());
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

const CLOUDFLARE_RE =
  /just a moment|cf-browser-verification|attention required|enable javascript and cookies/i;

/** Hosts onde o fetch direto costuma cair em Cloudflare (teste Jooble 15/10). */
const STEALTH_HOST_RE = /(?:^|\.)jooble\.org$/i;

export function hostNeedsStealthProxy(url: string): boolean {
  try {
    return STEALTH_HOST_RE.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Infere o portal de origem a partir da URL da vaga (agregadores: Remotar, Google…).
 * Retorna chave estável (gupy, linkedin, catho…) ou null se for o próprio agregador / desconhecido.
 */
export function inferPortalFromUrl(url: string | null | undefined): string | null {
  const raw = (url || "").trim();
  if (!raw) return null;
  try {
    const host = new URL(raw).hostname.replace(/^www\./i, "").toLowerCase();
    if (!host) return null;
    if (host.includes("gupy.io") || host.includes("gupy.com")) return "gupy";
    if (host.includes("linkedin.com")) return "linkedin";
    if (host.includes("catho.com")) return "catho";
    if (host.includes("infojobs")) return "infojobs";
    if (host.includes("indeed.")) return "indeed";
    if (host.includes("programathor")) return "programathor";
    if (host.includes("jooble.")) return "jooble";
    if (host.includes("glassdoor.")) return "glassdoor";
    if (host.includes("vagas.com")) return "vagas_com";
    if (host.includes("trampos.co")) return "trampos";
    if (host.includes("geekhunter")) return "geekhunter";
    if (host.includes("quiron") || host.includes("kenoby")) return "kenoby";
    if (host.includes("greenhouse.io")) return "greenhouse";
    if (host.includes("lever.co")) return "lever";
    if (host.includes("workable.com")) return "workable";
    if (host.includes("remotar.com")) return "remotar";
    if (host.includes("google.") && host.includes("jobs")) return "google_vagas";
    // Domínio próprio da empresa (carreira.xxx) — marca como company_site
    if (
      host.startsWith("jobs.") ||
      host.startsWith("careers.") ||
      host.startsWith("carreiras.") ||
      host.includes("myworkdayjobs.com") ||
      host.includes("boards.eu.greenhouse")
    ) {
      return "company_site";
    }
    // Host genérico: usa o 2º nível como rótulo curto
    const parts = host.split(".");
    if (parts.length >= 2) {
      const base = parts[parts.length - 2];
      if (base && base.length >= 3 && base !== "com" && base !== "org") {
        return base;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Jooble/Cloudflare: premium proxy sozinho devolve challenge; stealth+JS passou no teste. */
export async function fetchScrapingBeeStealth(
  targetUrl: string
): Promise<string> {
  const key = process.env.SCRAPINGBEE_API_KEY?.trim();
  if (!key) throw new Error("SCRAPINGBEE_API_KEY não configurada");
  const params = new URLSearchParams({
    api_key: key,
    url: targetUrl,
    country_code: "br",
    stealth_proxy: "true",
    render_js: "true",
  });
  const controller = new AbortController();
  // Cabe no orçamento da rota (maxDuration); 70s estourava os 60s da Vercel.
  const timer = setTimeout(() => controller.abort(), 35000);
  try {
    const res = await fetch(`https://app.scrapingbee.com/api/v1/?${params}`, {
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `ScrapingBee stealth HTTP ${res.status} em ${targetUrl.split("?")[0]}`
      );
    }
    if (CLOUDFLARE_RE.test(text.slice(0, 4000))) {
      throw new Error("ScrapingBee stealth ainda em Cloudflare challenge");
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}

function looksBlocked(statusOrMsg: string, body = ""): boolean {
  if (/HTTP\s*403|HTTP\s*429|bloquead|timeout|aborted|Cloudflare/i.test(statusOrMsg)) {
    return true;
  }
  if (CLOUDFLARE_RE.test(body.slice(0, 4000))) return true;
  return false;
}

/**
 * Fetch para double-check: direto → (opcional) ScrapingBee stealth+JS.
 * Stealth só em hosts conhecidos (Jooble) e quando `allowStealth` — senão a
 * análise inteira estoura o timeout de 60–120s da Vercel.
 */
export async function fetchHtmlForValidation(
  url: string,
  options?: { timeoutMs?: number; allowStealth?: boolean }
): Promise<{ text: string; via: "direct" | "scrapingbee_stealth" }> {
  try {
    const text = await fetchHtml(url, {
      timeoutMs: options?.timeoutMs ?? 10000,
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
    });
    if (text.trim().length < 40) {
      throw new Error("página vazia ou bloqueada");
    }
    if (CLOUDFLARE_RE.test(text.slice(0, 4000))) {
      throw new Error("Cloudflare challenge (direct)");
    }
    return { text, via: "direct" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const canStealth =
      Boolean(options?.allowStealth) &&
      Boolean(process.env.SCRAPINGBEE_API_KEY?.trim()) &&
      hostNeedsStealthProxy(url) &&
      looksBlocked(message);
    if (!canStealth) {
      throw err instanceof Error ? err : new Error(message);
    }
    const text = await fetchScrapingBeeStealth(url);
    if (!text || text.trim().length < 40) {
      throw new Error("página vazia via ScrapingBee stealth");
    }
    return { text, via: "scrapingbee_stealth" };
  }
}

/** Cargos não-dev: portais às vezes misturam vagas de programador na busca. */
const NON_DEV_ROLE =
  /^(seo|sem|as[oa]|conte[uú]do|copy|redator|social|m[ií]dias?|marketing|designer|ux|ui|produto|product|gestor|gest[aã]o|rh|recrut)/i;

const DEV_TITLE_NOISE =
  /\b(desenvolvedor|developer|programador|full\s*stack|front[\s-]?end|back[\s-]?end|software\s*engineer|engenheiro\s+de\s+software|react\s*native|mobile\s*developer)\b/i;

export function termMatches(title: string, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (!t) return true;
  const hay = title.toLowerCase();

  const hitsTerm =
    hay.includes(t) ||
    (t.split(/\s+/).filter(Boolean).length > 1 &&
      t.split(/\s+/).filter(Boolean).every((p) => hay.includes(p)));

  if (!hitsTerm) return false;

  // Ex.: busca "seo" não deve aceitar "Full Stack" só porque o portal misturou resultados
  if (NON_DEV_ROLE.test(t) && DEV_TITLE_NOISE.test(hay) && !hay.includes(t)) {
    return false;
  }

  return true;
}

/** 2 = termo inteiro no título, 1 = todas as palavras, 0 = só em company/snippet. */
export function titleMatchScore(title: string, term: string): number {
  const t = term.trim().toLowerCase();
  if (!t) return 0;
  const hay = (title || "").toLowerCase();
  if (hay.includes(t)) return 2;
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length > 1 && parts.every((p) => hay.includes(p))) return 1;
  return 0;
}

/** Converte posted relativo/ISO em timestamp ms (0 se desconhecido). */
export function postedTimestamp(posted: string | null | undefined): number {
  const raw = (posted || "").trim();
  if (!raw) return 0;
  const lower = raw.toLowerCase();
  const now = Date.now();

  const relative = (n: number, unit: string): number => {
    const ms =
      unit.startsWith("minuto") || unit.startsWith("minute")
        ? n * 60_000
        : unit.startsWith("hora") || unit.startsWith("hour")
          ? n * 3_600_000
          : unit.startsWith("dia") || unit.startsWith("day")
            ? n * 86_400_000
            : unit.startsWith("semana") || unit.startsWith("week")
              ? n * 7 * 86_400_000
              : unit.startsWith("m") || unit.startsWith("month")
                ? n * 30 * 86_400_000
                : unit.startsWith("ano") || unit.startsWith("year")
                  ? n * 365 * 86_400_000
                  : 0;
    return now - ms;
  };

  // "28 minutos atrás" / "há 7 dias"
  const pt = lower.match(
    /^(?:h[aá]\s+)?(\d+)\s+(minutos?|horas?|dias?|semanas?|m[eê]s(?:es)?|anos?)\s*(?:atrás)?$/
  );
  if (pt) return relative(Number(pt[1]), pt[2]);

  const en = lower.match(
    /^(\d+)\s+(minutes?|hours?|days?|weeks?|months?|years?)\s+ago$/
  );
  if (en) return relative(Number(en[1]), en[2]);

  if (lower === "agora" || lower === "recente") return now;

  const br = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (br) {
    const d = new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  return 0;
}

function tierRank(tier: string | null | undefined): number {
  if (tier === "exato") return 2;
  if (tier === "relacionado") return 1;
  return 0;
}

/**
 * Ordena feed: 1) match do cargo (exato > relacionado), 2) termo no título, 3) data.
 */
export function rankJobsForFeed(
  jobs: DashboardJob[],
  term: string
): DashboardJob[] {
  return [...jobs].sort((a, b) => {
    const tierA = tierRank(a.match_tier);
    const tierB = tierRank(b.match_tier);
    if (tierB !== tierA) return tierB - tierA;

    const titleA = titleMatchScore(a.title, term);
    const titleB = titleMatchScore(b.title, term);
    if (titleB !== titleA) return titleB - titleA;

    const timeA = postedTimestamp(a.posted);
    const timeB = postedTimestamp(b.posted);
    if (timeA === 0 && timeB === 0) return 0;
    if (timeA === 0) return 1;
    if (timeB === 0) return -1;
    return timeB - timeA;
  });
}
