import { describe, expect, it } from "vitest";

import {
  IDLE_WORKSPACE_MODE_CHORD,
  WORKSPACE_MODE_CHORD_TIMEOUT_MS,
  advanceWorkspaceModeChord,
} from "./workspace-mode-shortcut.js";

const baseKey = {
  code: "",
  now: 1_000,
  blocked: false,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
};

describe("General/Pacium mode chord", () => {
  it("arms on G and toggles on P inside the bounded window", () => {
    const armed = advanceWorkspaceModeChord(IDLE_WORKSPACE_MODE_CHORD, {
      ...baseKey,
      code: "KeyG",
    });
    expect(armed).toEqual({
      state: { armedAt: 1_000 },
      handled: true,
      toggle: false,
    });

    expect(
      advanceWorkspaceModeChord(armed.state, {
        ...baseKey,
        code: "KeyP",
        now: 1_000 + WORKSPACE_MODE_CHORD_TIMEOUT_MS,
      }),
    ).toEqual({
      state: IDLE_WORKSPACE_MODE_CHORD,
      handled: true,
      toggle: true,
    });
  });

  it("resets without a mode effect for a wrong or late second key", () => {
    const armed = { armedAt: 1_000 };
    expect(
      advanceWorkspaceModeChord(armed, {
        ...baseKey,
        code: "KeyQ",
        now: 1_100,
      }),
    ).toEqual({
      state: IDLE_WORKSPACE_MODE_CHORD,
      handled: false,
      toggle: false,
    });
    expect(
      advanceWorkspaceModeChord(armed, {
        ...baseKey,
        code: "KeyP",
        now: 1_000 + WORKSPACE_MODE_CHORD_TIMEOUT_MS + 1,
      }),
    ).toEqual({
      state: IDLE_WORKSPACE_MODE_CHORD,
      handled: false,
      toggle: false,
    });
  });

  it("never arms or completes while another keyboard owner is active", () => {
    for (const input of [
      { blocked: true },
      { metaKey: true },
      { ctrlKey: true },
      { shiftKey: true },
      { altKey: true },
    ]) {
      expect(
        advanceWorkspaceModeChord(
          { armedAt: 1_000 },
          { ...baseKey, code: "KeyP", ...input },
        ),
      ).toEqual({
        state: IDLE_WORKSPACE_MODE_CHORD,
        handled: false,
        toggle: false,
      });
    }
  });

  it("requires monotonic time and allows G to restart the chord", () => {
    expect(
      advanceWorkspaceModeChord(
        { armedAt: 2_000 },
        { ...baseKey, code: "KeyP", now: 1_999 },
      ).toggle,
    ).toBe(false);
    expect(
      advanceWorkspaceModeChord(
        { armedAt: 1_000 },
        { ...baseKey, code: "KeyG", now: 1_500 },
      ),
    ).toMatchObject({
      state: { armedAt: 1_500 },
      handled: true,
      toggle: false,
    });
  });
});
