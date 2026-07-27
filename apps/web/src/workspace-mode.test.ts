import { describe, expect, it, vi } from "vitest";

import {
  WORKSPACE_MODE_STORAGE_KEY,
  loadWorkspaceMode,
  saveWorkspaceMode,
} from "./workspace-mode.js";

describe("workspace mode persistence", () => {
  it("defaults safely to General for missing, malformed, or unknown state", () => {
    for (const value of [
      null,
      "{invalid",
      JSON.stringify({ version: 2, mode: "pacium" }),
      JSON.stringify({ version: 1, mode: "other" }),
      JSON.stringify({ version: 1, mode: "pacium", authority: "shell" }),
      JSON.stringify(["pacium"]),
    ]) {
      expect(
        loadWorkspaceMode({
          getItem: () => value,
        }),
      ).toBe("general");
    }
  });

  it("restores only exact version-1 General and Pacium values", () => {
    expect(
      loadWorkspaceMode({
        getItem: () => JSON.stringify({ version: 1, mode: "general" }),
      }),
    ).toBe("general");
    expect(
      loadWorkspaceMode({
        getItem: () => JSON.stringify({ version: 1, mode: "pacium" }),
      }),
    ).toBe("pacium");
  });

  it("writes one bounded presentation value without server state", () => {
    const setItem = vi.fn();
    expect(saveWorkspaceMode({ setItem }, "pacium")).toBe(true);
    expect(setItem).toHaveBeenCalledWith(
      WORKSPACE_MODE_STORAGE_KEY,
      JSON.stringify({ version: 1, mode: "pacium" }),
    );
  });

  it("fails closed when browser storage is unavailable", () => {
    expect(
      loadWorkspaceMode({
        getItem: () => {
          throw new Error("storage unavailable");
        },
      }),
    ).toBe("general");
    expect(
      saveWorkspaceMode(
        {
          setItem: () => {
            throw new Error("storage unavailable");
          },
        },
        "pacium",
      ),
    ).toBe(false);
  });
});
