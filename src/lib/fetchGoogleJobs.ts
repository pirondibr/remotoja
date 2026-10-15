import { buildJobsQuery } from "@/lib/buildJobsQuery";
import type { DemoJob } from "@/lib/demoJobs";

const API_POST = "https://api.dataforseo.com/v3/serp/google/jobs/task_post";
const API_GET = "https://api.dataforseo.com/v3/serp/google/jobs/task_get/advanced";

type RawItem = {
  type?: string;
  title?: string;
  employer_name?: string;
  location?: string;
  source_name?: string;
  source_url?: string | null;
  contract_type?: string | null;
  salary?: string | null;
  time_ago?: string | null;
  job_id?: string | null;
};

export type GoogleJobsResult = {
  query: string;
  role: string;
  count: number;
  jobs: DemoJob[];
  fetched_via: "dataforseo_google_jobs";
};

function authHeader(): string {
  const user = process.env.DATAFORSEO_USER?.trim();
  const pass = process.env.DATAFORSEO_PASS?.trim();
  if (!user || !pass) {
    throw new Error("DATAFORSEO_USER / DATAFORSEO_PASS não configurados");
  }
  return `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
}

function isRemote(title: string, location: string): boolean {
  const blob = `${title} ${location}`.toLowerCase();
  return ["remoto", "remote", "home office", "qualquer lugar", "work from home", "brasil"].some(
    (marker) => blob.includes(marker)
  );
}

function normalizeItem(item: RawItem): DemoJob | null {
  if (item.type !== "google_jobs_item") return null;
  const title = (item.title || "").trim();
  const company = (item.employer_name || "").trim();
  if (!title || !company) return null;
  const location = (item.location || "Brasil").trim();
  const source = (item.source_name || "").replace(/^via\s+/i, "").trim() || "Google Vagas";
  return {
    title,
    company,
    location,
    source,
    source_url: item.source_url ?? null,
    contract_type: item.contract_type ?? null,
    salary: item.salary ?? null,
    posted: item.time_ago ?? null,
    job_id: item.job_id ?? null,
    remote: isRemote(title, location),
  };
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchGoogleJobsByRole(
  role: string,
  options?: { depth?: number; locationCode?: number; languageCode?: string }
): Promise<GoogleJobsResult> {
  const query = buildJobsQuery(role);
  const depth = options?.depth ?? 10;
  const locationCode = options?.locationCode ?? 2076;
  const languageCode = options?.languageCode ?? "pt";
  const headers = {
    Authorization: authHeader(),
    "Content-Type": "application/json",
  };

  const createdRes = await fetch(API_POST, {
    method: "POST",
    headers,
    body: JSON.stringify([
      {
        keyword: query,
        location_code: locationCode,
        language_code: languageCode,
        depth,
      },
    ]),
    cache: "no-store",
  });
  const created = await createdRes.json();
  const task = created?.tasks?.[0];
  if (!task?.id || ![20000, 20100].includes(task.status_code)) {
    throw new Error(task?.status_message || "Falha ao criar task Google Jobs");
  }

  const taskId = task.id as string;

  for (let attempt = 0; attempt < 25; attempt++) {
    await sleep(3000);
    const getRes = await fetch(`${API_GET}/${taskId}`, {
      method: "GET",
      headers: { Authorization: headers.Authorization },
      cache: "no-store",
    });
    const data = await getRes.json();
    const status = data?.tasks?.[0]?.status_code;
    if (status === 20000) {
      const items: RawItem[] = data.tasks[0]?.result?.[0]?.items || [];
      const jobs = items
        .map(normalizeItem)
        .filter((job): job is DemoJob => Boolean(job));
      return {
        query,
        role: role.trim(),
        count: jobs.length,
        jobs,
        fetched_via: "dataforseo_google_jobs",
      };
    }
    if (![20100, 40601, 40602].includes(status)) {
      throw new Error(data?.tasks?.[0]?.status_message || `Task falhou (${status})`);
    }
  }

  throw new Error("Timeout aguardando Google Jobs");
}
