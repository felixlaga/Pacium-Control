import { describe, expect, it } from "vitest";

import {
  DEFAULT_FILES_WIDTH,
  DEFAULT_PANEL_WIDTHS,
  DEFAULT_RAIL_WIDTH,
  MAX_FILES_WIDTH,
  MAX_RAIL_WIDTH,
  MIN_FILES_WIDTH,
  MIN_RAIL_WIDTH,
  clampFilesWidth,
  clampRailWidth,
  loadPanelWidths,
  savePanelWidths,
} from "./panel-size-model.js";

describe("panel width clamping", () => {
  it("bounds both panels to their ranges", () => {
    expect(clampRailWidth(0)).toBe(MIN_RAIL_WIDTH);
    expect(clampRailWidth(10_000)).toBe(MAX_RAIL_WIDTH);
    expect(clampRailWidth(300)).toBe(300);
    expect(clampFilesWidth(0)).toBe(MIN_FILES_WIDTH);
    expect(clampFilesWidth(10_000)).toBe(MAX_FILES_WIDTH);
    expect(clampFilesWidth(400)).toBe(400);
  });
});

describe("panel width persistence", () => {
  it("round-trips through storage with clamping", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };
    savePanelWidths(storage, { rail: 999, files: 5 });
    expect(loadPanelWidths(storage)).toEqual({
      rail: MAX_RAIL_WIDTH,
      files: MIN_FILES_WIDTH,
    });
    savePanelWidths(storage, { rail: 288, files: 420 });
    expect(loadPanelWidths(storage)).toEqual({ rail: 288, files: 420 });
  });

  it("falls back to defaults for absent, invalid, or throwing storage", () => {
    expect(loadPanelWidths({ getItem: () => null })).toEqual(
      DEFAULT_PANEL_WIDTHS,
    );
    expect(loadPanelWidths({ getItem: () => "not json" })).toEqual(
      DEFAULT_PANEL_WIDTHS,
    );
    expect(
      loadPanelWidths({ getItem: () => '{"rail":"wide","files":344}' }),
    ).toEqual(DEFAULT_PANEL_WIDTHS);
    expect(
      loadPanelWidths({
        getItem: () => {
          throw new Error("blocked");
        },
      }),
    ).toEqual({ rail: DEFAULT_RAIL_WIDTH, files: DEFAULT_FILES_WIDTH });
  });
});
