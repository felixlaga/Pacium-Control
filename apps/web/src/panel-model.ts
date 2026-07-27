import type { ConnectionState } from "./transport.js";

export const PANEL_VIEW_STORAGE_KEY = "pacium.panelView";
export const MAX_PANEL_VIEW_JSON_CHARS = 1_024;

export interface PanelViewState {
  version: 1;
  sidebarOpen: boolean;
  inspectorOpen: boolean;
}

export function defaultPanelView(viewportWidth: number): PanelViewState {
  if (viewportWidth <= 680) {
    return { version: 1, sidebarOpen: false, inspectorOpen: false };
  }
  if (viewportWidth <= 980) {
    return { version: 1, sidebarOpen: true, inspectorOpen: false };
  }
  return { version: 1, sidebarOpen: true, inspectorOpen: true };
}

export function parseStoredPanelView(
  raw: string | null,
  viewportWidth: number,
): PanelViewState {
  const fallback = defaultPanelView(viewportWidth);
  if (raw === null || raw.length > MAX_PANEL_VIEW_JSON_CHARS) {
    return fallback;
  }
  try {
    const candidate: unknown = JSON.parse(raw);
    if (!isPanelViewState(candidate)) {
      return fallback;
    }
    return candidate;
  } catch {
    return fallback;
  }
}

export function loadPanelView(
  storage: Pick<Storage, "getItem">,
  viewportWidth: number,
): PanelViewState {
  try {
    return parseStoredPanelView(
      storage.getItem(PANEL_VIEW_STORAGE_KEY),
      viewportWidth,
    );
  } catch {
    return defaultPanelView(viewportWidth);
  }
}

export function serializePanelView(state: PanelViewState): string {
  if (!isPanelViewState(state)) {
    return JSON.stringify(defaultPanelView(1_280));
  }
  return JSON.stringify({
    version: 1,
    sidebarOpen: state.sidebarOpen,
    inspectorOpen: state.inspectorOpen,
  });
}

export function savePanelView(
  storage: Pick<Storage, "setItem">,
  state: PanelViewState,
): boolean {
  try {
    storage.setItem(PANEL_VIEW_STORAGE_KEY, serializePanelView(state));
    return true;
  } catch {
    return false;
  }
}

export function toggleSidebar(state: PanelViewState): PanelViewState {
  return { ...state, sidebarOpen: !state.sidebarOpen };
}

export function toggleInspector(state: PanelViewState): PanelViewState {
  return { ...state, inspectorOpen: !state.inspectorOpen };
}

export function workspaceStatusText(input: {
  connection: ConnectionState;
  selectedSessionName: string | null;
  terminalCaptured: boolean;
}): string {
  const connection =
    input.connection === "connected"
      ? "Connected"
      : input.connection === "connecting"
        ? "Connecting"
        : "Disconnected";
  const session = input.selectedSessionName ?? "No terminal selected";
  const keyboard = input.terminalCaptured
    ? "Terminal capture"
    : "Application controls";
  return `${connection} · ${session} · ${keyboard}`;
}

function isPanelViewState(candidate: unknown): candidate is PanelViewState {
  if (
    typeof candidate !== "object" ||
    candidate === null ||
    Array.isArray(candidate)
  ) {
    return false;
  }
  const record = candidate as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return (
    keys.length === 3 &&
    keys[0] === "inspectorOpen" &&
    keys[1] === "sidebarOpen" &&
    keys[2] === "version" &&
    record.version === 1 &&
    typeof record.sidebarOpen === "boolean" &&
    typeof record.inspectorOpen === "boolean"
  );
}
