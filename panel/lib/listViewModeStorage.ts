export type ListViewMode = "table" | "list" | "tiles";

const VALID = new Set<ListViewMode>(["table", "list", "tiles"]);

export const NODES_VIEW_MODE_STORAGE_KEY = "sharx.nodesViewMode";
export const INBOUNDS_VIEW_MODE_STORAGE_KEY = "sharx.inboundsViewMode";

export function readListViewMode(
  key: string,
  fallback: ListViewMode = "table",
): ListViewMode {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw && VALID.has(raw as ListViewMode)) {
      return raw as ListViewMode;
    }
  } catch {
    /* ignore quota / private mode */
  }
  return fallback;
}

export function writeListViewMode(key: string, mode: ListViewMode): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, mode);
  } catch {
    /* ignore */
  }
}
