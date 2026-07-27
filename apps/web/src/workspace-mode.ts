export const WORKSPACE_MODE_STORAGE_KEY = "pacium.workspaceMode";

export type WorkspaceMode = "general" | "pacium";

interface StoredWorkspaceMode {
  version: 1;
  mode: WorkspaceMode;
}

export function loadWorkspaceMode(
  storage: Pick<Storage, "getItem">,
): WorkspaceMode {
  try {
    const raw = storage.getItem(WORKSPACE_MODE_STORAGE_KEY);
    if (raw === null) {
      return "general";
    }
    const value: unknown = JSON.parse(raw);
    return isStoredWorkspaceMode(value) ? value.mode : "general";
  } catch {
    return "general";
  }
}

export function saveWorkspaceMode(
  storage: Pick<Storage, "setItem">,
  mode: WorkspaceMode,
): boolean {
  const value: StoredWorkspaceMode = { version: 1, mode };
  try {
    storage.setItem(WORKSPACE_MODE_STORAGE_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function isStoredWorkspaceMode(value: unknown): value is StoredWorkspaceMode {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    Object.keys(record).length === 2 &&
    record.version === 1 &&
    (record.mode === "general" || record.mode === "pacium")
  );
}
