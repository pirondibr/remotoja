import {
  fetchHtmlForValidation,
  fetchScrapingBeeStealth,
  hostNeedsStealthProxy,
} from "@/lib/dashboard/common";
import {
  BEE_STEALTH_JS_CREDITS,
  beeCreditUsd,
  type AnalysisLogStep,
} from "@/lib/dashboard/analysisLog";
import { assessRemotePage } from "@/lib/dashboard/assessRemotePage";
import { assessRemoteWithLlm } from "@/lib/dashboard/llmJobAnalysis";
import { extractJobDetailsFromText } from "@/lib/dashboard/extractJobDetails";
import { hasOpenRouter } from "@/lib/openrouter";
import type {
  DashboardJob,
  ValidationItem,
  ValidationReport,
} from "@/lib/dashboard/types";

export type { ValidationItem, ValidationReport, ValidationStatus } from "@/lib/dashboard/types";

const CONCURRENCY = 4;
const FETCH_TIMEOUT_MS = 10000;
/** Máx. ScrapingBee stealth por análise (Jooble vai direto; ~35s cada). */
const STEALTH_BUDGET = 3;
/** Double-check rigoroso nas primeiras N (usuário pediu foco nas 10). */
const VALIDATE_LIMIT = 10;
const ENRICH_LIMIT = 50;

export type ValidateRemoteStats = {
  steps: AnalysisLogStep[];
  direct_ok: number;
  stealth_ok: number;
  stealth_fail: number;
  probe_ms: number;
  llm_ms: number;
  llm_cost_usd: number;
};

function withDetails(job: DashboardJob, html: string): DashboardJob {
  // Só salário no card — experiência/escolaridade vinham truncadas como "descrição".
  const details = extractJobDetailsFromText(html);
  return {
    ...job,
    salary: job.salary || details.salary,
  };
}

/** Título já declara remoto → aceita mesmo se o link da vaga estiver quebrado. */
function titleImpliesRemote(title: string | undefined | null): boolean {
  return /\b(remoto|remota|home\s*office|100%\s*remoto|trabalho\s+remoto|remote)\b/i.test(
    title || ""
  );
}

function acceptByTitleRemote(
  job: DashboardJob,
  base: Omit<ValidationItem, "status" | "reason">,
  linkReason: string
): { job: DashboardJob; item: ValidationItem } {
  return {
    job: { ...job, remote: true },
    item: {
      ...base,
      status: "validated",
      reason: `título indica remoto (link: ${linkReason})`,
    },
  };
}

async function probeUrl(
  url: string,
  opts: { mustValidate: boolean; takeStealthSlot: () => boolean }
): Promise<{ ok: boolean; text: string; reason?: string; via?: string }> {
  const jooble =
    hostNeedsStealthProxy(url) && Boolean(process.env.SCRAPINGBEE_API_KEY?.trim());

  // Jooble: vai direto no Bee stealth (direct sempre 403 Cloudflare).
  if (jooble && opts.mustValidate && opts.takeStealthSlot()) {
    try {
      const text = await fetchScrapingBeeStealth(url);
      if (!text || text.trim().length < 40) {
        return {
          ok: false,
          text: "",
          reason: "página vazia via ScrapingBee stealth",
          via: "scrapingbee_stealth",
        };
      }
      return { ok: true, text, via: "scrapingbee_stealth" };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        text: "",
        reason: `Jooble stealth: ${message.slice(0, 140)}`,
        via: "scrapingbee_stealth",
      };
    }
  }

  try {
    const { text, via } = await fetchHtmlForValidation(url, {
      timeoutMs: FETCH_TIMEOUT_MS,
      allowStealth: false,
    });
    return { ok: true, text, via };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, text: "", reason: message.slice(0, 160) };
  }
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }

  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => run()
  );
  await Promise.all(runners);
  return results;
}

/**
 * - Top 10: double-check rigoroso (foco UI).
 * - Top 11–50: também valida remoto/link; se passar → status validated (conta em Válidas).
 * - Demais: passam sem fetch (skipped).
 * - Com OPENROUTER_API_KEY: modalidade remota via LLM barato (regex só como fallback).
 */
export async function validateRemoteJobs(
  jobs: DashboardJob[],
  validateLimit = VALIDATE_LIMIT,
  enrichLimit = ENRICH_LIMIT
): Promise<{
  jobs: DashboardJob[];
  validation: ValidationReport;
  stats: ValidateRemoteStats;
}> {
  const toFetch = jobs.slice(0, Math.max(validateLimit, enrichLimit));
  const untouched = jobs.slice(toFetch.length);
  const steps: AnalysisLogStep[] = [];

  type ProbeRow = {
    job: DashboardJob;
    index: number;
    mustValidate: boolean;
    url: string;
    probe: {
      ok: boolean;
      text: string;
      reason?: string;
      via?: string;
    } | null;
  };

  const stealthBudget = { left: STEALTH_BUDGET };
  const takeStealthSlot = () => {
    if (stealthBudget.left <= 0) return false;
    stealthBudget.left -= 1;
    return true;
  };

  const probeStarted = Date.now();
  const probed = await mapPool(
    toFetch,
    CONCURRENCY,
    async (job, index): Promise<ProbeRow> => {
      const url = (job.source_url || "").trim();
      const mustValidate = index < validateLimit;
      if (!url) {
        return {
          job,
          index,
          mustValidate,
          url: "",
          probe: { ok: false, text: "", reason: "sem URL" },
        };
      }
      const probe = await probeUrl(url, { mustValidate, takeStealthSlot });
      return { job, index, mustValidate, url, probe };
    }
  );
  const probe_ms = Date.now() - probeStarted;

  let direct_ok = 0;
  let stealth_ok = 0;
  let stealth_fail = 0;
  for (const row of probed) {
    if (!row.probe) continue;
    if (row.probe.via === "scrapingbee_stealth") {
      if (row.probe.ok) stealth_ok += 1;
      else stealth_fail += 1;
    } else if (row.probe.ok) {
      direct_ok += 1;
    }
  }
  const stealthCost = beeCreditUsd(
    (stealth_ok + stealth_fail) * BEE_STEALTH_JS_CREDITS
  );
  steps.push({
    id: "probe_pages",
    label: "Double-check páginas (fetch)",
    ms: probe_ms,
    ok: true,
    cost_usd: stealthCost,
    detail: `direto ok ${direct_ok} · Bee stealth ok ${stealth_ok} / fail ${stealth_fail} (Jooble direto no stealth)`,
    meta: {
      direct_ok,
      stealth_ok,
      stealth_fail,
      bee_credits: (stealth_ok + stealth_fail) * BEE_STEALTH_JS_CREDITS,
    },
  });

  const llmCandidates: Array<{ job: DashboardJob; pageHtml: string }> = [];
  const llmIndexByProbe: number[] = [];
  for (let i = 0; i < probed.length; i++) {
    const row = probed[i];
    if (row.probe?.ok && row.probe.text) {
      llmIndexByProbe.push(i);
      llmCandidates.push({ job: row.job, pageHtml: row.probe.text });
    }
  }

  let llmMap: Map<
    number,
    import("@/lib/dashboard/assessRemotePage").RemoteAssess
  > | null = null;
  let llm_ms = 0;
  let llm_cost_usd = 0;
  if (hasOpenRouter() && llmCandidates.length > 0) {
    const llmStarted = Date.now();
    const llmResult = await assessRemoteWithLlm(llmCandidates);
    llm_ms = Date.now() - llmStarted;
    if (llmResult) {
      llmMap = llmResult.map;
      llm_cost_usd = llmResult.cost_usd;
      steps.push({
        id: "llm_remote",
        label: "LLM modalidade remota (OpenRouter)",
        ms: llm_ms,
        ok: true,
        cost_usd: llm_cost_usd,
        detail: `${llmResult.batches} batch · ${llmResult.prompt_tokens}+${llmResult.completion_tokens} tokens · ${llmCandidates.length} páginas`,
        meta: {
          batches: llmResult.batches,
          prompt_tokens: llmResult.prompt_tokens,
          completion_tokens: llmResult.completion_tokens,
        },
      });
    } else {
      steps.push({
        id: "llm_remote",
        label: "LLM modalidade remota (OpenRouter)",
        ms: llm_ms,
        ok: false,
        detail: "falhou — usando regras",
      });
    }
  } else {
    steps.push({
      id: "llm_remote",
      label: "LLM modalidade remota (OpenRouter)",
      ms: 0,
      ok: false,
      detail: hasOpenRouter() ? "sem páginas para analisar" : "sem API key",
    });
  }

  const fetched: Array<{ job: DashboardJob | null; item: ValidationItem }> =
    probed.map((row) => {
      const base = {
        title: row.job.title,
        company: row.job.company,
        source: row.job.source,
        scrape: row.job.scrape || row.job.source,
        match_tier: row.job.match_tier || null,
        source_url: row.url || null,
      };

      if (!row.url) {
        if (row.mustValidate) {
          if (titleImpliesRemote(row.job.title)) {
            return acceptByTitleRemote(row.job, base, "sem URL");
          }
          return {
            job: null,
            item: { ...base, status: "invalid_link" as const, reason: "sem URL" },
          };
        }
        return {
          job: row.job,
          item: {
            ...base,
            status: "skipped" as const,
            reason: "sem URL (enrich)",
          },
        };
      }

      if (!row.probe?.ok) {
        const why = row.probe?.reason || "link não abriu";
        if (titleImpliesRemote(row.job.title)) {
          return acceptByTitleRemote(row.job, base, why);
        }
        return {
          job: null,
          item: {
            ...base,
            status: "invalid_link" as const,
            reason: why,
          },
        };
      }

      const llmPos = llmIndexByProbe.indexOf(row.index);
      const llmAssess =
        llmMap && llmPos >= 0 ? llmMap.get(llmPos) : undefined;
      const assess =
        llmAssess || assessRemotePage(row.job, row.probe.text);

      if (!assess.ok) {
        if (
          assess.kind === "invalid_link" &&
          titleImpliesRemote(row.job.title)
        ) {
          return acceptByTitleRemote(row.job, base, assess.reason);
        }
        return {
          job: null,
          item: {
            ...base,
            status: assess.kind,
            reason: assess.reason,
          },
        };
      }

      const enriched = withDetails(
        { ...row.job, remote: true },
        row.probe.text
      );

      return {
        job: enriched,
        item: {
          ...base,
          status: "validated" as const,
          reason: assess.reason,
        },
      };
    });

  const kept: DashboardJob[] = [];
  const items: ValidationItem[] = [];
  let validated = 0;
  let falsePositives = 0;
  let indecisos = 0;
  let invalidLinks = 0;
  let skipped = 0;

  for (const result of fetched) {
    items.push(result.item);
    if (result.item.status === "validated") {
      validated += 1;
      if (result.job) kept.push(result.job);
    } else if (result.item.status === "false_positive") {
      falsePositives += 1;
    } else if (result.item.status === "indeciso") {
      indecisos += 1;
    } else if (result.item.status === "invalid_link") {
      invalidLinks += 1;
    } else {
      skipped += 1;
      if (result.job) kept.push(result.job);
    }
  }

  kept.push(...untouched);
  for (const job of untouched) {
    items.push({
      title: job.title,
      company: job.company,
      source: job.source,
      scrape: job.scrape || job.source,
      match_tier: job.match_tier || null,
      source_url: job.source_url || null,
      status: "skipped",
      reason: `fora do top ${enrichLimit}`,
    });
    skipped += 1;
  }

  return {
    jobs: kept,
    validation: {
      checked: validated + falsePositives + indecisos + invalidLinks,
      validated,
      false_positives: falsePositives,
      indecisos,
      invalid_links: invalidLinks,
      skipped,
      kept: kept.length,
      items,
    },
    stats: {
      steps,
      direct_ok,
      stealth_ok,
      stealth_fail,
      probe_ms,
      llm_ms,
      llm_cost_usd,
    },
  };
}
