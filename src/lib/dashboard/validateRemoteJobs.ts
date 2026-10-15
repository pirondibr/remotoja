import { fetchHtml, UA } from "@/lib/dashboard/common";
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

function pageLooksRemote(text: string): boolean {
  return REMOTE_RE.test(text);
}

function jobMetaLooksRemote(job: DashboardJob): boolean {
  const blob = [job.title, job.location, job.snippet || "", job.remote ? "remoto" : ""]
    .join(" ")
    .trim();
  return pageLooksRemote(blob);
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
 * Valida as primeiras N vagas: link abre + página menciona remoto/home office.
 * As demais passam sem checagem (skipped).
 */
export async function validateRemoteJobs(
  jobs: DashboardJob[],
  limit = VALIDATE_LIMIT
): Promise<{ jobs: DashboardJob[]; validation: ValidationReport }> {
  const head = jobs.slice(0, limit);
  const tail = jobs.slice(limit);

  const headResults = await mapPool(
    head,
    CONCURRENCY,
    async (
      job
    ): Promise<{ job: DashboardJob | null; item: ValidationItem }> => {
      const url = (job.source_url || "").trim();
      const base = {
        title: job.title,
        company: job.company,
        source: job.source,
        source_url: url || null,
      };

      if (!url) {
        return {
          job: null,
          item: {
            ...base,
            status: "invalid_link",
            reason: "sem URL",
          },
        };
      }

      // Atalho: metadados já deixam claro que é remoto
      if (jobMetaLooksRemote(job)) {
        const probe = await probeUrl(url);
        if (!probe.ok) {
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
            status: "validated",
            reason: "metadados + link ok",
          },
        };
      }

      const probe = await probeUrl(url);
      if (!probe.ok) {
        return {
          job: null,
          item: {
            ...base,
            status: "invalid_link",
            reason: probe.reason || "link não abriu",
          },
        };
      }

      if (!pageLooksRemote(probe.text)) {
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
        job: { ...job, remote: true },
        item: {
          ...base,
          status: "validated",
          reason: "página menciona remoto",
        },
      };
    }
  );

  const keptHead: DashboardJob[] = [];
  const items: ValidationItem[] = [];
  let validated = 0;
  let falsePositives = 0;
  let invalidLinks = 0;

  for (const result of headResults) {
    items.push(result.item);
    if (result.item.status === "validated") {
      validated += 1;
      if (result.job) keptHead.push(result.job);
    } else if (result.item.status === "false_positive") {
      falsePositives += 1;
    } else if (result.item.status === "invalid_link") {
      invalidLinks += 1;
    }
  }

  for (const job of tail) {
    items.push({
      title: job.title,
      company: job.company,
      source: job.source,
      source_url: job.source_url || null,
      status: "skipped",
      reason: `fora do top ${limit}`,
    });
  }

  const kept = [...keptHead, ...tail];

  return {
    jobs: kept,
    validation: {
      checked: head.length,
      validated,
      false_positives: falsePositives,
      invalid_links: invalidLinks,
      skipped: tail.length,
      kept: kept.length,
      items,
    },
  };
}
