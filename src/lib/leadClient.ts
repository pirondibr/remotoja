export const LEAD_ID_STORAGE_KEY = "mvr_lead_id";

export function storeLeadId(id: string | null | undefined) {
  const value = (id || "").trim();
  if (!value) return;
  try {
    sessionStorage.setItem(LEAD_ID_STORAGE_KEY, value);
  } catch {
    /* ignore */
  }
}

export function loadLeadId(): string | null {
  try {
    return sessionStorage.getItem(LEAD_ID_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function captureLeadId(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const id = "id" in data ? String((data as { id?: unknown }).id || "").trim() : "";
  if (!id) return null;
  storeLeadId(id);
  return id;
}
