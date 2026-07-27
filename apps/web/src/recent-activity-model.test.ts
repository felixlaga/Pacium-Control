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

describe("recent activity Git facts", () => {
  it("projects one observed working-tree summary with exact totals", () => {
    const activity = buildRecentActivity({
      ...input(),
      changes: {
        status: "loaded",
        requestId: "6b32082f-e6a4-478a-a9f9-b0f05b847581",
        observation: {
          status: "ready",
          root: "/work/pacium",
          headCommit: "a".repeat(40),
          observedAt: "2026-07-27T10:04:00.000Z",
          files: [
            {
              path: "apps/web/src/app.tsx",
              previousPath: null,
              kind: "modified",
              staged: false,
              unstaged: true,
              untracked: false,
              conflicted: false,
              binary: false,
              large: false,
              additions: 8,
              deletions: 2,
              sizeBytes: 320,
            },
          ],
          totals: {
            fileCount: 1,
            additions: 8,
            deletions: 2,
            unavailableLineCount: 0,
            conflictCount: 0,
          },
          truncated: false,
          error: null,
        },
      },
    });

    expect(activity.facts[0]).toMatchObject({
      source: "git",
      title: "1 changed file observed",
      detail: "+8 −2",
      timestampMeaning: "observed",
    });
    expect(activity.sources[0]).toMatchObject({
      id: "changes",
      status: "ready",
      detail: "1 changed file observed.",
    });
  });

  it("caps commits at three and orders all facts by their evidence time", () => {
    const commits = [4, 3, 2, 1].map((minute) => ({
      id: `${minute}`.repeat(40),
      parents: minute === 1 ? [] : [`${minute - 1}`.repeat(40)],
      authorName: `<author-${minute}>`,
      authoredAt: `2026-07-27T10:0${minute}:00.000Z`,
      subject: `<commit-${minute}>`,
    }));
    const activity = buildRecentActivity({
      ...input(),
      history: {
        status: "loaded",
        requestId: "6b32082f-e6a4-478a-a9f9-b0f05b847581",
        sessionId: session.id,
        observation: {
          status: "ready",
          root: "/work/pacium",
          headCommit: commits[0]!.id,
          observedAt: "2026-07-27T10:05:00.000Z",
          commits,
          truncated: false,
          error: null,
        },
      },
    });

    const commitFacts = activity.facts.filter(({ id }) =>
      id.startsWith("git:commit:"),
    );
    expect(commitFacts).toHaveLength(3);
    expect(commitFacts.map(({ title }) => title)).toEqual([
      "<commit-4>",
      "<commit-3>",
      "<commit-2>",
    ]);
    expect(commitFacts[0]).toMatchObject({
      detail: `Git commit ${"4".repeat(8)} · author recorded as <author-4>`,
      timestampMeaning: "occurred",
    });
  });

  it("labels clean, unavailable, empty, and error observations honestly", () => {
    const noRepository = buildRecentActivity({
      ...input(),
      changes: {
        status: "loaded",
        requestId: "6b32082f-e6a4-478a-a9f9-b0f05b847581",
        observation: {
          status: "not_repository",
          root: null,
          headCommit: null,
          observedAt: now,
          files: [],
          totals: {
            fileCount: 0,
            additions: 0,
            deletions: 0,
            unavailableLineCount: 0,
            conflictCount: 0,
          },
          truncated: false,
          error: null,
        },
      },
      history: {
        status: "loaded",
        requestId: "6b32082f-e6a4-478a-a9f9-b0f05b847581",
        sessionId: session.id,
        observation: {
          status: "empty",
          root: "/work/pacium",
          headCommit: null,
          observedAt: now,
          commits: [],
          truncated: false,
          error: null,
        },
      },
    });

    expect(noRepository.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "changes",
          status: "unavailable",
        }),
        expect.objectContaining({ id: "history", status: "empty" }),
      ]),
    );
  });
});
