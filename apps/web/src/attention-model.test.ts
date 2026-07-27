import type { SessionSummary } from "@pacium/contracts";
import { describe, expect, it } from "vitest";

import {
  deriveProcessAttention,
  deriveSessionAttention,
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
  providerObservation: null,
  repository: {
    status: "ready",
    root: "/work/pacium",
    name: "pacium",
    branch: "dev",
    headCommit: "a".repeat(40),
    headState: "branch",
    worktreeKind: "main",
    observedAt: now,
    error: null,
  },
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

describe("provider attention", () => {
  it("uses explicit native evidence ahead of a live process", () => {
    const result = deriveSessionAttention(
      {
        ...session,
        providerObservation: providerObservation({
          state: "needs_input",
          source: "native",
          reason: "Codex requested an approval.",
        }),
      },
      now,
    );

    expect(result).toMatchObject({
      state: "needs_input",
      source: "native",
      confidence: "confirmed",
      reason: "Codex requested an approval.",
    });
  });

  it("uses hook evidence without promoting it to native", () => {
    const result = deriveSessionAttention(
      {
        ...session,
        providerObservation: providerObservation({
          state: "working",
          source: "hook",
          confidence: "high",
          reason: "Claude reported a tool start through a hook.",
        }),
      },
      now,
    );

    expect(result).toMatchObject({
      state: "working",
      source: "hook",
      confidence: "high",
    });
  });

  it("expires provider attention at the earlier snapshot boundary", () => {
    const result = deriveSessionAttention(
      {
        ...session,
        providerObservation: {
          ...providerObservation({
            state: "working",
            source: "native",
            staleAfter: later,
          }),
          staleAfter: "2026-07-27T10:01:00.000Z",
        },
      },
      "2026-07-27T10:02:00.000Z",
    );

    expect(result).toMatchObject({
      state: "stale",
      source: "native",
      staleAfter: "2026-07-27T10:01:00.000Z",
    });
  });

  it("keeps unavailable observers as process-only unknown evidence", () => {
    const result = deriveSessionAttention(
      {
        ...session,
        providerObservation: {
          ...providerObservation(),
          health: {
            state: "unavailable",
            source: "none",
            confidence: "low",
            detail: "Observer is not connected.",
          },
          attention: null,
        },
      },
      now,
    );

    expect(result).toMatchObject({
      state: "unknown",
      source: "process",
      confidence: "low",
    });
  });
});

type ProviderAttention = NonNullable<
  NonNullable<SessionSummary["providerObservation"]>["attention"]
>;

function providerObservation(
  attention: Partial<ProviderAttention> = {},
): NonNullable<SessionSummary["providerObservation"]> {
  return {
    contractVersion: 1,
    provider: "codex",
    adapterVersion: "1",
    providerVersion: "0.145.0",
    health: {
      state: "ready",
      source: "native",
      confidence: "confirmed",
      detail: "Native observer connected.",
    },
    capabilities: [],
    attention: {
      state: "working",
      source: "native",
      confidence: "confirmed",
      observedAt: now,
      staleAfter: later,
      reason: "Provider reported an active turn.",
      ...attention,
    },
    activities: [],
    diagnostics: [],
    observedAt: now,
    staleAfter: later,
  };
}
