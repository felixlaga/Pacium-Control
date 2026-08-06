const PANEL_WIDTHS_STORAGE_KEY = "pacium.panelWidths";

export const DEFAULT_RAIL_WIDTH = 264;
export const DEFAULT_FILES_WIDTH = 344;
export const MIN_RAIL_WIDTH = 200;
export const MAX_RAIL_WIDTH = 420;
export const MIN_FILES_WIDTH = 280;
export const MAX_FILES_WIDTH = 620;
export const PANEL_RESIZE_STEP = 16;

export interface PanelWidths {
  rail: number;
  files: number;
}

export const DEFAULT_PANEL_WIDTHS: PanelWidths = {
  rail: DEFAULT_RAIL_WIDTH,
  files: DEFAULT_FILES_WIDTH,
};

export function clampRailWidth(width: number): number {
  return clamp(width, MIN_RAIL_WIDTH, MAX_RAIL_WIDTH);
}

export function clampFilesWidth(width: number): number {
  return clamp(width, MIN_FILES_WIDTH, MAX_FILES_WIDTH);
}

export function loadPanelWidths(
  storage: Pick<Storage, "getItem">,
): PanelWidths {
  let raw: string | null;
  try {
    raw = storage.getItem(PANEL_WIDTHS_STORAGE_KEY);
  } catch {
    return DEFAULT_PANEL_WIDTHS;
  }
  if (raw === null) {
    return DEFAULT_PANEL_WIDTHS;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("rail" in parsed) ||
      !("files" in parsed) ||
      typeof parsed.rail !== "number" ||
      typeof parsed.files !== "number" ||
      !Number.isFinite(parsed.rail) ||
      !Number.isFinite(parsed.files)
    ) {
      return DEFAULT_PANEL_WIDTHS;
    }
    return {
      rail: clampRailWidth(Math.round(parsed.rail)),
      files: clampFilesWidth(Math.round(parsed.files)),
    };
  } catch {
    return DEFAULT_PANEL_WIDTHS;
  }
}

export function savePanelWidths(
  storage: Pick<Storage, "setItem">,
  widths: PanelWidths,
): void {
  try {
    storage.setItem(
      PANEL_WIDTHS_STORAGE_KEY,
      JSON.stringify({
        rail: clampRailWidth(Math.round(widths.rail)),
        files: clampFilesWidth(Math.round(widths.files)),
      }),
    );
  } catch {
    // Persisting widths is a convenience; losing them is not an error.
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
