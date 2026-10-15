import type { DemoJob } from "@/lib/demoJobs";

const KEY = "mvr_member_jobs_v2";

export type JobSessionPayload = {
  role: string;
  jobs: DemoJob[];
  savedAt: number;
};

export function saveJobSession(role: string, jobs: DemoJob[]) {
  if (typeof window === "undefined") return;
  const payload: JobSessionPayload = {
    role: role.trim(),
    jobs,
    savedAt: Date.now(),
  };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // ignore quota errors
  }
}

export function loadJobSession(role?: string): JobSessionPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as JobSessionPayload;
    if (!data?.jobs || !Array.isArray(data.jobs)) return null;
    // Reaproveita cache só se o cargo bater (ou se não pediram cargo)
    if (role && data.role && data.role.toLowerCase() !== role.toLowerCase()) {
      return null;
    }
    // Cache curto (30 min) para MVP
    if (Date.now() - (data.savedAt || 0) > 30 * 60 * 1000) return null;
    return data;
  } catch {
    return null;
  }
}
