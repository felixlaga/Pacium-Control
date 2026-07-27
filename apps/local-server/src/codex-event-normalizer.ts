import { createHash } from "node:crypto";

import type {
  ProviderActivity,
  ProviderAttention,
  ProviderCapabilityId,
} from "@pacium/contracts";
import { z } from "zod";

const BoundedId = z.string().min(1).max(200);
const RequestId = z.union([
  z.string().min(1).max(200),
  z.number().int().safe(),
]);
const ThreadItemType = z.enum([
  "userMessage",
  "hookPrompt",
  "agentMessage",
  "plan",
  "reasoning",
  "commandExecution",
  "fileChange",
  "mcpToolCall",
  "dynamicToolCall",
  "collabAgentToolCall",
  "subAgentActivity",
  "webSearch",
  "imageView",
  "sleep",
  "imageGeneration",
  "enteredReviewMode",
  "exitedReviewMode",
  "contextCompaction",
]);
const ThreadItem = z
  .object({
    id: BoundedId,
    type: ThreadItemType,
    status: z
      .enum(["inProgress", "completed", "failed", "declined"])
      .optional(),
  })
  .passthrough();
const ThreadTurn = z
  .object({
    id: BoundedId,
    status: z.enum(["completed", "interrupted", "failed", "inProgress"]),
  })
  .passthrough();
const ThreadIdParams = z
  .object({
    threadId: BoundedId,
  })
  .passthrough();
const ThreadTurnParams = ThreadIdParams.extend({
  turnId: BoundedId,
}).passthrough();
const ItemParams = ThreadTurnParams.extend({
  item: ThreadItem,
}).passthrough();

const CodexServerEventSchema = z.discriminatedUnion("method", [
  z
    .object({
      method: z.literal("thread/started"),
      params: z
        .object({
          thread: z
            .object({
              id: BoundedId,
              cliVersion: z.string().min(1).max(80).optional(),
            })
            .passthrough(),
        })
        .passthrough(),
    })
    .passthrough(),
  z
    .object({
      method: z.literal("thread/status/changed"),
      params: ThreadIdParams.extend({
        status: z.discriminatedUnion("type", [
          z.object({ type: z.literal("notLoaded") }).passthrough(),
          z.object({ type: z.literal("idle") }).passthrough(),
          z.object({ type: z.literal("systemError") }).passthrough(),
          z
            .object({
              type: z.literal("active"),
              activeFlags: z
                .array(z.enum(["waitingOnApproval", "waitingOnUserInput"]))
                .max(2),
            })
            .passthrough(),
        ]),
      }).passthrough(),
    })
    .passthrough(),
  z
    .object({
      method: z.literal("turn/started"),
      params: ThreadIdParams.extend({ turn: ThreadTurn }).passthrough(),
    })
    .passthrough(),
  z
    .object({
      method: z.literal("turn/completed"),
      params: ThreadIdParams.extend({ turn: ThreadTurn }).passthrough(),
    })
    .passthrough(),
  z
    .object({
      method: z.literal("item/started"),
      params: ItemParams,
    })
    .passthrough(),
  z
    .object({
      method: z.literal("item/completed"),
      params: ItemParams,
    })
    .passthrough(),
  z
    .object({
      method: z.literal("turn/plan/updated"),
      params: ThreadTurnParams.extend({
        plan: z
          .array(
            z
              .object({
                status: z.enum(["pending", "inProgress", "completed"]),
                step: z.string().max(4_096),
              })
              .passthrough(),
          )
          .max(64),
      }).passthrough(),
    })
    .passthrough(),
  z
    .object({
      method: z.literal("thread/tokenUsage/updated"),
      params: ThreadTurnParams.extend({
        tokenUsage: z
          .object({
            modelContextWindow: boundedCount().nullable().optional(),
            total: z
              .object({
                inputTokens: boundedCount(),
                cachedInputTokens: boundedCount(),
                outputTokens: boundedCount(),
                reasoningOutputTokens: boundedCount(),
                totalTokens: boundedCount(),
              })
              .passthrough(),
          })
          .passthrough(),
      }).passthrough(),
    })
    .passthrough(),
  z
    .object({
      method: z.literal("error"),
      params: ThreadTurnParams.extend({
        willRetry: z.boolean(),
      }).passthrough(),
    })
    .passthrough(),
  approvalRequest("item/commandExecution/requestApproval"),
  approvalRequest("item/fileChange/requestApproval"),
  approvalRequest("item/permissions/requestApproval"),
  questionRequest("item/tool/requestUserInput"),
  z
    .object({
      id: RequestId,
      method: z.literal("mcpServer/elicitation/request"),
      params: ThreadIdParams.extend({
        turnId: BoundedId.nullable().optional(),
        serverName: z.string().min(1).max(200),
      }).passthrough(),
    })
    .passthrough(),
]);
const CODEX_OBSERVED_METHODS = new Set<string>(
  CodexServerEventSchema.options.map((option) => option.shape.method.value),
);

type CodexServerEvent = z.infer<typeof CodexServerEventSchema>;
type CodexItemType = z.infer<typeof ThreadItemType>;

export interface NormalizedCodexEvent {
  method: CodexServerEvent["method"];
  threadId: string;
  turnId: string | null;
  fingerprint: string;
  providerVersion: string | null;
  activity: ProviderActivity | null;
  attention: ProviderAttention | null;
  preserveAttention: boolean;
  capabilities: readonly ProviderCapabilityId[];
}

export type CodexNormalizeResult =
  | { status: "accepted"; event: NormalizedCodexEvent }
  | { status: "ignored" }
  | { status: "invalid" };

export function normalizeCodexServerMessage(
  input: unknown,
  observedAt: string,
): CodexNormalizeResult {
  if (!isServerEventCandidate(input)) {
    return { status: "ignored" };
  }
  if (
    typeof input.method !== "string" ||
    !CODEX_OBSERVED_METHODS.has(input.method)
  ) {
    return { status: "ignored" };
  }
  const parsed = CodexServerEventSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "invalid" };
  }
  return {
    status: "accepted",
    event: normalizeEvent(parsed.data, observedAt),
  };
}

function normalizeEvent(
  event: CodexServerEvent,
  observedAt: string,
): NormalizedCodexEvent {
  switch (event.method) {
    case "thread/started":
      return normalized({
        method: event.method,
        threadId: event.params.thread.id,
        turnId: null,
        providerVersion: event.params.thread.cliVersion ?? null,
        activity: activity(
          event.method,
          "session_started",
          event.params.thread.id,
          null,
          null,
          "Codex thread started.",
          observedAt,
        ),
        attention: attention(
          "waiting",
          observedAt,
          "Codex is ready for input.",
        ),
        capabilities: ["activity", "attention"],
      });
    case "thread/status/changed":
      return normalizeThreadStatus(event, observedAt);
    case "turn/started":
      return normalized({
        method: event.method,
        threadId: event.params.threadId,
        turnId: event.params.turn.id,
        activity: activity(
          event.method,
          "turn_started",
          event.params.threadId,
          event.params.turn.id,
          null,
          "Codex turn started.",
          observedAt,
        ),
        attention: attention(
          "working",
          observedAt,
          "Codex reported an active turn.",
        ),
        capabilities: ["activity", "attention"],
      });
    case "turn/completed":
      return normalizeTurnCompleted(event, observedAt);
    case "item/started":
    case "item/completed":
      return normalizeItem(event, observedAt);
    case "turn/plan/updated":
      return normalized({
        method: event.method,
        threadId: event.params.threadId,
        turnId: event.params.turnId,
        activity: activity(
          event.method,
          "plan_updated",
          event.params.threadId,
          event.params.turnId,
          "plan",
          "Codex updated the current plan.",
          observedAt,
        ),
        attention: null,
        preserveAttention: true,
        status: event.params.plan.map(({ status }) => status).join(","),
        capabilities: ["activity", "plan"],
      });
    case "thread/tokenUsage/updated": {
      const usage = event.params.tokenUsage;
      return normalized({
        method: event.method,
        threadId: event.params.threadId,
        turnId: event.params.turnId,
        activity: {
          ...activity(
            event.method,
            "usage_updated",
            event.params.threadId,
            event.params.turnId,
            null,
            "Codex token usage updated.",
            observedAt,
          ),
          extension: extension(
            "usage_update",
            event.params.threadId,
            event.params.turnId,
            null,
            {
              modelContextWindow: usage.modelContextWindow ?? null,
              totalInputTokens: usage.total.inputTokens,
              totalCachedInputTokens: usage.total.cachedInputTokens,
              totalOutputTokens: usage.total.outputTokens,
              totalReasoningOutputTokens: usage.total.reasoningOutputTokens,
              totalTokens: usage.total.totalTokens,
            },
          ),
        },
        attention: null,
        preserveAttention: true,
        status: [
          usage.modelContextWindow ?? "",
          usage.total.inputTokens,
          usage.total.cachedInputTokens,
          usage.total.outputTokens,
          usage.total.reasoningOutputTokens,
          usage.total.totalTokens,
        ].join(":"),
        capabilities: ["activity", "usage"],
      });
    }
    case "error":
      return normalized({
        method: event.method,
        threadId: event.params.threadId,
        turnId: event.params.turnId,
        activity: activity(
          event.method,
          "failed",
          event.params.threadId,
          event.params.turnId,
          null,
          event.params.willRetry
            ? "Codex reported a provider error and will retry."
            : "Codex reported a provider error.",
          observedAt,
        ),
        attention: attention(
          event.params.willRetry ? "working" : "failed",
          observedAt,
          event.params.willRetry
            ? "Codex is retrying after a provider error."
            : "Codex reported a provider failure.",
        ),
        status: event.params.willRetry ? "retrying" : "terminal",
        capabilities: ["activity", "attention"],
      });
    case "item/commandExecution/requestApproval":
    case "item/fileChange/requestApproval":
    case "item/permissions/requestApproval":
      return normalized({
        method: event.method,
        requestId: event.id,
        threadId: event.params.threadId,
        turnId: event.params.turnId,
        itemId: event.params.itemId,
        activity: activity(
          event.method,
          "approval_requested",
          event.params.threadId,
          event.params.turnId,
          approvalItemType(event.method),
          "Codex requested approval.",
          observedAt,
          event.id,
        ),
        attention: attention(
          "needs_input",
          observedAt,
          "Codex requested an approval.",
        ),
        capabilities: ["activity", "attention", "approvals"],
      });
    case "item/tool/requestUserInput":
      return normalized({
        method: event.method,
        requestId: event.id,
        threadId: event.params.threadId,
        turnId: event.params.turnId,
        itemId: event.params.itemId,
        activity: activity(
          event.method,
          "question_requested",
          event.params.threadId,
          event.params.turnId,
          "question",
          "Codex requested user input.",
          observedAt,
          event.id,
        ),
        attention: attention(
          "needs_input",
          observedAt,
          "Codex requested user input.",
        ),
        capabilities: ["activity", "attention", "questions"],
      });
    case "mcpServer/elicitation/request":
      return normalized({
        method: event.method,
        requestId: event.id,
        threadId: event.params.threadId,
        turnId: event.params.turnId ?? null,
        activity: activity(
          event.method,
          "question_requested",
          event.params.threadId,
          event.params.turnId ?? null,
          "mcpElicitation",
          "Codex requested user input.",
          observedAt,
          event.id,
        ),
        attention: attention(
          "needs_input",
          observedAt,
          "Codex requested user input.",
        ),
        capabilities: ["activity", "attention", "questions"],
      });
  }
}

function normalizeThreadStatus(
  event: Extract<CodexServerEvent, { method: "thread/status/changed" }>,
  observedAt: string,
): NormalizedCodexEvent {
  const status = event.params.status;
  if (status.type === "active") {
    const waitingApproval = status.activeFlags.includes("waitingOnApproval");
    const waitingInput = status.activeFlags.includes("waitingOnUserInput");
    return normalized({
      method: event.method,
      threadId: event.params.threadId,
      turnId: null,
      status: `${status.type}:${[...status.activeFlags].sort().join(",")}`,
      activity: null,
      attention: attention(
        waitingApproval || waitingInput ? "needs_input" : "working",
        observedAt,
        waitingApproval
          ? "Codex is waiting on an approval."
          : waitingInput
            ? "Codex is waiting on user input."
            : "Codex reported active work.",
      ),
      capabilities: ["attention"],
    });
  }
  return normalized({
    method: event.method,
    threadId: event.params.threadId,
    turnId: null,
    status: status.type,
    activity: null,
    attention: attention(
      status.type === "systemError" ? "failed" : "waiting",
      observedAt,
      status.type === "systemError"
        ? "Codex reported a system error."
        : status.type === "notLoaded"
          ? "Codex has no loaded thread."
          : "Codex is idle.",
    ),
    capabilities: ["attention"],
  });
}

function normalizeTurnCompleted(
  event: Extract<CodexServerEvent, { method: "turn/completed" }>,
  observedAt: string,
): NormalizedCodexEvent {
  const status = event.params.turn.status;
  const failed = status === "failed";
  const inProgress = status === "inProgress";
  return normalized({
    method: event.method,
    threadId: event.params.threadId,
    turnId: event.params.turn.id,
    status,
    activity: activity(
      event.method,
      failed ? "failed" : "turn_completed",
      event.params.threadId,
      event.params.turn.id,
      null,
      failed
        ? "Codex turn failed."
        : status === "interrupted"
          ? "Codex turn was interrupted."
          : inProgress
            ? "Codex reported an in-progress turn update."
            : "Codex turn completed.",
      observedAt,
    ),
    attention: attention(
      failed ? "failed" : inProgress ? "working" : "waiting",
      observedAt,
      failed
        ? "Codex reported a failed turn."
        : inProgress
          ? "Codex reported an active turn."
          : "Codex is waiting after the turn.",
    ),
    capabilities: ["activity", "attention", "completion"],
  });
}

function normalizeItem(
  event: Extract<
    CodexServerEvent,
    { method: "item/started" | "item/completed" }
  >,
  observedAt: string,
): NormalizedCodexEvent {
  const { item, threadId, turnId } = event.params;
  const started = event.method === "item/started";
  const failed = item.status === "failed" || item.status === "declined";
  const kind = itemActivityKind(item.type, started, failed);
  const summary = itemActivitySummary(item.type, started, failed);
  return normalized({
    method: event.method,
    threadId,
    turnId,
    itemId: item.id,
    itemType: item.type,
    status: item.status ?? null,
    activity:
      kind === null || summary === null
        ? null
        : activity(
            event.method,
            kind,
            threadId,
            turnId,
            item.type,
            summary,
            observedAt,
          ),
    attention:
      kind === null
        ? null
        : attention(
            "working",
            observedAt,
            failed
              ? "A Codex item failed; turn outcome is still pending."
              : started
                ? "Codex reported active item work."
                : "Codex completed an item; turn outcome is pending.",
          ),
    preserveAttention: kind === null,
    capabilities:
      kind === "tool_started" ||
      kind === "tool_completed" ||
      (kind === "failed" && isToolItem(item.type))
        ? ["activity", "attention", "tools"]
        : kind === "prompt_submitted" || kind === "message"
          ? ["activity", "attention"]
          : kind === "plan_updated"
            ? ["activity", "attention", "plan"]
            : [],
  });
}

function itemActivityKind(
  type: CodexItemType,
  started: boolean,
  failed: boolean,
): ProviderActivity["kind"] | null {
  if (isToolItem(type)) {
    return failed ? "failed" : started ? "tool_started" : "tool_completed";
  }
  if (started) {
    return null;
  }
  switch (type) {
    case "userMessage":
    case "hookPrompt":
      return "prompt_submitted";
    case "agentMessage":
      return "message";
    case "plan":
      return "plan_updated";
    default:
      return null;
  }
}

function itemActivitySummary(
  type: CodexItemType,
  started: boolean,
  failed: boolean,
): string | null {
  if (isToolItem(type)) {
    return failed
      ? `Codex reported a failed ${itemTypeLabel(type)}.`
      : started
        ? `Codex started ${itemTypeLabel(type)}.`
        : `Codex completed ${itemTypeLabel(type)}.`;
  }
  if (started) {
    return null;
  }
  switch (type) {
    case "userMessage":
    case "hookPrompt":
      return "Codex accepted user input.";
    case "agentMessage":
      return "Codex completed an agent message.";
    case "plan":
      return "Codex completed a plan item.";
    default:
      return null;
  }
}

function isToolItem(type: CodexItemType): boolean {
  return [
    "commandExecution",
    "fileChange",
    "mcpToolCall",
    "dynamicToolCall",
    "collabAgentToolCall",
    "subAgentActivity",
    "webSearch",
    "imageView",
    "sleep",
    "imageGeneration",
    "contextCompaction",
  ].includes(type);
}

function itemTypeLabel(type: CodexItemType): string {
  switch (type) {
    case "commandExecution":
      return "command";
    case "fileChange":
      return "file change";
    case "mcpToolCall":
      return "MCP tool";
    case "dynamicToolCall":
      return "dynamic tool";
    case "collabAgentToolCall":
      return "collaboration tool";
    case "subAgentActivity":
      return "subagent activity";
    case "webSearch":
      return "web search";
    case "imageView":
      return "image view";
    case "sleep":
      return "wait";
    case "imageGeneration":
      return "image generation";
    case "contextCompaction":
      return "context compaction";
    default:
      return "tool";
  }
}

function activity(
  eventType: CodexServerEvent["method"],
  kind: ProviderActivity["kind"],
  threadId: string,
  turnId: string | null,
  itemType: string | null,
  summary: string,
  observedAt: string,
  requestId?: string | number,
): ProviderActivity {
  const fingerprint = eventFingerprint({
    method: eventType,
    threadId,
    turnId,
    itemType,
    requestId,
    summary,
  });
  return {
    id: `codex:${fingerprint.slice(0, 32)}`,
    kind,
    source: "native",
    confidence: "confirmed",
    occurredAt: observedAt,
    observedAt,
    summary,
    extension: extension(codexEventType(eventType), threadId, turnId, itemType),
  };
}

function extension(
  eventType:
    | "thread_start"
    | "turn_start"
    | "item_start"
    | "item_complete"
    | "plan_update"
    | "approval_request"
    | "question_request"
    | "usage_update"
    | "turn_complete"
    | "failure",
  threadId: string,
  turnId: string | null,
  itemType: string | null,
  usage: Partial<{
    modelContextWindow: number | null;
    totalInputTokens: number | null;
    totalCachedInputTokens: number | null;
    totalOutputTokens: number | null;
    totalReasoningOutputTokens: number | null;
    totalTokens: number | null;
  }> = {},
) {
  return {
    provider: "codex" as const,
    eventType,
    threadId,
    turnId,
    itemType,
    modelContextWindow: usage.modelContextWindow ?? null,
    totalInputTokens: usage.totalInputTokens ?? null,
    totalCachedInputTokens: usage.totalCachedInputTokens ?? null,
    totalOutputTokens: usage.totalOutputTokens ?? null,
    totalReasoningOutputTokens: usage.totalReasoningOutputTokens ?? null,
    totalTokens: usage.totalTokens ?? null,
  };
}

function codexEventType(
  method: CodexServerEvent["method"],
):
  | "thread_start"
  | "turn_start"
  | "item_start"
  | "item_complete"
  | "plan_update"
  | "approval_request"
  | "question_request"
  | "usage_update"
  | "turn_complete"
  | "failure" {
  switch (method) {
    case "thread/started":
      return "thread_start";
    case "turn/started":
      return "turn_start";
    case "item/started":
      return "item_start";
    case "item/completed":
      return "item_complete";
    case "turn/plan/updated":
      return "plan_update";
    case "item/commandExecution/requestApproval":
    case "item/fileChange/requestApproval":
    case "item/permissions/requestApproval":
      return "approval_request";
    case "item/tool/requestUserInput":
    case "mcpServer/elicitation/request":
      return "question_request";
    case "thread/tokenUsage/updated":
      return "usage_update";
    case "turn/completed":
      return "turn_complete";
    case "error":
      return "failure";
    case "thread/status/changed":
      return "turn_start";
  }
}

function attention(
  state: ProviderAttention["state"],
  observedAt: string,
  reason: string,
): ProviderAttention {
  const terminal = state === "failed" || state === "finished";
  return {
    state,
    source: "native",
    confidence: "confirmed",
    observedAt,
    staleAfter: new Date(
      Date.parse(observedAt) +
        (terminal ? 24 * 60 : state === "needs_input" ? 30 : 5) * 60_000,
    ).toISOString(),
    reason,
  };
}

function normalized(input: {
  method: CodexServerEvent["method"];
  threadId: string;
  turnId: string | null;
  activity: ProviderActivity | null;
  attention: ProviderAttention | null;
  capabilities: readonly ProviderCapabilityId[];
  providerVersion?: string | null;
  preserveAttention?: boolean;
  requestId?: string | number | undefined;
  itemId?: string | undefined;
  itemType?: string | undefined;
  status?: string | null | undefined;
}): NormalizedCodexEvent {
  const fingerprint = eventFingerprint(input);
  return {
    method: input.method,
    threadId: input.threadId,
    turnId: input.turnId,
    fingerprint,
    providerVersion: input.providerVersion ?? null,
    activity:
      input.activity === null
        ? null
        : { ...input.activity, id: `codex:${fingerprint.slice(0, 32)}` },
    attention: input.attention,
    preserveAttention: input.preserveAttention ?? false,
    capabilities: input.capabilities,
  };
}

function eventFingerprint(input: {
  method: string;
  threadId: string;
  turnId?: string | null;
  requestId?: string | number | undefined;
  itemId?: string | undefined;
  itemType?: string | null | undefined;
  status?: string | null | undefined;
  summary?: string | undefined;
}): string {
  return digest([
    input.method,
    input.threadId,
    input.turnId ?? "",
    String(input.requestId ?? ""),
    input.itemId ?? "",
    input.itemType ?? "",
    input.status ?? "",
    input.summary ?? "",
  ]);
}

function digest(parts: readonly string[]): string {
  const hash = createHash("sha256");
  for (const part of parts) {
    hash.update(String(Buffer.byteLength(part)));
    hash.update(":");
    hash.update(part);
    hash.update("|");
  }
  return hash.digest("hex");
}

function boundedCount() {
  return z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
}

function approvalRequest<
  Method extends
    | "item/commandExecution/requestApproval"
    | "item/fileChange/requestApproval"
    | "item/permissions/requestApproval",
>(method: Method) {
  return z
    .object({
      id: RequestId,
      method: z.literal(method),
      params: ThreadTurnParams.extend({ itemId: BoundedId }).passthrough(),
    })
    .passthrough();
}

function questionRequest(method: "item/tool/requestUserInput") {
  return z
    .object({
      id: RequestId,
      method: z.literal(method),
      params: ThreadTurnParams.extend({ itemId: BoundedId }).passthrough(),
    })
    .passthrough();
}

function approvalItemType(
  method:
    | "item/commandExecution/requestApproval"
    | "item/fileChange/requestApproval"
    | "item/permissions/requestApproval",
): string {
  switch (method) {
    case "item/commandExecution/requestApproval":
      return "commandExecution";
    case "item/fileChange/requestApproval":
      return "fileChange";
    case "item/permissions/requestApproval":
      return "permissions";
  }
}

function isServerEventCandidate(
  input: unknown,
): input is { method: unknown; params: unknown } {
  return (
    typeof input === "object" &&
    input !== null &&
    "method" in input &&
    "params" in input
  );
}
