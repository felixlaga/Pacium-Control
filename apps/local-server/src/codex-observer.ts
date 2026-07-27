import { execFileSync } from "node:child_process";
import { randomBytes, timingSafeEqual } from "node:crypto";

import {
  MAX_PROVIDER_ACTIVITIES,
  MAX_PROVIDER_DIAGNOSTICS,
  ProviderObservationSnapshotSchema,
  type ProviderCapability,
  type ProviderCapabilityId,
  type ProviderDiagnostic,
  type ProviderObservationSnapshot,
} from "@pacium/contracts";

import {
  normalizeCodexServerMessage,
  type CodexNormalizeResult,
} from "./codex-event-normalizer.js";

export const CODEX_OBSERVER_TOKEN_ENV = "PACIUM_CODEX_RUNTIME_TOKEN";
export const CODEX_OBSERVER_ADAPTER_VERSION = "1";
export const CODEX_OBSERVER_FINGERPRINT_LIMIT = 128;

const CAPABILITIES: readonly ProviderCapabilityId[] = [
  "attention",
  "activity",
  "tools",
  "approvals",
  "questions",
  "plan",
  "usage",
  "completion",
];

export type CodexRuntimeCapability =
  | { available: true; version: string }
  | {
      available: false;
      version: string | null;
      reason:
        "version_unavailable" | "remote_unavailable" | "app_server_unavailable";
    };

export interface PreparedCodexObservation {
  enabled: boolean;
  args: readonly string[];
  environment: Readonly<Record<string, string>>;
  observation: ProviderObservationSnapshot;
}

export interface ClaimedCodexBridge {
  executable: string;
  environment: Readonly<Record<string, string>>;
}

export type CodexObserverIngestResult =
  | { status: "accepted"; observation: ProviderObservationSnapshot }
  | { status: "duplicate"; observation: ProviderObservationSnapshot }
  | { status: "ignored" }
  | { status: "rejected"; code: "unknown_session" | "invalid_event" };

interface ObservedCodexSession {
  token: string;
  observation: ProviderObservationSnapshot;
  fingerprints: string[];
  fingerprintSet: Set<string>;
  bridgeClaimed: boolean;
}

export interface CodexObserverOptions {
  baseUrl: string;
  executable: string;
  environment: Readonly<Record<string, string>>;
  capability: CodexRuntimeCapability;
  now?: () => string;
  tokenFactory?: () => string;
}

export type CodexProbeRunner = (
  executable: string,
  args: readonly string[],
  environment: Readonly<Record<string, string>>,
) => string;

export class CodexObserver {
  private readonly sessions = new Map<string, ObservedCodexSession>();
  private readonly listeners = new Set<
    (sessionId: string, observation: ProviderObservationSnapshot) => void
  >();
  private readonly now: () => string;
  private readonly tokenFactory: () => string;
  private readonly remoteOrigin: string;

  public constructor(private readonly options: CodexObserverOptions) {
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
        "Codex observer base URL must be one canonical loopback HTTP origin.",
      );
    }
    parsed.protocol = "ws:";
    this.remoteOrigin = parsed.origin;
  }

  public prepare(
    sessionId: string,
    observedAt: string,
  ): PreparedCodexObservation {
    const observation = unavailableObservation(
      observedAt,
      this.options.capability,
    );
    if (!this.options.capability.available) {
      return {
        enabled: false,
        args: [],
        environment: {},
        observation,
      };
    }
    const token = this.tokenFactory();
    if (
      token.length < 32 ||
      token.length > 256 ||
      !/^[A-Za-z0-9_-]+$/.test(token)
    ) {
      throw new Error("Codex observer token factory returned an unsafe token.");
    }
    this.sessions.set(sessionId, {
      token,
      observation,
      fingerprints: [],
      fingerprintSet: new Set(),
      bridgeClaimed: false,
    });
    return {
      enabled: true,
      args: [
        "--remote",
        `${this.remoteOrigin}/api/provider/codex/${sessionId}/runtime`,
        "--remote-auth-token-env",
        CODEX_OBSERVER_TOKEN_ENV,
      ],
      environment: { [CODEX_OBSERVER_TOKEN_ENV]: token },
      observation,
    };
  }

  public release(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  public hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  public claimBridge(
    sessionId: string,
    token: string,
  ): ClaimedCodexBridge | null {
    const session = this.authorizedSession(sessionId, token);
    if (session === null || session.bridgeClaimed) {
      return null;
    }
    session.bridgeClaimed = true;
    return {
      executable: this.options.executable,
      environment: this.options.environment,
    };
  }

  public releaseBridge(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session !== undefined) {
      session.bridgeClaimed = false;
    }
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

  public ingestServerMessage(
    sessionId: string,
    input: unknown,
  ): CodexObserverIngestResult {
    const session = this.sessions.get(sessionId);
    if (session === undefined) {
      return { status: "rejected", code: "unknown_session" };
    }
    const normalized = normalizeCodexServerMessage(input, this.now());
    if (normalized.status === "ignored") {
      return { status: "ignored" };
    }
    if (normalized.status === "invalid") {
      session.observation = degradedObservation(
        session.observation,
        this.now(),
        "codex.invalid_event",
        "A known Codex event did not match the supported bounded contract.",
      );
      this.emit(sessionId, session.observation);
      return { status: "rejected", code: "invalid_event" };
    }
    if (!rememberFingerprint(session, normalized.event.fingerprint)) {
      return { status: "duplicate", observation: session.observation };
    }
    session.observation = applyEvent(session.observation, normalized);
    this.emit(sessionId, session.observation);
    return { status: "accepted", observation: session.observation };
  }

  public markTransportFailure(sessionId: string, code: string): void {
    const session = this.sessions.get(sessionId);
    if (session === undefined) {
      return;
    }
    session.observation = degradedObservation(
      session.observation,
      this.now(),
      code,
      "The private Codex runtime transport failed.",
    );
    this.emit(sessionId, session.observation);
  }

  private authorizedSession(
    sessionId: string,
    token: string,
  ): ObservedCodexSession | null {
    const session = this.sessions.get(sessionId);
    if (session === undefined) {
      return null;
    }
    const expected = Buffer.from(session.token);
    const actual = Buffer.from(token);
    return expected.length === actual.length &&
      timingSafeEqual(expected, actual)
      ? session
      : null;
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

export function detectCodexRuntime(
  executable: string,
  environment: Readonly<Record<string, string>>,
  runner: CodexProbeRunner = runCodexProbe,
): CodexRuntimeCapability {
  let versionOutput: string;
  try {
    versionOutput = runner(executable, ["--version"], environment);
  } catch {
    return { available: false, version: null, reason: "version_unavailable" };
  }
  const version = parseCodexVersion(versionOutput);
  if (version === null) {
    return { available: false, version: null, reason: "version_unavailable" };
  }
  try {
    const help = runner(executable, ["--help"], environment);
    if (
      !hasExactOption(help, "--remote") ||
      !hasExactOption(help, "--remote-auth-token-env")
    ) {
      return { available: false, version, reason: "remote_unavailable" };
    }
  } catch {
    return { available: false, version, reason: "remote_unavailable" };
  }
  try {
    const appServerHelp = runner(
      executable,
      ["app-server", "--help"],
      environment,
    );
    if (!hasExactOption(appServerHelp, "--listen")) {
      return { available: false, version, reason: "app_server_unavailable" };
    }
  } catch {
    return { available: false, version, reason: "app_server_unavailable" };
  }
  return { available: true, version };
}

export function parseCodexVersion(output: string): string | null {
  const match = /^\s*codex-cli\s+(\d+\.\d+\.\d+)\s*$/.exec(output);
  return match?.[1] ?? null;
}

function runCodexProbe(
  executable: string,
  args: readonly string[],
  environment: Readonly<Record<string, string>>,
): string {
  return execFileSync(executable, [...args], {
    encoding: "utf8",
    env: { ...environment },
    timeout: 1_000,
    maxBuffer: 32 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  });
}

function hasExactOption(output: string, option: string): boolean {
  return new RegExp(`(^|\\s)${escapeRegex(option)}(?:\\s|$)`, "m").test(output);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function unavailableObservation(
  observedAt: string,
  capability: CodexRuntimeCapability,
): ProviderObservationSnapshot {
  const detail = capability.available
    ? "Codex native transport is prepared but no authenticated event has arrived."
    : capability.reason === "version_unavailable"
      ? "Codex version detection is unavailable; native observation is disabled."
      : capability.reason === "remote_unavailable"
        ? "This Codex CLI does not expose the required remote TUI options."
        : "This Codex CLI does not expose the required App Server listener.";
  return ProviderObservationSnapshotSchema.parse({
    contractVersion: 1,
    provider: "codex",
    adapterVersion: CODEX_OBSERVER_ADAPTER_VERSION,
    providerVersion: capability.version,
    health: {
      state: "unavailable",
      source: "none",
      confidence: "low",
      detail,
    },
    capabilities: CAPABILITIES.map(unknownCapability),
    attention: null,
    activities: [],
    diagnostics: [],
    observedAt,
    staleAfter: addMinutes(observedAt, 5),
  });
}

function applyEvent(
  previous: ProviderObservationSnapshot,
  normalized: Extract<CodexNormalizeResult, { status: "accepted" }>,
): ProviderObservationSnapshot {
  const event = normalized.event;
  const observedAt = event.activity?.observedAt ?? event.attention?.observedAt;
  if (observedAt === undefined) {
    throw new Error("A normalized Codex event requires an observation time.");
  }
  return ProviderObservationSnapshotSchema.parse({
    ...previous,
    providerVersion: event.providerVersion ?? previous.providerVersion,
    health: {
      state: "ready",
      source: "native",
      confidence: "confirmed",
      detail: "Authenticated Codex App Server events are arriving.",
    },
    capabilities: mergeCapabilities(previous.capabilities, event.capabilities),
    attention: event.preserveAttention ? previous.attention : event.attention,
    activities:
      event.activity === null
        ? previous.activities
        : [event.activity, ...previous.activities].slice(
            0,
            MAX_PROVIDER_ACTIVITIES,
          ),
    diagnostics: previous.diagnostics.filter(
      ({ code }) => code !== "codex.invalid_event",
    ),
    observedAt,
    staleAfter: addMinutes(observedAt, 5),
  });
}

function degradedObservation(
  previous: ProviderObservationSnapshot,
  observedAt: string,
  code: string,
  message: string,
): ProviderObservationSnapshot {
  const diagnostic: ProviderDiagnostic = {
    code: code.slice(0, 120),
    severity: "warning",
    message,
    observedAt,
    fields: [],
  };
  return ProviderObservationSnapshotSchema.parse({
    ...previous,
    health: {
      state: "degraded",
      source: "native",
      confidence: "confirmed",
      detail: message,
    },
    diagnostics: [
      diagnostic,
      ...previous.diagnostics.filter(
        (candidate) => candidate.code !== diagnostic.code,
      ),
    ].slice(0, MAX_PROVIDER_DIAGNOSTICS),
    observedAt,
    staleAfter: addMinutes(observedAt, 5),
  });
}

function mergeCapabilities(
  existing: readonly ProviderCapability[],
  supported: readonly ProviderCapabilityId[],
): ProviderCapability[] {
  const supportedSet = new Set(supported);
  return existing.map((capability) =>
    supportedSet.has(capability.id)
      ? {
          id: capability.id,
          availability: "supported",
          source: "native",
          confidence: "confirmed",
          detail: "Authenticated Codex evidence supports this capability.",
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
    detail: "No authenticated Codex evidence supports this capability yet.",
  };
}

function rememberFingerprint(
  session: ObservedCodexSession,
  fingerprint: string,
): boolean {
  if (session.fingerprintSet.has(fingerprint)) {
    return false;
  }
  session.fingerprints.push(fingerprint);
  session.fingerprintSet.add(fingerprint);
  if (session.fingerprints.length > CODEX_OBSERVER_FINGERPRINT_LIMIT) {
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
