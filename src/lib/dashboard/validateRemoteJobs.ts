import { fetchHtml, UA } from "@/lib/dashboard/common";
import { extractJobDetailsFromText } from "@/lib/dashboard/extractJobDetails";
import type {
  DashboardJob,
  ValidationItem,
  ValidationReport,
} from "@/lib/dashboard/types";

export type { ValidationItem, ValidationReport, ValidationStatus } from "@/lib/dashboard/types";

const REMOTE_RE =
  /\b(remoto|remota|remote|home\s*office|trabalho\s+a\s+dist[aâ]ncia|100%\s*remoto|fully\s*remote|work\s+from\s+home|\bwfh\b)\b/i;

const CONCURRENCY = 5;
const FETCH_TIMEOUT_MS = 8000;
const VALIDATE_LIMIT = 20;
const ENRICH_LIMIT = 50;

function pageLooksRemote(text: string): boolean {
  return REMOTE_RE.test(text);
}

function jobMetaLooksRemote(job: DashboardJob): boolean {
  const blob = [job.title, job.location, job.snippet || "", job.remote ? "remoto" : ""]
    .join(" ")
    .trim();
  return pageLooksRemote(blob);
}

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
 * - Top 20: valida link + remoto; remove inválidas/falso positivo; enriquece detalhes.
 * - Top 21–50: só enriquece salário/experiência/escolaridade (não remove).
 * - Demais: passam sem fetch.
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
        if (mustValidate) {
          return {
            job: null,
            item: {
              ...base,
              status: "invalid_link",
              reason: probe.reason || "link não abriu",
            },
          };
        }
        return {
          job,
          item: {
            ...base,
            status: "skipped",
            reason: "link falhou no enrich",
          },
        };
      }

      const enriched = withDetails(job, probe.text);

      if (!mustValidate) {
        return {
          job: enriched,
          item: {
            ...base,
            status: "skipped",
            reason: "enrich only",
          },
        };
      }

      const remoteOk =
        jobMetaLooksRemote(enriched) || pageLooksRemote(probe.text);
      if (!remoteOk) {
        return {
          job: null,
          item: {
            ...base,
            status: "false_positive",
            reason: "sem menção a remoto/home office na página",
          },
        };
      }

      return {
        job: { ...enriched, remote: true },
        item: {
          ...base,
          status: "validated",
          reason: "remoto ok + detalhes",
        },
      };
    }
  );

  const kept: DashboardJob[] = [];
  const items: ValidationItem[] = [];
  let validated = 0;
  let falsePositives = 0;
  let invalidLinks = 0;
  let skipped = 0;

  for (let i = 0; i < fetched.length; i++) {
    const result = fetched[i];
    items.push(result.item);
    if (result.item.status === "validated") {
      validated += 1;
      if (result.job) kept.push(result.job);
    } else if (result.item.status === "false_positive") {
      falsePositives += 1;
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
      checked: Math.min(jobs.length, validateLimit),
      validated,
      false_positives: falsePositives,
      invalid_links: invalidLinks,
      skipped,
      kept: kept.length,
      items,
    },
  };
}
