import type {
  GitChangesObservation,
  ProviderActivity,
  SessionSummary,
} from "@pacium/contracts";
import { describe, expect, it } from "vitest";

import { deriveSessionAttention } from "./attention-model.js";
import {
  buildRecentActivity,
  MAX_RECENT_ACTIVITY_FACTS,
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

function input(candidate: SessionSummary = session): RecentActivityInput {
  return {
    session: candidate,
    attention: deriveSessionAttention(candidate, now),
    changes: { status: "idle" },
    history: { status: "idle" },
    verification: { status: "idle" },
  };
}

function providerSession(
  overrides: Partial<NonNullable<SessionSummary["providerObservation"]>>,
): SessionSummary {
  return {
    ...session,
    launchPreset: "codex",
    commandLabel: "Codex",
    agentClassification: {
      type: "codex",
      label: "Codex CLI",
      source: "launch_preset",
      confidence: "confirmed",
      observedAt: now,
    },
    providerObservation: {
      contractVersion: 1,
      provider: "codex",
      adapterVersion: "1",
      providerVersion: "1.0.0",
      health: {
        state: "ready",
        source: "native",
        confidence: "confirmed",
        detail: "Native observer connected.",
      },
      capabilities: [
        {
          id: "activity",
          availability: "supported",
          source: "native",
          confidence: "confirmed",
          detail: "Structured activity is available.",
        },
      ],
      attention: null,
      activities: [],
      diagnostics: [],
      observedAt: now,
      staleAfter: "2026-07-27T10:05:00.000Z",
      ...overrides,
    },
  };
}

function providerActivity(input: {
  id: string;
  kind: "approval_requested" | "question_requested";
  occurredAt: string;
  observedAt: string;
  summary: string;
  eventType: "approval_request" | "question_request";
}): NonNullable<SessionSummary["providerObservation"]>["activities"][number] {
  return {
    id: input.id,
    kind: input.kind,
    source: "native",
    confidence: "confirmed",
    occurredAt: input.occurredAt,
    observedAt: input.observedAt,
    summary: input.summary,
    extension: {
      provider: "codex",
      eventType: input.eventType,
      threadId: "thread-1",
      turnId: "turn-1",
      itemType: null,
      modelContextWindow: null,
      totalInputTokens: null,
      totalCachedInputTokens: null,
      totalOutputTokens: null,
      totalReasoningOutputTokens: null,
      totalTokens: null,
    },
  };
}

describe("recent activity process facts", () => {
  it("reports a live process without promoting it to work evidence", () => {
    const activity = buildRecentActivity(input());

    expect(activity.current).toMatchObject({
      processState: "live",
      processDetail: "Process is live; assigned-task activity is unverified.",
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

  it("keeps a fixed total fact ceiling", () => {
    expect(MAX_RECENT_ACTIVITY_FACTS).toBe(7);
    expect(buildRecentActivity(input()).facts.length).toBeLessThanOrEqual(
      MAX_RECENT_ACTIVITY_FACTS,
    );
  });
});

describe("recent provider activity", () => {
  it("shows an unavailable observer without inventing activity or attention", () => {
    const candidate = providerSession({
      health: {
        state: "unavailable",
        source: "none",
        confidence: "low",
        detail: "No provider observer is connected.",
      },
      providerVersion: null,
      attention: null,
      activities: [],
    });
    const activity = buildRecentActivity(input(candidate));

    expect(activity.current.attention).toMatchObject({
      state: "unknown",
      source: "process",
      confidence: "low",
    });
    expect(activity.facts.every(({ source }) => source !== "provider")).toBe(
      true,
    );
    expect(activity.sources[0]).toMatchObject({
      id: "provider",
      label: "Codex observer",
      status: "unavailable",
    });
    expect(activity.sources[0]?.detail).toContain(
      "provider version unavailable",
    );
    expect(activity.partial).toBe(true);
  });

  it("projects distinct approval and question facts from validated evidence", () => {
    const candidate = providerSession({
      activities: [
        providerActivity({
          id: "approval-1",
          kind: "approval_requested",
          occurredAt: "2026-07-27T10:03:00.000Z",
          observedAt: "2026-07-27T10:03:00.000Z",
          summary: "Command approval requested.",
          eventType: "approval_request",
        }),
        providerActivity({
          id: "question-1",
          kind: "question_requested",
          occurredAt: "2026-07-27T10:02:00.000Z",
          observedAt: "2026-07-27T10:02:00.000Z",
          summary: "A blocking question was asked.",
          eventType: "question_request",
        }),
      ],
    });
    const activity = buildRecentActivity(input(candidate));
    const providerFacts = activity.facts.filter(
      ({ source }) => source === "provider",
    );

    expect(providerFacts.map(({ title }) => title)).toEqual([
      "Approval requested",
      "Question asked",
    ]);
    expect(providerFacts[0]).toMatchObject({
      kind: "provider_approval",
      tone: "attention",
      detail: "Command approval requested.",
      metadata: ["Codex", "Provider native", "Confirmed"],
      target: "terminal",
    });
    expect(providerFacts[1]).toMatchObject({
      kind: "provider_question",
      tone: "attention",
    });
    expect(activity.sources[0]).toMatchObject({
      id: "provider",
      status: "ready",
    });
    expect(activity.sources[0]?.detail).toContain("1.0.0");
  });

  it("shows bounded Claude status usage without raw status content", () => {
    const candidate = providerSession({
      provider: "claude",
      providerVersion: "2.1.207",
      health: {
        state: "ready",
        source: "hook",
        confidence: "high",
        detail: "Claude hooks are connected.",
      },
      activities: [
        {
          id: "usage-1",
          kind: "usage_updated",
          source: "hook",
          confidence: "high",
          occurredAt: "2026-07-27T10:03:00.000Z",
          observedAt: "2026-07-27T10:03:00.000Z",
          summary: "Claude status and usage snapshot updated.",
          extension: {
            provider: "claude",
            eventType: "status",
            providerSessionId: "claude-session-1",
            toolName: null,
            modelId: "claude-opus-5",
            contextUsedPercent: 12.5,
            totalCostUsd: 0.5,
            totalInputTokens: 1_000,
            totalOutputTokens: 100,
          },
        },
      ],
    });
    const activity = buildRecentActivity(input(candidate));
    const fact = activity.facts.find(({ source }) => source === "provider");

    expect(fact).toMatchObject({
      kind: "provider_usage",
      tone: "neutral",
      title: "Provider usage updated",
      detail:
        "Claude status and usage snapshot updated. · Model claude-opus-5 · Context 12.5% · 1,000 input tokens · 100 output tokens · Cost $0.50",
      metadata: ["Claude Code", "Provider hook", "High confidence"],
    });
    expect(fact?.detail).not.toContain("session_name");
    expect(fact?.detail).not.toContain("transcript");
  });

  it("shows bounded cumulative Codex usage without conversation content", () => {
    const candidate = providerSession({
      activities: [
        {
          id: "usage-1",
          kind: "usage_updated",
          source: "native",
          confidence: "confirmed",
          occurredAt: "2026-07-27T10:03:00.000Z",
          observedAt: "2026-07-27T10:03:00.000Z",
          summary: "Codex cumulative token usage updated.",
          extension: {
            provider: "codex",
            eventType: "usage_update",
            threadId: "thread-1",
            turnId: null,
            itemType: null,
            modelContextWindow: 200_000,
            totalInputTokens: 10_000,
            totalCachedInputTokens: 8_000,
            totalOutputTokens: 1_000,
            totalReasoningOutputTokens: 400,
            totalTokens: 11_000,
          },
        },
      ],
    });
    const activity = buildRecentActivity(input(candidate));
    const fact = activity.facts.find(({ source }) => source === "provider");

    expect(fact).toMatchObject({
      kind: "provider_usage",
      tone: "neutral",
      title: "Provider usage updated",
      detail:
        "Codex cumulative token usage updated. · 200,000 token context window · 10,000 input tokens · 8,000 cached input tokens · 1,000 output tokens · 400 reasoning output tokens · 11,000 total tokens",
      metadata: ["Codex", "Provider native", "Confirmed"],
    });
    expect(fact?.detail).not.toContain("private prompt");
    expect(fact?.detail).not.toContain("private response");
  });

  it("labels expired provider evidence stale while retaining process truth", () => {
    const candidate = providerSession({
      attention: {
        state: "working",
        source: "native",
        confidence: "confirmed",
        observedAt: "2026-07-27T09:55:00.000Z",
        staleAfter: "2026-07-27T09:59:00.000Z",
        reason: "A turn was active.",
      },
      observedAt: "2026-07-27T09:55:00.000Z",
      staleAfter: "2026-07-27T09:59:00.000Z",
    });
    const activity = buildRecentActivity(input(candidate));

    expect(activity.current.processState).toBe("live");
    expect(activity.current.attention).toMatchObject({
      state: "stale",
      source: "native",
    });
    expect(activity.sources[0]?.status).toBe("stale");
    expect(activity.terminalFallback.recommended).toBe(true);
  });

  it.each([
    ["session_started", "provider_session", "neutral"],
    ["prompt_submitted", "provider_prompt", "active"],
    ["turn_started", "provider_turn", "active"],
    ["message", "provider_message", "neutral"],
    ["tool_started", "provider_tool", "active"],
    ["tool_completed", "provider_tool", "neutral"],
    ["plan_updated", "provider_plan", "active"],
    ["approval_requested", "provider_approval", "attention"],
    ["question_requested", "provider_question", "attention"],
    ["usage_updated", "provider_usage", "neutral"],
    ["turn_completed", "provider_completion", "success"],
    ["session_completed", "provider_completion", "success"],
    ["failed", "provider_failure", "danger"],
  ] as const)("maps %s to a %s %s card", (kind, cardKind, tone) => {
    const candidate = providerSession({
      activities: [genericProviderActivity(kind)],
    });
    const activity = buildRecentActivity(input(candidate));
    const fact = activity.facts.find(({ source }) => source === "provider");

    expect(fact).toMatchObject({
      kind: cardKind,
      tone,
      target: "terminal",
      metadata: ["Codex", "Provider native", "Confirmed"],
    });
    expect(fact?.metadata).toHaveLength(3);
  });

  it("recommends fallback without provider evidence but not for ready native evidence", () => {
    const shellActivity = buildRecentActivity(input());
    const nativeActivity = buildRecentActivity(input(providerSession({})));

    expect(shellActivity.terminalFallback).toMatchObject({
      recommended: true,
    });
    expect(shellActivity.terminalFallback.reason).toContain(
      "No provider observer applies",
    );
    expect(nativeActivity.terminalFallback).toMatchObject({
      recommended: false,
    });
    expect(nativeActivity.terminalFallback.boundaryKey).toContain(session.id);
  });
});

function genericProviderActivity(
  kind: ProviderActivity["kind"],
): ProviderActivity {
  return {
    id: `activity-${kind}`,
    kind,
    source: "native",
    confidence: "confirmed",
    occurredAt: "2026-07-27T10:03:00.000Z",
    observedAt: "2026-07-27T10:03:00.000Z",
    summary: "Bounded provider activity observed.",
    extension: {
      provider: "codex",
      eventType: "item_complete",
      threadId: "thread-1",
      turnId: "turn-1",
      itemType: null,
      modelContextWindow: null,
      totalInputTokens: null,
      totalCachedInputTokens: null,
      totalOutputTokens: null,
      totalReasoningOutputTokens: null,
      totalTokens: null,
    },
  };
}

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

  it("keeps prior unavailable evidence visible but marks its refresh in flight", () => {
    const previous: GitChangesObservation = {
      status: "error",
      root: "/work/pacium",
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
      error: {
        code: "timeout",
        message: "Git inspection timed out.",
      },
    };
    const activity = buildRecentActivity({
      ...input(),
      changes: {
        status: "loading",
        requestId: "6b32082f-e6a4-478a-a9f9-b0f05b847581",
        previous,
      },
    });

    expect(activity.sources[0]).toMatchObject({
      status: "loading",
      detail: "Git inspection timed out. Refreshing.",
    });
    expect(activity.loading).toBe(true);
  });
});

describe("recent activity verification facts", () => {
  it("projects one latest result without repeating untrusted output", () => {
    const activity = buildRecentActivity({
      ...input(),
      verification: {
        status: "loaded",
        sessionId: session.id,
        pendingRequestId: null,
        pendingAction: null,
        observation: {
          status: "ready",
          configured: true,
          root: "/work/pacium",
          observedAt: "2026-07-27T10:06:00.000Z",
          presets: [
            {
              id: "verify",
              label: "<Project verification>",
              description: "Run the bounded local gate",
              executable: "/opt/bin/pnpm",
              args: ["verify"],
              timeoutMs: 600_000,
            },
          ],
          run: {
            runId: "03c2723f-e87a-4707-86af-d6fdb1e60f47",
            presetId: "verify",
            status: "failed",
            startedAt: "2026-07-27T10:04:00.000Z",
            completedAt: "2026-07-27T10:05:00.000Z",
            durationMs: 60_000,
            headCommitAtStart: "a".repeat(40),
            headCommitAtEnd: "a".repeat(40),
            headComparison: "same",
            exitCode: 2,
            signal: null,
            terminationForced: false,
            stdout: "<script>terminal narrative</script>",
            stderr: "secret output",
            stdoutTruncated: false,
            stderrTruncated: false,
            error: null,
          },
          error: null,
        },
      },
    });

    const fact = activity.facts.find(({ source }) => source === "verification");
    expect(fact).toMatchObject({
      title: "Verification failed",
      detail: "<Project verification> · 60.0 s · exit 2",
      timestamp: "2026-07-27T10:05:00.000Z",
      timestampMeaning: "occurred",
    });
    expect(JSON.stringify(fact)).not.toContain("terminal narrative");
    expect(JSON.stringify(fact)).not.toContain("secret output");
  });

  it("distinguishes empty and degraded verification evidence", () => {
    const unconfigured = buildRecentActivity({
      ...input(),
      verification: {
        status: "loaded",
        sessionId: session.id,
        pendingRequestId: null,
        pendingAction: null,
        observation: {
          status: "unconfigured",
          configured: false,
          root: null,
          observedAt: now,
          presets: [],
          run: null,
          error: null,
        },
      },
    });
    expect(unconfigured.sources[2]).toMatchObject({
      status: "empty",
      detail: "Verification is not configured.",
    });

    const errored = buildRecentActivity({
      ...input(),
      verification: {
        status: "loaded",
        sessionId: session.id,
        pendingRequestId: null,
        pendingAction: null,
        observation: {
          status: "error",
          configured: true,
          root: "/work/pacium",
          observedAt: now,
          presets: [],
          run: null,
          error: {
            code: "repository_unavailable",
            message: "Repository moved.",
          },
        },
      },
    });
    expect(errored.sources[2]).toMatchObject({
      status: "error",
      detail: "Repository moved.",
    });
    expect(errored.partial).toBe(true);
  });
});
