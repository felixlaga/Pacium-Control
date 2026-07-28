import { describe, expect, it } from "vitest";

import { ProviderObservationSnapshotSchema } from "@pacium/contracts";

import {
  ClaudeObserver,
  CLAUDE_OBSERVER_TOKEN_ENV,
  parseClaudeVersion,
} from "./claude-observer.js";

const sessionId = "53cfec56-181c-4e9c-b187-8f323780c175";
const providerSessionId = "claude-provider-session";
const token = "t".repeat(43);
let now = "2026-07-28T10:00:00.000Z";

function observer(providerVersion: string | null = "2.1.206"): ClaudeObserver {
  return new ClaudeObserver({
    baseUrl: "http://127.0.0.1:4174",
    providerVersion,
    now: () => now,
    tokenFactory: () => token,
  });
}

function hook(
  hook_event_name:
    | "SessionStart"
    | "UserPromptSubmit"
    | "PreToolUse"
    | "PermissionRequest"
    | "PostToolUse"
    | "PostToolUseFailure"
    | "Notification"
    | "Stop"
    | "StopFailure"
    | "SessionEnd",
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    session_id: providerSessionId,
    prompt_id: "prompt-1",
    transcript_path: "/secret/transcript.jsonl",
    cwd: "/work/pacium",
    permission_mode: "manual",
    hook_event_name,
    ...extra,
  };
}

describe("Claude observer launch preparation", () => {
  it("creates fixed observation-only HTTP hooks and a separate token", () => {
    const instance = observer();
    const prepared = instance.prepare(sessionId, now);
    const settings = JSON.parse(prepared.args[1] ?? "{}") as {
      hooks: Record<
        string,
        Array<{
          hooks: Array<{
            type: string;
            url: string;
            timeout: number;
            headers: Record<string, string>;
            allowedEnvVars: string[];
          }>;
        }>
      >;
    };

    expect(prepared.args[0]).toBe("--settings");
    expect(prepared.environment).toEqual({
      [CLAUDE_OBSERVER_TOKEN_ENV]: token,
    });
    expect(Object.keys(settings.hooks)).toEqual([
      "SessionStart",
      "UserPromptSubmit",
      "PreToolUse",
      "PermissionRequest",
      "PostToolUse",
      "PostToolUseFailure",
      "Notification",
      "Stop",
      "StopFailure",
      "SessionEnd",
    ]);
    for (const groups of Object.values(settings.hooks)) {
      expect(groups[0]?.hooks[0]).toEqual({
        type: "http",
        url: `http://127.0.0.1:4174/api/provider/claude/${sessionId}/hook`,
        timeout: 1,
        headers: {
          Authorization: `Bearer $${CLAUDE_OBSERVER_TOKEN_ENV}`,
        },
        allowedEnvVars: [CLAUDE_OBSERVER_TOKEN_ENV],
      });
    }
    expect(JSON.stringify(settings)).not.toContain(token);
    expect(JSON.stringify(settings)).not.toContain("decision");
    expect(prepared.observation).toMatchObject({
      provider: "claude",
      providerVersion: "2.1.206",
      health: { state: "unavailable", source: "none" },
      attention: null,
      activities: [],
    });
    expect(
      prepared.observation.capabilities.every(
        ({ availability }) => availability === "unknown",
      ),
    ).toBe(true);
  });

  it("rejects unsafe origins and token factories", () => {
    expect(
      () =>
        new ClaudeObserver({
          baseUrl: "http://0.0.0.0:4174",
          providerVersion: null,
        }),
    ).toThrow("loopback");
    const instance = new ClaudeObserver({
      baseUrl: "http://127.0.0.1:4174",
      providerVersion: null,
      tokenFactory: () => "short",
    });
    expect(() => instance.prepare(sessionId, now)).toThrow("unsafe token");
    const invalidCharacters = new ClaudeObserver({
      baseUrl: "http://127.0.0.1:4174",
      providerVersion: null,
      tokenFactory: () => "x".repeat(31) + "/",
    });
    expect(() => invalidCharacters.prepare(sessionId, now)).toThrow(
      "unsafe token",
    );
  });

  it("reports missing version detection without disabling observation", () => {
    const instance = observer(null);
    const prepared = instance.prepare(sessionId, now);

    expect(prepared.observation).toMatchObject({
      health: { state: "unavailable" },
      providerVersion: null,
      diagnostics: [
        {
          code: "claude.version_unavailable",
          severity: "warning",
          fields: [],
        },
      ],
    });
    const accepted = instance.ingestHook(
      sessionId,
      token,
      hook("SessionStart"),
    );
    expect(accepted).toMatchObject({
      status: "accepted",
      observation: {
        health: { state: "ready" },
        providerVersion: null,
        diagnostics: [{ code: "claude.version_unavailable" }],
      },
    });
  });
});

describe("Claude hook normalization", () => {
  it("maps lifecycle, tool, approval, question, completion, and failure", () => {
    const instance = observer();
    instance.prepare(sessionId, now);
    const observations: string[] = [];
    instance.onUpdate((_id, observation) => {
      observations.push(observation.activities[0]?.kind ?? "missing");
    });

    const events: Array<[ReturnType<typeof hook>, string]> = [
      [hook("SessionStart"), "session_started"],
      [hook("UserPromptSubmit", { prompt_id: "prompt-2" }), "prompt_submitted"],
      [
        hook("PreToolUse", {
          prompt_id: "prompt-2",
          tool_name: "Bash",
          tool_use_id: "tool-1",
          tool_input: { command: "print secret" },
        }),
        "tool_started",
      ],
      [
        hook("PermissionRequest", {
          prompt_id: "prompt-2",
          tool_name: "Bash",
          tool_use_id: "tool-2",
          tool_input: { command: "do not store" },
        }),
        "approval_requested",
      ],
      [
        hook("Notification", {
          prompt_id: "prompt-2",
          notification_type: "agent_needs_input",
          message: "private question",
        }),
        "question_requested",
      ],
      [
        hook("PostToolUse", {
          prompt_id: "prompt-2",
          tool_name: "Bash",
          tool_use_id: "tool-1",
          tool_response: "secret output",
        }),
        "tool_completed",
      ],
      [
        hook("Stop", { prompt_id: "prompt-2", stop_hook_active: false }),
        "turn_completed",
      ],
      [
        hook("StopFailure", {
          prompt_id: "prompt-3",
          error: { message: "private provider error" },
        }),
        "failed",
      ],
      [hook("SessionEnd", { prompt_id: "prompt-4" }), "session_completed"],
    ];

    for (const [payload] of events) {
      now = new Date(Date.parse(now) + 1_000).toISOString();
      expect(instance.ingestHook(sessionId, token, payload).status).toBe(
        "accepted",
      );
    }

    expect(observations).toEqual(events.map(([, kind]) => kind));
    const final = instance.ingestHook(
      sessionId,
      token,
      hook("SessionEnd", { prompt_id: "prompt-4" }),
    );
    expect(final.status).toBe("duplicate");
    if (final.status !== "duplicate") {
      throw new Error("Expected duplicate observation");
    }
    expect(final.observation).toMatchObject({
      health: { state: "ready", source: "hook", confidence: "high" },
      attention: { state: "finished", source: "hook" },
    });
    expect(final.observation.activities).toHaveLength(events.length);
    expect(
      final.observation.capabilities.find(({ id }) => id === "approvals"),
    ).toMatchObject({ availability: "supported", source: "hook" });
    expect(
      final.observation.capabilities.find(({ id }) => id === "questions"),
    ).toMatchObject({ availability: "supported", source: "hook" });
    const serialized = JSON.stringify(final.observation);
    for (const forbidden of [
      "print secret",
      "do not store",
      "private question",
      "secret output",
      "private provider error",
      "transcript.jsonl",
      "/work/pacium",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(() =>
      ProviderObservationSnapshotSchema.parse(final.observation),
    ).not.toThrow();
  });

  it("keeps tool failure distinct from whole-turn failure", () => {
    const instance = observer();
    instance.prepare(sessionId, now);
    const result = instance.ingestHook(
      sessionId,
      token,
      hook("PostToolUseFailure", {
        tool_name: "Edit",
        tool_use_id: "tool-failed",
        error: "private",
      }),
    );

    expect(result).toMatchObject({
      status: "accepted",
      observation: {
        activities: [
          { kind: "failed", summary: "Claude reported a failure from Edit." },
        ],
        attention: {
          state: "working",
          reason: "A Claude tool failed; turn outcome is still pending.",
        },
      },
    });
  });

  it("rejects credentials, unknown sessions, mismatches, and unsupported notifications", () => {
    const instance = observer();
    instance.prepare(sessionId, now);
    expect(
      instance.ingestHook(sessionId, "wrong-token", hook("SessionStart")),
    ).toEqual({ status: "rejected", code: "invalid_token" });
    expect(
      instance.ingestHook(
        "00000000-0000-4000-8000-000000000099",
        token,
        hook("SessionStart"),
      ),
    ).toEqual({ status: "rejected", code: "unknown_session" });
    expect(
      instance.ingestHook(sessionId, token, {
        ...hook("SessionStart"),
        session_id: "",
      }),
    ).toEqual({ status: "rejected", code: "invalid_payload" });

    expect(
      instance.ingestHook(sessionId, token, hook("SessionStart")).status,
    ).toBe("accepted");
    expect(
      instance.ingestHook(sessionId, token, {
        ...hook("Stop"),
        session_id: "another-provider-session",
      }),
    ).toEqual({
      status: "rejected",
      code: "provider_session_mismatch",
    });
    expect(
      instance.ingestHook(
        sessionId,
        token,
        hook("Notification", { notification_type: "auth_success" }),
      ),
    ).toEqual({ status: "rejected", code: "unsupported_event" });

    instance.release(sessionId);
    expect(instance.hasSession(sessionId)).toBe(false);
    expect(instance.ingestHook(sessionId, token, hook("Stop"))).toEqual({
      status: "rejected",
      code: "unknown_session",
    });
  });
});

describe("Claude status normalization", () => {
  it("records bounded usage and version without raw status content", () => {
    const instance = observer(null);
    instance.prepare(sessionId, now);
    const result = instance.ingestStatus(sessionId, token, {
      session_id: providerSessionId,
      session_name: "private session title",
      transcript_path: "/private/transcript.jsonl",
      cwd: "/work/private",
      version: "2.1.207",
      model: { id: "claude-opus-5", display_name: "Opus" },
      workspace: { current_dir: "/work/private" },
      cost: {
        total_cost_usd: 1.25,
        total_duration_ms: 45_000,
      },
      context_window: {
        total_input_tokens: 12_000,
        total_output_tokens: 900,
        used_percentage: 41.5,
        current_usage: { cache_read_input_tokens: 2_000 },
      },
    });

    expect(result).toMatchObject({
      status: "accepted",
      observation: {
        providerVersion: "2.1.207",
        health: { state: "ready", source: "hook" },
        diagnostics: [],
        activities: [
          {
            kind: "usage_updated",
            extension: {
              provider: "claude",
              eventType: "status",
              modelId: "claude-opus-5",
              contextUsedPercent: 41.5,
              totalCostUsd: 1.25,
              totalInputTokens: 12_000,
              totalOutputTokens: 900,
            },
          },
        ],
      },
    });
    expect(JSON.stringify(result)).not.toContain("private session title");
    expect(JSON.stringify(result)).not.toContain("/work/private");
    expect(JSON.stringify(result)).not.toContain("transcript.jsonl");
  });

  it("rejects invalid usage and provider-session drift", () => {
    const instance = observer();
    instance.prepare(sessionId, now);
    const valid = {
      session_id: providerSessionId,
      version: "2.1.206",
      model: { id: "claude-sonnet-5" },
      cost: { total_cost_usd: 0 },
      context_window: {
        total_input_tokens: 0,
        total_output_tokens: 0,
        used_percentage: null,
      },
    };
    expect(
      instance.ingestStatus(sessionId, token, {
        ...valid,
        context_window: { ...valid.context_window, used_percentage: 101 },
      }),
    ).toEqual({ status: "rejected", code: "invalid_payload" });
    expect(instance.ingestStatus(sessionId, token, valid).status).toBe(
      "accepted",
    );
    expect(
      instance.ingestStatus(sessionId, token, {
        ...valid,
        session_id: "other-provider-session",
      }),
    ).toEqual({
      status: "rejected",
      code: "provider_session_mismatch",
    });
  });
});

describe("Claude version parsing", () => {
  it("accepts exact bounded Claude Code version output", () => {
    expect(parseClaudeVersion("2.1.206 (Claude Code)\n")).toBe("2.1.206");
    expect(parseClaudeVersion("  2.1.206  ")).toBe("2.1.206");
  });

  it("rejects banners, prerelease text, and unbounded output", () => {
    expect(parseClaudeVersion("Claude Code 2.1.206")).toBeNull();
    expect(parseClaudeVersion("2.1.206-beta")).toBeNull();
    expect(parseClaudeVersion(`2.1.206\n${"x".repeat(100)}`)).toBeNull();
  });
});
