import { cleanText, fetchHtml } from "@/lib/dashboard/common";
import { PORTAL_FETCH_LIMIT } from "@/lib/dashboard/limits";
import type { DashboardJob, PortalFetchResult } from "@/lib/dashboard/types";

type GupyRow = {
  id?: number | string;
  name?: string;
  careerPageName?: string;
  careerPageLogo?: string | null;
  companyLogo?: string | null;
  logoUrl?: string | null;
  jobUrl?: string;
  city?: string;
  state?: string;
  country?: string;
  workplaceType?: string;
  type?: string;
  publishedDate?: string;
  description?: string;
};

function parseNextData(html: string): { rows: GupyRow[]; available: number } {
  const marker = 'id="__NEXT_DATA__"';
  const startAttr = html.indexOf(marker);
  if (startAttr < 0) throw new Error("Gupy: __NEXT_DATA__ não encontrado");
  const start = html.indexOf(">", startAttr) + 1;
  const end = html.indexOf("</script>", start);
  const data = JSON.parse(html.slice(start, end));
  const pageProps = data?.props?.pageProps || {};
  const initial = pageProps.initialJobList || {};
  const rows: GupyRow[] = Array.isArray(initial.data)
    ? initial.data
    : Array.isArray(pageProps.jobs)
      ? pageProps.jobs
      : [];
  const available = Number(
    initial.total ??
      initial.totalCount ??
      initial.pagination?.total ??
      initial.pagination?.totalCount ??
      pageProps.totalJobs ??
      rows.length
  );
  return {
    rows,
    available: Number.isFinite(available) && available > 0 ? available : rows.length,
  };
}

function mapRow(row: GupyRow): DashboardJob | null {
  const workplace = (row.workplaceType || "").toLowerCase();
  if (workplace && !["remote", "remoto"].includes(workplace)) return null;
  const title = (row.name || "").trim();
  const company = (row.careerPageName || "").trim();
  if (!title || !company) return null;
  const location = [row.city, row.state, row.country].filter(Boolean).join(", ") || "Brasil";
  const id = String(row.id || "");
  const logo =
    (row.careerPageLogo || row.companyLogo || row.logoUrl || "").trim() || null;
  return {
    title,
    company,
    location,
    source: "gupy",
    source_url: row.jobUrl || `https://portal.gupy.io/job/${id}`,
    company_logo: logo,
    contract_type: row.type || null,
    posted: (row.publishedDate || "").slice(0, 10) || null,
    job_id: `gupy-${id}`,
    remote: true,
    snippet: cleanText(row.description || "", 220) || null,
  };
}

export async function fetchGupy(term: string): Promise<PortalFetchResult> {
  const q = encodeURIComponent(term.trim());
  const url = `https://portal.gupy.io/job-search/term=${q}&workplaceTypes[]=remote`;
  const html = await fetchHtml(url);
  const { rows, available } = parseNextData(html);
  const out: DashboardJob[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const mapped = mapRow(row);
    if (!mapped?.job_id || seen.has(mapped.job_id)) continue;
    seen.add(mapped.job_id);
    out.push(mapped);
  }
  return {
    jobs: out.slice(0, PORTAL_FETCH_LIMIT),
    available: Math.max(available, out.length),
  };
}
