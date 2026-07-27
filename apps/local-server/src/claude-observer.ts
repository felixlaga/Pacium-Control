import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { execFileSync } from "node:child_process";

import {
  MAX_PROVIDER_ACTIVITIES,
  ProviderObservationSnapshotSchema,
  type ProviderActivity,
  type ProviderCapability,
  type ProviderCapabilityId,
  type ProviderObservationSnapshot,
} from "@pacium/contracts";
import { z } from "zod";

const CLAUDE_HOOK_EVENTS = [
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
] as const;

const ClaudeHookInputSchema = z
  .object({
    session_id: z.string().min(1).max(200),
    prompt_id: z.string().min(1).max(200).optional(),
    hook_event_name: z.enum(CLAUDE_HOOK_EVENTS),
    tool_name: z.string().min(1).max(120).optional(),
    tool_use_id: z.string().min(1).max(200).optional(),
    notification_type: z.string().min(1).max(80).optional(),
  })
  .passthrough();

const ClaudeStatusInputSchema = z
  .object({
    session_id: z.string().min(1).max(200),
    version: z.string().min(1).max(80),
    model: z
      .object({
        id: z.string().min(1).max(120),
      })
      .passthrough(),
    cost: z
      .object({
        total_cost_usd: z.number().finite().nonnegative().max(1_000_000),
      })
      .passthrough(),
    context_window: z
      .object({
        total_input_tokens: z
          .number()
          .int()
          .nonnegative()
          .max(Number.MAX_SAFE_INTEGER),
        total_output_tokens: z
          .number()
          .int()
          .nonnegative()
          .max(Number.MAX_SAFE_INTEGER),
        used_percentage: z.number().min(0).max(100).nullable(),
      })
      .passthrough(),
  })
  .passthrough();

export const CLAUDE_OBSERVER_TOKEN_ENV = "PACIUM_CLAUDE_HOOK_TOKEN";
export const CLAUDE_OBSERVER_ADAPTER_VERSION = "1";
export const CLAUDE_OBSERVER_FINGERPRINT_LIMIT = 128;

export interface PreparedClaudeObservation {
  args: readonly string[];
  environment: Readonly<Record<string, string>>;
  observation: ProviderObservationSnapshot;
}

export type ClaudeIngestResult =
  | { status: "accepted"; observation: ProviderObservationSnapshot }
  | { status: "duplicate"; observation: ProviderObservationSnapshot }
  | {
      status: "rejected";
      code:
        | "unknown_session"
        | "invalid_token"
        | "invalid_payload"
        | "provider_session_mismatch"
        | "unsupported_event";
    };

interface ObservedClaudeSession {
  token: string;
  providerSessionId: string | null;
  observation: ProviderObservationSnapshot;
  fingerprints: string[];
  fingerprintSet: Set<string>;
}

export interface ClaudeObserverOptions {
  baseUrl: string;
  providerVersion: string | null;
  now?: () => string;
  tokenFactory?: () => string;
}

export class ClaudeObserver {
  private readonly sessions = new Map<string, ObservedClaudeSession>();
  private readonly listeners = new Set<
    (sessionId: string, observation: ProviderObservationSnapshot) => void
  >();
  private readonly now: () => string;
  private readonly tokenFactory: () => string;
  private readonly baseOrigin: string;

  public constructor(private readonly options: ClaudeObserverOptions) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.tokenFactory =
      options.tokenFactory ?? (() => randomBytes(32).toString("base64url"));
    const parsed = new URL(options.baseUrl);
    if (
      parsed.protocol !== "http:" ||
      parsed.hostname !== "127.0.0.1" ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      parsed.pathname !== "/" ||
      parsed.search !== "" ||
      parsed.hash !== ""
    ) {
      throw new Error(
        "Claude observer base URL must be one canonical loopback HTTP origin.",
      );
    }
    this.baseOrigin = parsed.origin;
  }

  public prepare(
    sessionId: string,
    observedAt: string,
  ): PreparedClaudeObservation {
    const token = this.tokenFactory();
    if (token.length < 32 || token.length > 256) {
      throw new Error("Claude observer token factory returned an unsafe token.");
    }
    const observation = unavailableObservation(
      observedAt,
      this.options.providerVersion,
    );
    this.sessions.set(sessionId, {
      token,
      providerSessionId: null,
      observation,
      fingerprints: [],
      fingerprintSet: new Set(),
    });
    return {
      args: ["--settings", JSON.stringify(this.hookSettings(sessionId))],
      environment: { [CLAUDE_OBSERVER_TOKEN_ENV]: token },
      observation,
    };
  }

  public release(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  public hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  public onUpdate(
    listener: (
      sessionId: string,
      observation: ProviderObservationSnapshot,
    ) => void,
  ): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public ingestHook(
    sessionId: string,
    token: string,
    payload: unknown,
  ): ClaudeIngestResult {
    const session = this.authorizedSession(sessionId, token);
    if ("code" in session) {
      return { status: "rejected", code: session.code };
    }
    const parsed = ClaudeHookInputSchema.safeParse(payload);
    if (!parsed.success) {
      return { status: "rejected", code: "invalid_payload" };
    }
    if (!this.acceptProviderSession(session, parsed.data.session_id)) {
      return { status: "rejected", code: "provider_session_mismatch" };
    }
    const normalized = normalizeHook(parsed.data, this.now());
    if (normalized === null) {
      return { status: "rejected", code: "unsupported_event" };
    }
    const fingerprint = hookFingerprint(parsed.data);
    if (!rememberFingerprint(session, fingerprint)) {
      return { status: "duplicate", observation: session.observation };
    }
    session.observation = applyHookObservation(
      session.observation,
      normalized,
      this.options.providerVersion,
    );
    this.emit(sessionId, session.observation);
    return { status: "accepted", observation: session.observation };
  }

  public ingestStatus(
    sessionId: string,
    token: string,
    payload: unknown,
  ): ClaudeIngestResult {
    const session = this.authorizedSession(sessionId, token);
    if ("code" in session) {
      return { status: "rejected", code: session.code };
    }
    const parsed = ClaudeStatusInputSchema.safeParse(payload);
    if (!parsed.success) {
      return { status: "rejected", code: "invalid_payload" };
    }
    if (!this.acceptProviderSession(session, parsed.data.session_id)) {
      return { status: "rejected", code: "provider_session_mismatch" };
    }
    const fingerprint = statusFingerprint(parsed.data);
    if (!rememberFingerprint(session, fingerprint)) {
      return { status: "duplicate", observation: session.observation };
    }
    session.observation = applyStatusObservation(
      session.observation,
      parsed.data,
      this.now(),
    );
    this.emit(sessionId, session.observation);
    return { status: "accepted", observation: session.observation };
  }

  private hookSettings(sessionId: string): object {
    const url = `${this.baseOrigin}/api/provider/claude/${sessionId}/hook`;
    const handler = {
      type: "http",
      url,
      timeout: 1,
      headers: {
        Authorization: `Bearer $${CLAUDE_OBSERVER_TOKEN_ENV}`,
      },
      allowedEnvVars: [CLAUDE_OBSERVER_TOKEN_ENV],
    };
    return {
      hooks: Object.fromEntries(
        CLAUDE_HOOK_EVENTS.map((event) => [
          event,
          [{ hooks: [{ ...handler }] }],
        ]),
      ),
    };
  }

  private authorizedSession(
    sessionId: string,
    token: string,
  ):
    | ObservedClaudeSession
    | { code: "unknown_session" | "invalid_token" } {
    const session = this.sessions.get(sessionId);
    if (session === undefined) {
      return { code: "unknown_session" };
    }
    const expected = Buffer.from(session.token);
    const actual = Buffer.from(token);
    if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      return { code: "invalid_token" };
    }
    return session;
  }

  private acceptProviderSession(
    session: ObservedClaudeSession,
    providerSessionId: string,
  ): boolean {
    if (session.providerSessionId === null) {
      session.providerSessionId = providerSessionId;
      return true;
    }
    return session.providerSessionId === providerSessionId;
  }

  private emit(
    sessionId: string,
    observation: ProviderObservationSnapshot,
  ): void {
    const validated = ProviderObservationSnapshotSchema.parse(observation);
    for (const listener of this.listeners) {
      listener(sessionId, validated);
    }
  }
}

export function detectClaudeVersion(
  executable: string,
  environment: Readonly<Record<string, string>>,
): string | null {
  try {
    const output = execFileSync(executable, ["--version"], {
      encoding: "utf8",
      env: { ...environment },
      timeout: 1_000,
      maxBuffer: 8 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return parseClaudeVersion(output);
  } catch {
    return null;
  }
}

export function parseClaudeVersion(output: string): string | null {
  const match = /^\s*(\d+\.\d+\.\d+)(?:\s+\(Claude Code\))?\s*$/.exec(output);
  return match?.[1] ?? null;
}

function unavailableObservation(
  observedAt: string,
  providerVersion: string | null,
): ProviderObservationSnapshot {
  const capabilities: ProviderCapabilityId[] = [
    "attention",
    "activity",
    "tools",
    "approvals",
    "questions",
    "plan",
    "usage",
    "completion",
  ];
  return {
    contractVersion: 1,
    provider: "claude",
    adapterVersion: CLAUDE_OBSERVER_ADAPTER_VERSION,
    providerVersion,
    health: {
      state: "unavailable",
      source: "none",
      confidence: "low",
      detail:
        "Claude hooks are prepared but no authenticated event has arrived.",
    },
    capabilities: capabilities.map((id) => unknownCapability(id)),
    attention: null,
    activities: [],
    diagnostics: [],
    observedAt,
    staleAfter: addMinutes(observedAt, 5),
  };
}

function normalizeHook(
  hook: z.infer<typeof ClaudeHookInputSchema>,
  observedAt: string,
): {
  activity: ProviderActivity;
  attention: ProviderObservationSnapshot["attention"];
  capabilities: ProviderCapabilityId[];
} | null {
  const common = {
    id: `claude:${hookFingerprint(hook).slice(0, 32)}`,
    source: "hook" as const,
    confidence: "high" as const,
    occurredAt: observedAt,
    observedAt,
  };
  const extension = (
    eventType: ProviderActivity["extension"] extends infer Extension
      ? Extension extends { provider: "claude"; eventType: infer Event }
        ? Event
        : never
      : never,
  ) => ({
    provider: "claude" as const,
    eventType,
    providerSessionId: hook.session_id,
    toolName: hook.tool_name ?? null,
    modelId: null,
    contextUsedPercent: null,
    totalCostUsd: null,
    totalInputTokens: null,
    totalOutputTokens: null,
  });

  switch (hook.hook_event_name) {
    case "SessionStart":
      return normalized(
        {
          ...common,
          kind: "session_started",
          summary: "Claude session started or resumed.",
          extension: extension("session_start"),
        },
        attention("waiting", observedAt, "Claude is ready for input."),
        ["activity", "attention"],
      );
    case "UserPromptSubmit":
      return normalized(
        {
          ...common,
          kind: "prompt_submitted",
          summary: "Claude accepted a user prompt for processing.",
          extension: extension("prompt_submit"),
        },
        attention("working", observedAt, "Claude is processing a prompt."),
        ["activity", "attention"],
      );
    case "PreToolUse":
      return normalized(
        {
          ...common,
          kind: "tool_started",
          summary: `Claude started ${hook.tool_name ?? "a tool"}.`,
          extension: extension("tool_start"),
        },
        attention("working", observedAt, "Claude reported a tool start."),
        ["activity", "attention", "tools"],
      );
    case "PermissionRequest":
      return normalized(
        {
          ...common,
          kind: "approval_requested",
          summary: `Claude requested approval for ${hook.tool_name ?? "a tool"}.`,
          extension: extension("permission_request"),
        },
        attention(
          "needs_input",
          observedAt,
          "Claude requested an approval.",
        ),
        ["activity", "attention", "approvals"],
      );
    case "PostToolUse":
      return normalized(
        {
          ...common,
          kind: "tool_completed",
          summary: `Claude completed ${hook.tool_name ?? "a tool"}.`,
          extension: extension("tool_complete"),
        },
        attention("working", observedAt, "Claude completed a tool call."),
        ["activity", "attention", "tools"],
      );
    case "PostToolUseFailure":
      return normalized(
        {
          ...common,
          kind: "failed",
          summary: `Claude reported a failure from ${hook.tool_name ?? "a tool"}.`,
          extension: extension("failure"),
        },
        attention(
          "working",
          observedAt,
          "A Claude tool failed; turn outcome is still pending.",
        ),
        ["activity", "attention", "tools"],
      );
    case "Stop":
      return normalized(
        {
          ...common,
          kind: "turn_completed",
          summary: "Claude completed the current response.",
          extension: extension("completion"),
        },
        attention("waiting", observedAt, "Claude is waiting after a response."),
        ["activity", "attention", "completion"],
      );
    case "StopFailure":
      return normalized(
        {
          ...common,
          kind: "failed",
          summary: "Claude reported a turn failure.",
          extension: extension("failure"),
        },
        attention("failed", observedAt, "Claude reported a turn failure."),
        ["activity", "attention", "completion"],
      );
    case "SessionEnd":
      return normalized(
        {
          ...common,
          kind: "session_completed",
          summary: "Claude session ended.",
          extension: extension("completion"),
        },
        attention("finished", observedAt, "Claude reported the session ended."),
        ["activity", "attention", "completion"],
      );
    case "Notification":
      if (hook.notification_type === "permission_prompt") {
        return normalized(
          {
            ...common,
            kind: "approval_requested",
            summary: "Claude displayed a permission prompt.",
            extension: extension("permission_request"),
          },
          attention(
            "needs_input",
            observedAt,
            "Claude displayed a permission prompt.",
          ),
          ["activity", "attention", "approvals"],
        );
      }
      if (
        hook.notification_type === "idle_prompt" ||
        hook.notification_type === "agent_needs_input" ||
        hook.notification_type === "elicitation_dialog"
      ) {
        return normalized(
          {
            ...common,
            kind: "question_requested",
            summary: "Claude requested user input.",
            extension: extension("question_request"),
          },
          attention("needs_input", observedAt, "Claude requested user input."),
          ["activity", "attention", "questions"],
        );
      }
      return null;
  }
}

function normalized(
  activity: ProviderActivity,
  providerAttention: ProviderObservationSnapshot["attention"],
  capabilities: ProviderCapabilityId[],
) {
  return { activity, attention: providerAttention, capabilities };
}

function attention(
  state: NonNullable<ProviderObservationSnapshot["attention"]>["state"],
  observedAt: string,
  reason: string,
): NonNullable<ProviderObservationSnapshot["attention"]> {
  return {
    state,
    source: "hook",
    confidence: "high",
    observedAt,
    staleAfter:
      state === "finished" || state === "failed"
        ? addHours(observedAt, 24)
        : addMinutes(observedAt, state === "needs_input" ? 30 : 5),
    reason,
  };
}

function applyHookObservation(
  previous: ProviderObservationSnapshot,
  normalizedHook: NonNullable<ReturnType<typeof normalizeHook>>,
  providerVersion: string | null,
): ProviderObservationSnapshot {
  const observedAt = normalizedHook.activity.observedAt;
  return ProviderObservationSnapshotSchema.parse({
    ...previous,
    providerVersion: previous.providerVersion ?? providerVersion,
    health: {
      state: "ready",
      source: "hook",
      confidence: "high",
      detail: "Authenticated Claude lifecycle hooks are arriving.",
    },
    capabilities: mergeCapabilities(
      previous.capabilities,
      normalizedHook.capabilities,
      observedAt,
    ),
    attention: normalizedHook.attention,
    activities: [
      normalizedHook.activity,
      ...previous.activities,
    ].slice(0, MAX_PROVIDER_ACTIVITIES),
    observedAt,
    staleAfter: addMinutes(observedAt, 5),
    diagnostics: previous.diagnostics.filter(
      ({ code }) => code !== "claude.provider_session",
    ),
  });
}

function applyStatusObservation(
  previous: ProviderObservationSnapshot,
  status: z.infer<typeof ClaudeStatusInputSchema>,
  observedAt: string,
): ProviderObservationSnapshot {
  const activity: ProviderActivity = {
    id: `claude:${statusFingerprint(status).slice(0, 32)}`,
    kind: "usage_updated",
    source: "hook",
    confidence: "high",
    occurredAt: observedAt,
    observedAt,
    summary: "Claude status and usage snapshot updated.",
    extension: {
      provider: "claude",
      eventType: "status",
      providerSessionId: status.session_id,
      toolName: null,
      modelId: status.model.id,
      contextUsedPercent: status.context_window.used_percentage,
      totalCostUsd: status.cost.total_cost_usd,
      totalInputTokens: status.context_window.total_input_tokens,
      totalOutputTokens: status.context_window.total_output_tokens,
    },
  };
  return ProviderObservationSnapshotSchema.parse({
    ...previous,
    providerVersion: status.version,
    health: {
      state: "ready",
      source: "hook",
      confidence: "high",
      detail: "Authenticated Claude observations are arriving.",
    },
    capabilities: mergeCapabilities(
      previous.capabilities,
      ["activity", "usage"],
      observedAt,
    ),
    activities: [activity, ...previous.activities].slice(
      0,
      MAX_PROVIDER_ACTIVITIES,
    ),
    observedAt,
    staleAfter: addMinutes(observedAt, 5),
  });
}

function mergeCapabilities(
  existing: readonly ProviderCapability[],
  supported: readonly ProviderCapabilityId[],
  _observedAt: string,
): ProviderCapability[] {
  const supportedSet = new Set(supported);
  return existing.map((capability) =>
    supportedSet.has(capability.id)
      ? {
          id: capability.id,
          availability: "supported",
          source: "hook",
          confidence: "high",
          detail: "Authenticated Claude evidence supports this capability.",
        }
      : capability,
  );
}

function unknownCapability(id: ProviderCapabilityId): ProviderCapability {
  return {
    id,
    availability: "unknown",
    source: "none",
    confidence: "low",
    detail: "No authenticated Claude evidence supports this capability yet.",
  };
}

function hookFingerprint(
  hook: z.infer<typeof ClaudeHookInputSchema>,
): string {
  return digest([
    hook.session_id,
    hook.prompt_id ?? "",
    hook.hook_event_name,
    hook.tool_use_id ?? "",
    hook.notification_type ?? "",
  ]);
}

function statusFingerprint(
  status: z.infer<typeof ClaudeStatusInputSchema>,
): string {
  return digest([
    status.session_id,
    status.version,
    status.model.id,
    String(status.context_window.total_input_tokens),
    String(status.context_window.total_output_tokens),
    String(status.context_window.used_percentage),
    String(status.cost.total_cost_usd),
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

function rememberFingerprint(
  session: ObservedClaudeSession,
  fingerprint: string,
): boolean {
  if (session.fingerprintSet.has(fingerprint)) {
    return false;
  }
  session.fingerprints.push(fingerprint);
  session.fingerprintSet.add(fingerprint);
  if (session.fingerprints.length > CLAUDE_OBSERVER_FINGERPRINT_LIMIT) {
    const removed = session.fingerprints.shift();
    if (removed !== undefined) {
      session.fingerprintSet.delete(removed);
    }
  }
  return true;
}

function addMinutes(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * 60_000).toISOString();
}

function addHours(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * 3_600_000).toISOString();
}
