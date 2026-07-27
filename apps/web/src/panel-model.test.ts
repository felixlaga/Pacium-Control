import { describe, expect, it } from "vitest";

import {
  MAX_PANEL_VIEW_JSON_CHARS,
  defaultPanelView,
  loadPanelView,
  parseStoredPanelView,
  savePanelView,
  serializePanelView,
  toggleInspector,
  toggleSidebar,
  workspaceStatusText,
} from "./panel-model.js";

describe("panel view state", () => {
  it("chooses responsive-safe defaults", () => {
    expect(defaultPanelView(1_280)).toEqual({
      version: 1,
      sidebarOpen: true,
      inspectorOpen: true,
    });
    expect(defaultPanelView(800)).toEqual({
      version: 1,
      sidebarOpen: true,
      inspectorOpen: false,
    });
    expect(defaultPanelView(320)).toEqual({
      version: 1,
      sidebarOpen: false,
      inspectorOpen: false,
    });
  });

  it("strictly parses one bounded versioned record", () => {
    const state = {
      version: 1 as const,
      sidebarOpen: false,
      inspectorOpen: true,
    };
    expect(parseStoredPanelView(serializePanelView(state), 1_280)).toEqual(
      state,
    );
    expect(
      parseStoredPanelView(
        JSON.stringify({ ...state, unexpected: "terminal text" }),
        1_280,
      ),
    ).toEqual(defaultPanelView(1_280));
    expect(parseStoredPanelView("{", 320)).toEqual(defaultPanelView(320));
    expect(
      parseStoredPanelView("x".repeat(MAX_PANEL_VIEW_JSON_CHARS + 1), 320),
    ).toEqual(defaultPanelView(320));
  });

  it("recovers from unavailable browser storage", () => {
    expect(
      loadPanelView(
        {
          getItem() {
            throw new Error("Denied");
          },
        },
        320,
      ),
    ).toEqual(defaultPanelView(320));
    expect(
      savePanelView(
        {
          setItem() {
            throw new Error("Denied");
          },
        },
        defaultPanelView(1_280),
      ),
    ).toBe(false);
  });

  it("toggles panels without changing the other panel", () => {
    const state = defaultPanelView(1_280);
    expect(toggleSidebar(state)).toEqual({
      ...state,
      sidebarOpen: false,
    });
    expect(toggleInspector(state)).toEqual({
      ...state,
      inspectorOpen: false,
    });
  });

  it("builds concise status without terminal bytes or paths", () => {
    expect(
      workspaceStatusText({
        connection: "connected",
        selectedSessionName: "Meta",
        terminalCaptured: true,
      }),
    ).toBe("Connected · Meta · Terminal capture");
    expect(
      workspaceStatusText({
        connection: "disconnected",
        selectedSessionName: null,
        terminalCaptured: false,
      }),
    ).toBe("Disconnected · No terminal selected · Application controls");
  });
});
