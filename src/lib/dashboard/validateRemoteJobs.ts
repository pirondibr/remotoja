import {
  fetchHtmlForValidation,
  fetchScrapingBeeStealth,
  hostNeedsStealthProxy,
} from "@/lib/dashboard/common";
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
/** Máx. ScrapingBee stealth por análise (cada ~35s) — evita timeout da Vercel. */
const STEALTH_BUDGET = 2;
/** Double-check rigoroso nas primeiras N (usuário pediu foco nas 10). */
const VALIDATE_LIMIT = 10;
const ENRICH_LIMIT = 50;

function withDetails(job: DashboardJob, html: string): DashboardJob {
  const details = extractJobDetailsFromText(html);
  return {
    ...job,
    salary: job.salary || details.salary,
    experience: job.experience || details.experience,
    education: job.education || details.education,
  };
}

async function probeUrl(
  url: string,
  opts: { mustValidate: boolean; takeStealthSlot: () => boolean }
): Promise<{ ok: boolean; text: string; reason?: string; via?: string }> {
  try {
    const { text, via } = await fetchHtmlForValidation(url, {
      timeoutMs: FETCH_TIMEOUT_MS,
      allowStealth: false,
    });
    return { ok: true, text, via };
  } catch (err) {
    const directMsg = err instanceof Error ? err.message : String(err);
    const tryStealth =
      opts.mustValidate &&
      hostNeedsStealthProxy(url) &&
      Boolean(process.env.SCRAPINGBEE_API_KEY?.trim()) &&
      opts.takeStealthSlot();
    if (!tryStealth) {
      return { ok: false, text: "", reason: directMsg.slice(0, 160) };
    }
    try {
      const text = await fetchScrapingBeeStealth(url);
      if (!text || text.trim().length < 40) {
        return {
          ok: false,
          text: "",
          reason: "página vazia via ScrapingBee stealth",
        };
      }
      return { ok: true, text, via: "scrapingbee_stealth" };
    } catch (stealthErr) {
      const message =
        stealthErr instanceof Error ? stealthErr.message : String(stealthErr);
      return {
        ok: false,
        text: "",
        reason: `${directMsg.slice(0, 80)} · stealth: ${message.slice(0, 80)}`,
      };
    }
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
): Promise<{ jobs: DashboardJob[]; validation: ValidationReport }> {
  const toFetch = jobs.slice(0, Math.max(validateLimit, enrichLimit));
  const untouched = jobs.slice(toFetch.length);

  type ProbeRow = {
    job: DashboardJob;
    index: number;
    mustValidate: boolean;
    url: string;
    probe: { ok: boolean; text: string; reason?: string } | null;
  };

  const stealthBudget = { left: STEALTH_BUDGET };
  const takeStealthSlot = () => {
    if (stealthBudget.left <= 0) return false;
    stealthBudget.left -= 1;
    return true;
  };

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

  const llmCandidates: Array<{ job: DashboardJob; pageHtml: string }> = [];
  const llmIndexByProbe: number[] = [];
  for (let i = 0; i < probed.length; i++) {
    const row = probed[i];
    if (row.probe?.ok && row.probe.text) {
      llmIndexByProbe.push(i);
      llmCandidates.push({ job: row.job, pageHtml: row.probe.text });
    }
  }

  const llmMap =
    hasOpenRouter() && llmCandidates.length > 0
      ? await assessRemoteWithLlm(llmCandidates)
      : null;

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
        return {
          job: null,
          item: {
            ...base,
            status: "invalid_link" as const,
            reason: row.probe?.reason || "link não abriu",
          },
        };
      }

      const llmPos = llmIndexByProbe.indexOf(row.index);
      const llmAssess =
        llmMap && llmPos >= 0 ? llmMap.get(llmPos) : undefined;
      const assess =
        llmAssess || assessRemotePage(row.job, row.probe.text);

      if (!assess.ok) {
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
  };
}
