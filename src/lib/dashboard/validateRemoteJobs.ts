import { fetchHtml, UA } from "@/lib/dashboard/common";
import { assessRemotePage } from "@/lib/dashboard/assessRemotePage";
import { extractJobDetailsFromText } from "@/lib/dashboard/extractJobDetails";
import type {
  DashboardJob,
  ValidationItem,
  ValidationReport,
} from "@/lib/dashboard/types";

export type { ValidationItem, ValidationReport, ValidationStatus } from "@/lib/dashboard/types";

const CONCURRENCY = 5;
const FETCH_TIMEOUT_MS = 10000;
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
  url: string
): Promise<{ ok: boolean; text: string; reason?: string }> {
  try {
    const text = await fetchHtml(url, {
      timeoutMs: FETCH_TIMEOUT_MS,
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!text || text.trim().length < 40) {
      return { ok: false, text: "", reason: "página vazia ou bloqueada" };
    }
    return { ok: true, text };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, text: "", reason: message.slice(0, 120) };
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
 */
export async function validateRemoteJobs(
  jobs: DashboardJob[],
  validateLimit = VALIDATE_LIMIT,
  enrichLimit = ENRICH_LIMIT
): Promise<{ jobs: DashboardJob[]; validation: ValidationReport }> {
  const toFetch = jobs.slice(0, Math.max(validateLimit, enrichLimit));
  const untouched = jobs.slice(toFetch.length);

  const fetched = await mapPool(
    toFetch,
    CONCURRENCY,
    async (
      job,
      index
    ): Promise<{ job: DashboardJob | null; item: ValidationItem }> => {
      const mustValidate = index < validateLimit;
      const url = (job.source_url || "").trim();
      const base = {
        title: job.title,
        company: job.company,
        source: job.source,
        scrape: job.scrape || job.source,
        match_tier: job.match_tier || null,
        source_url: url || null,
      };

      if (!url) {
        if (mustValidate) {
          return {
            job: null,
            item: { ...base, status: "invalid_link", reason: "sem URL" },
          };
        }
        return {
          job,
          item: { ...base, status: "skipped", reason: "sem URL (enrich)" },
        };
      }

      const probe = await probeUrl(url);
      if (!probe.ok) {
        // Em enrich (11–50) também remove link quebrado
        return {
          job: null,
          item: {
            ...base,
            status: "invalid_link",
            reason: probe.reason || "link não abriu",
          },
        };
      }

      const assess = assessRemotePage(job, probe.text);
      if (!assess.ok) {
        // Soft-404 / híbrido / sem remoto: remove sempre que baixamos a página
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
        { ...job, remote: true },
        probe.text
      );

      // Qualquer vaga que passou no double-check de remoto conta como validada
      // (antes só o top 10 recebia "validated" → portais como Catho ficavam com 0 válidas).
      return {
        job: enriched,
        item: {
          ...base,
          status: "validated",
          reason: assess.reason,
        },
      };
    }
  );

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
