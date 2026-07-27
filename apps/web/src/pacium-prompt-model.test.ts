import { describe, expect, it } from "vitest";

import {
  EMPTY_PACIUM_PROMPT,
  MAX_PACIUM_PROMPT_CHARACTERS,
  acceptPaciumPromptResult,
  beginPaciumPromptSend,
  canSendPaciumPrompt,
  interruptPaciumPrompt,
  paciumPromptTerminalInput,
  reconcilePaciumPromptTarget,
  rejectPaciumPromptResult,
  validatePaciumPrompt,
  type PaciumPromptState,
} from "./pacium-prompt-model.js";
import type { PaciumPromptTargetProjection } from "./pacium-prompt-target-model.js";

describe("Pacium prompt model", () => {
  it("normalizes one bounded control-free line and appends one carriage return", () => {
    expect(validatePaciumPrompt("  Review the current plan  ")).toMatchObject({
      valid: true,
      normalized: "Review the current plan",
      characterCount: 27,
      error: null,
    });
    expect(paciumPromptTerminalInput("  Review the current plan  ")).toBe(
      "Review the current plan\r",
    );
  });

  it("counts Unicode code points instead of UTF-16 code units", () => {
    expect(validatePaciumPrompt("🧪".repeat(4_000))).toMatchObject({
      valid: true,
      characterCount: 4_000,
    });
    expect(validatePaciumPrompt("🧪".repeat(4_001))).toMatchObject({
      valid: false,
      characterCount: 4_001,
    });
  });

  it.each(["\n", "\r", "\t", "\u0000", "\u001b", "\u007f", "\u0085"])(
    "rejects terminal control %j",
    (control) => {
      expect(validatePaciumPrompt(`before${control}after`)).toMatchObject({
        valid: false,
        normalized: null,
        error: "Line breaks and terminal control characters are not allowed.",
      });
      expect(paciumPromptTerminalInput(`before${control}after`)).toBeNull();
    },
  );

  it("rejects blank and oversized prompts without producing terminal input", () => {
    expect(validatePaciumPrompt("   ")).toMatchObject({
      valid: false,
      error: "Enter one prompt before sending.",
    });
    expect(
      validatePaciumPrompt("x".repeat(MAX_PACIUM_PROMPT_CHARACTERS + 1)),
    ).toMatchObject({ valid: false, characterCount: 4_001 });
    expect(paciumPromptTerminalInput(" \n ")).toBeNull();
  });

  it("requires one available explicit target and no pending request", () => {
    const valid: PaciumPromptState = {
      draft: "Inspect the failing test",
      targetId: "role:meta",
      pending: null,
    };
    expect(canSendPaciumPrompt(valid, targets(true))).toBe(true);
    expect(
      canSendPaciumPrompt({ ...valid, targetId: null }, targets(true)),
    ).toBe(false);
    expect(canSendPaciumPrompt(valid, targets(false))).toBe(false);
    expect(
      canSendPaciumPrompt(
        {
          ...valid,
          pending: {
            requestId: "request-1",
            targetId: "role:meta",
            sessionId: "00000000-0000-4000-8000-000000000001",
          },
        },
        targets(true),
      ),
    ).toBe(false);
  });

  it("correlates only the exact request and clears scope only on acceptance", () => {
    const pending = beginPaciumPromptSend(
      {
        draft: "Review",
        targetId: "role:meta",
        pending: null,
      },
      {
        requestId: "request-1",
        targetId: "role:meta",
        sessionId: "00000000-0000-4000-8000-000000000001",
      },
    );
    expect(acceptPaciumPromptResult(pending, "unrelated")).toBe(pending);
    expect(rejectPaciumPromptResult(pending, "unrelated")).toBe(pending);
    expect(rejectPaciumPromptResult(pending, "request-1")).toEqual({
      draft: "Review",
      targetId: "role:meta",
      pending: null,
    });
    expect(acceptPaciumPromptResult(pending, "request-1")).toBe(
      EMPTY_PACIUM_PROMPT,
    );
  });

  it("prevents a second pending send from replacing the first", () => {
    const pending: PaciumPromptState = {
      draft: "Review",
      targetId: "role:meta",
      pending: {
        requestId: "request-1",
        targetId: "role:meta",
        sessionId: "00000000-0000-4000-8000-000000000001",
      },
    };
    expect(
      beginPaciumPromptSend(pending, {
        requestId: "request-2",
        targetId: "role:orchestrator",
        sessionId: "00000000-0000-4000-8000-000000000002",
      }),
    ).toBe(pending);
  });

  it("retains draft but clears scope and pending on unknown disconnect", () => {
    expect(
      interruptPaciumPrompt({
        draft: "Inspect before retry",
        targetId: "role:meta",
        pending: {
          requestId: "request-1",
          targetId: "role:meta",
          sessionId: "00000000-0000-4000-8000-000000000001",
        },
      }),
    ).toEqual({
      draft: "Inspect before retry",
      targetId: null,
      pending: null,
    });
  });

  it("clears a drifted idle target while retaining the draft", () => {
    const state: PaciumPromptState = {
      draft: "Keep this draft",
      targetId: "role:meta",
      pending: null,
    };
    expect(reconcilePaciumPromptTarget(state, targets(false))).toEqual({
      ...state,
      targetId: null,
    });
    expect(reconcilePaciumPromptTarget(state, targets(true))).toBe(state);
  });
});

function targets(available: boolean): PaciumPromptTargetProjection {
  return {
    status: "ready",
    message: "Choose one target.",
    targets: [
      {
        id: "role:meta",
        kind: "role",
        label: "Meta",
        status: "connected",
        statusLabel: "Connected",
        detail: "Codex · /work",
        sessionId: "00000000-0000-4000-8000-000000000001",
        available,
      },
    ],
  };
}
