import type { SessionSummary } from "@pacium/contracts";
import { describe, expect, it } from "vitest";

import {
  deriveProcessAttention,
  reduceAttention,
  type AttentionObservation,
} from "./attention-model.js";

const now = "2026-07-27T10:00:00.000Z";
const later = "2026-07-27T10:05:00.000Z";
const session: SessionSummary = {
  id: "53cfec56-181c-4e9c-b187-8f323780c175",
  epoch: 1,
  displayName: "Meta",
  cwd: "/work/pacium",
  shell: "/opt/bin/codex",
  launchPreset: "codex",
  commandLabel: "Codex",
  agentClassification: {
    type: "codex",
    label: "Codex CLI",
    source: "launch_preset",
    confidence: "confirmed",
    observedAt: now,
  },
  repositoryRoot: "/work/pacium",
  repositoryName: "pacium",
  runtime: "pty",
  processState: "live",
  pid: 42,
  cols: 100,
  rows: 30,
  createdAt: now,
  exitedAt: null,
  exitCode: null,
  exitSignal: null,
};

function observation(
  overrides: Partial<AttentionObservation>,
): AttentionObservation {
  return {
    state: "working",
    source: "terminal",
    confidence: "low",
    observedAt: now,
    staleAfter: later,
    reason: "Terminal output changed.",
    ...overrides,
  };
}

describe("attention reducer", () => {
  it("orders source, then confidence, then recency deterministically", () => {
    const result = reduceAttention(
      [
        observation({
          state: "working",
          observedAt: "2026-07-27T10:04:00.000Z",
        }),
        observation({
          state: "waiting",
          source: "native",
          confidence: "confirmed",
          reason: "Provider reported a wait.",
        }),
      ],
      now,
    );
    expect(result.state).toBe("waiting");
    expect(result.source).toBe("native");
  });

  it("keeps expired strong evidence stale instead of promoting terminal noise", () => {
    const result = reduceAttention(
      [
        observation({
          state: "needs_input",
          source: "hook",
          confidence: "high",
          observedAt: "2026-07-27T09:58:00.000Z",
          staleAfter: "2026-07-27T09:59:00.000Z",
          reason: "Hook reported a blocking question.",
        }),
        observation({
          state: "working",
          observedAt: "2026-07-27T09:59:30.000Z",
          staleAfter: later,
        }),
      ],
      now,
    );
    expect(result).toMatchObject({
      state: "stale",
      source: "hook",
      confidence: "high",
    });
  });

  it("ignores invalid observations and returns a bounded unknown result", () => {
    expect(
      reduceAttention(
        [observation({ observedAt: "not-a-date", reason: "" })],
        now,
      ),
    ).toEqual({
      state: "unknown",
      source: "none",
      confidence: "low",
      observedAt: now,
      staleAfter: now,
      reason: "No attention evidence is available.",
    });
  });
});

describe("process attention", () => {
  it("never turns a live process into working evidence", () => {
    const result = deriveProcessAttention(session, now);
    expect(result).toMatchObject({
      state: "unknown",
      source: "process",
      confidence: "low",
    });
    expect(result.reason.toLocaleLowerCase()).not.toContain("working");
  });

  it("distinguishes clean exit from failure without claiming task completion", () => {
    const clean = deriveProcessAttention(
      {
        ...session,
        processState: "exited",
        pid: null,
        exitedAt: now,
        exitCode: 0,
      },
      now,
    );
    expect(clean).toMatchObject({
      state: "finished",
      source: "process",
      confidence: "medium",
    });
    expect(clean.reason).toContain("task completion is unverified");

    const failed = deriveProcessAttention(
      {
        ...session,
        processState: "exited",
        pid: null,
        exitedAt: now,
        exitCode: 2,
      },
      now,
    );
    expect(failed).toMatchObject({
      state: "failed",
      source: "process",
      confidence: "high",
    });
  });
});
