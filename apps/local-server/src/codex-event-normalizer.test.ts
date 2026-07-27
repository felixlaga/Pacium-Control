import { describe, expect, it } from "vitest";

import { ProviderActivitySchema } from "@pacium/contracts";

import { normalizeCodexServerMessage } from "./codex-event-normalizer.js";

const now = "2026-07-28T10:00:00.000Z";
const threadId = "019c0000-0000-7000-8000-000000000001";
const turnId = "019c0000-0000-7000-8000-000000000002";

describe("Codex App Server event normalization", () => {
  it("normalizes thread, turn, plan, completion, and status metadata", () => {
    expect(
      accepted({
        method: "thread/started",
        params: {
          thread: {
            id: threadId,
            cliVersion: "0.145.0",
            preview: "private prompt",
            cwd: "/private/repository",
            path: "/private/session.jsonl",
          },
        },
      }),
    ).toMatchObject({
      providerVersion: "0.145.0",
      activity: { kind: "session_started" },
      attention: { state: "waiting" },
    });
    expect(
      accepted({
        method: "turn/started",
        params: {
          threadId,
          turn: {
            id: turnId,
            status: "inProgress",
            items: [{ type: "userMessage", text: "private prompt" }],
          },
        },
      }),
    ).toMatchObject({
      activity: { kind: "turn_started" },
      attention: { state: "working" },
    });
    expect(
      accepted({
        method: "turn/plan/updated",
        params: {
          threadId,
          turnId,
          explanation: "private explanation",
          plan: [{ step: "private plan step", status: "inProgress" }],
        },
      }),
    ).toMatchObject({
      activity: { kind: "plan_updated" },
      preserveAttention: true,
    });
    expect(
      accepted({
        method: "turn/completed",
        params: {
          threadId,
          turn: {
            id: turnId,
            status: "completed",
            items: [{ type: "agentMessage", text: "private response" }],
          },
        },
      }),
    ).toMatchObject({
      activity: { kind: "turn_completed" },
      attention: { state: "waiting" },
    });
    expect(
      accepted({
        method: "thread/status/changed",
        params: {
          threadId,
          status: {
            type: "active",
            activeFlags: ["waitingOnUserInput"],
          },
        },
      }),
    ).toMatchObject({
      activity: null,
      attention: { state: "needs_input" },
    });
  });

  it("maps tool item lifecycle while discarding command and output content", () => {
    const started = accepted({
      method: "item/started",
      params: {
        threadId,
        turnId,
        startedAtMs: Date.parse(now),
        item: {
          id: "item-1",
          type: "commandExecution",
          status: "inProgress",
          command: "cat private-file",
          cwd: "/private/repository",
          aggregatedOutput: "private output",
        },
      },
    });
    const completed = accepted({
      method: "item/completed",
      params: {
        threadId,
        turnId,
        completedAtMs: Date.parse(now),
        item: {
          id: "item-1",
          type: "commandExecution",
          status: "completed",
          command: "cat private-file",
          cwd: "/private/repository",
          aggregatedOutput: "private output",
        },
      },
    });

    expect(started.activity).toMatchObject({
      kind: "tool_started",
      summary: "Codex started command.",
      extension: { itemType: "commandExecution" },
    });
    expect(completed.activity).toMatchObject({
      kind: "tool_completed",
      summary: "Codex completed command.",
    });
    expect(JSON.stringify([started, completed])).not.toContain("private");
  });

  it("keeps approval requests and questions distinct without their content", () => {
    const approval = accepted({
      id: 7,
      method: "item/commandExecution/requestApproval",
      params: {
        threadId,
        turnId,
        itemId: "item-approval",
        command: "dangerous private command",
        cwd: "/private/repository",
        reason: "private approval reason",
      },
    });
    const question = accepted({
      id: "request-question",
      method: "item/tool/requestUserInput",
      params: {
        threadId,
        turnId,
        itemId: "item-question",
        questions: [
          {
            id: "secret",
            question: "private question",
            options: [{ label: "private answer" }],
          },
        ],
      },
    });
    const elicitation = accepted({
      id: "mcp-question",
      method: "mcpServer/elicitation/request",
      params: {
        threadId,
        turnId: null,
        serverName: "private MCP server",
        request: { prompt: "private elicitation" },
      },
    });

    expect(approval).toMatchObject({
      activity: { kind: "approval_requested" },
      attention: { state: "needs_input" },
    });
    expect(approval.capabilities).toContain("approvals");
    expect(question).toMatchObject({
      activity: { kind: "question_requested" },
      attention: { state: "needs_input" },
    });
    expect(question.capabilities).toContain("questions");
    expect(elicitation).toMatchObject({
      turnId: null,
      activity: { kind: "question_requested" },
    });
    expect(JSON.stringify([approval, question, elicitation])).not.toContain(
      "private",
    );
  });

  it("normalizes exact cumulative usage semantics", () => {
    const result = accepted({
      method: "thread/tokenUsage/updated",
      params: {
        threadId,
        turnId,
        tokenUsage: {
          modelContextWindow: 200_000,
          last: {
            inputTokens: 1,
            cachedInputTokens: 2,
            outputTokens: 3,
            reasoningOutputTokens: 4,
            totalTokens: 8,
          },
          total: {
            inputTokens: 12_000,
            cachedInputTokens: 8_000,
            outputTokens: 900,
            reasoningOutputTokens: 400,
            totalTokens: 12_900,
          },
        },
      },
    });

    expect(result).toMatchObject({
      activity: {
        kind: "usage_updated",
        extension: {
          provider: "codex",
          modelContextWindow: 200_000,
          totalInputTokens: 12_000,
          totalCachedInputTokens: 8_000,
          totalOutputTokens: 900,
          totalReasoningOutputTokens: 400,
          totalTokens: 12_900,
        },
      },
      preserveAttention: true,
    });
    expect(result.capabilities).toContain("usage");
    expect(() => ProviderActivitySchema.parse(result.activity)).not.toThrow();
  });

  it("keeps retrying and terminal provider failures distinct", () => {
    expect(
      accepted({
        method: "error",
        params: {
          threadId,
          turnId,
          willRetry: true,
          error: { message: "private retry failure" },
        },
      }),
    ).toMatchObject({
      activity: {
        kind: "failed",
        summary: "Codex reported a provider error and will retry.",
      },
      attention: { state: "working" },
    });
    expect(
      accepted({
        method: "error",
        params: {
          threadId,
          turnId,
          willRetry: false,
          error: { message: "private terminal failure" },
        },
      }),
    ).toMatchObject({
      activity: { kind: "failed" },
      attention: { state: "failed" },
    });
  });

  it("ignores responses and unknown notifications but rejects malformed known events", () => {
    expect(
      normalizeCodexServerMessage(
        { id: 1, result: { private: "response" } },
        now,
      ),
    ).toEqual({ status: "ignored" });
    expect(
      normalizeCodexServerMessage(
        { method: "item/agentMessage/delta", params: { delta: "private" } },
        now,
      ),
    ).toEqual({ status: "ignored" });
    expect(
      normalizeCodexServerMessage(
        {
          method: "turn/started",
          params: { threadId, turn: { id: "", status: "inProgress" } },
        },
        now,
      ),
    ).toEqual({ status: "invalid" });
    expect(
      normalizeCodexServerMessage(
        {
          method: "thread/tokenUsage/updated",
          params: {
            threadId,
            turnId,
            tokenUsage: {
              total: {
                inputTokens: -1,
                cachedInputTokens: 0,
                outputTokens: 0,
                reasoningOutputTokens: 0,
                totalTokens: 0,
              },
            },
          },
        },
        now,
      ),
    ).toEqual({ status: "invalid" });
  });
});

function accepted(input: unknown) {
  const result = normalizeCodexServerMessage(input, now);
  if (result.status !== "accepted") {
    throw new Error(`Expected accepted event, received ${result.status}.`);
  }
  return result.event;
}
