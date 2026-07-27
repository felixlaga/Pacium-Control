import type { SessionSummary } from "@pacium/contracts";
import { describe, expect, it } from "vitest";

import { deriveProcessAttention } from "./attention-model.js";
import {
  buildRecentActivity,
  type RecentActivityInput,
} from "./recent-activity-model.js";

const now = "2026-07-27T10:00:00.000Z";
const session: SessionSummary = {
  id: "53cfec56-181c-4e9c-b187-8f323780c175",
  epoch: 3,
  displayName: "Orchestrator",
  cwd: "/work/pacium",
  shell: "/bin/zsh",
  launchPreset: "shell",
  commandLabel: "Shell",
  agentClassification: {
    type: "shell",
    label: "Shell",
    source: "launch_preset",
    confidence: "confirmed",
    observedAt: now,
  },
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

function input(
  candidate: SessionSummary = session,
): RecentActivityInput {
  return {
    session: candidate,
    attention: deriveProcessAttention(candidate, now),
    changes: { status: "idle" },
    history: { status: "idle" },
    verification: { status: "idle" },
  };
}

describe("recent activity process facts", () => {
  it("reports a live process without promoting it to work evidence", () => {
    const activity = buildRecentActivity(input());

    expect(activity.current).toMatchObject({
      processState: "live",
      processDetail:
        "Process is live; assigned-task activity is unverified.",
    });
    expect(activity.current.attention).toMatchObject({
      state: "unknown",
      source: "process",
      confidence: "low",
    });
    expect(activity.facts).toEqual([
      expect.objectContaining({
        id: `process:${session.id}:3:started`,
        title: "Terminal process started",
        timestampMeaning: "occurred",
      }),
    ]);
  });

  it("orders exit before start and keeps the task outcome unverified", () => {
    const ended: SessionSummary = {
      ...session,
      processState: "exited",
      pid: null,
      exitedAt: "2026-07-27T10:05:00.000Z",
      exitCode: 0,
    };
    const activity = buildRecentActivity(input(ended));

    expect(activity.facts.map(({ title }) => title)).toEqual([
      "Terminal process exited",
      "Terminal process started",
    ]);
    expect(activity.facts[0]?.detail).toBe(
      "Process exited with code 0; task outcome is unverified.",
    );
  });

  it("uses signal evidence and omits invalid lifecycle timestamps", () => {
    const signalled: SessionSummary = {
      ...session,
      processState: "failed",
      pid: null,
      createdAt: "invalid",
      exitedAt: "2026-07-27T10:05:00.000Z",
      exitSignal: 15,
    };
    const activity = buildRecentActivity(input(signalled));

    expect(activity.facts).toHaveLength(1);
    expect(activity.facts[0]?.detail).toContain("signal 15");
    expect(activity.current.processDetail).toContain(
      "task outcome is unverified",
    );
  });
});
