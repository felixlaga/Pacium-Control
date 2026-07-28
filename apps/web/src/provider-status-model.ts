import type {
  ProviderCapabilityId,
  ProviderEvidenceConfidence,
  ProviderObservationSource,
  SessionSummary,
} from "@pacium/contracts";

export type ProviderStatusState =
  "ready" | "unavailable" | "unsupported" | "degraded" | "failed" | "stale";

export interface ProviderStatusCapability {
  id: ProviderCapabilityId;
  label: string;
  availability: "supported" | "unsupported" | "unknown";
  availabilityLabel: string;
  sourceLabel: string;
  confidenceLabel: string;
  detail: string;
}

export interface ProviderStatusDiagnostic {
  code: string;
  severity: "info" | "warning" | "error";
  severityLabel: string;
  message: string;
  observedAt: string;
}

export interface ProviderStatusPresentation {
  provider: "claude" | "codex";
  providerLabel: string;
  state: ProviderStatusState;
  stateLabel: string;
  detail: string;
  recovery: string;
  providerVersion: string;
  adapterVersion: string;
  sourceLabel: string;
  confidenceLabel: string;
  observedAt: string;
  staleAfter: string;
  terminalDetail: string;
  terminalAvailable: boolean;
  capabilities: ProviderStatusCapability[];
  diagnostics: ProviderStatusDiagnostic[];
}

const CAPABILITY_ORDER: readonly ProviderCapabilityId[] = [
  "attention",
  "activity",
  "tools",
  "approvals",
  "questions",
  "plan",
  "usage",
  "completion",
];

export function buildProviderStatus(
  session: SessionSummary,
  now: string,
): ProviderStatusPresentation | null {
  const observation = session.providerObservation;
  if (observation === null) {
    return null;
  }
  const state = providerStatusState(
    observation.health.state,
    observation.staleAfter,
    now,
  );
  return {
    provider: observation.provider,
    providerLabel: observation.provider === "claude" ? "Claude Code" : "Codex",
    state,
    stateLabel: providerStatusStateLabel(state),
    detail: observation.health.detail,
    recovery: providerRecovery(state, observation.providerVersion),
    providerVersion: observation.providerVersion ?? "Unavailable",
    adapterVersion: observation.adapterVersion,
    sourceLabel: providerStatusSourceLabel(observation.health.source, state),
    confidenceLabel: providerStatusConfidenceLabel(
      observation.health.confidence,
    ),
    observedAt: observation.observedAt,
    staleAfter: observation.staleAfter,
    terminalDetail: terminalDetail(session),
    terminalAvailable:
      session.processState === "live" || session.processState === "creating",
    capabilities: observation.capabilities
      .map((capability) => ({
        id: capability.id,
        label: capabilityLabel(capability.id),
        availability: capability.availability,
        availabilityLabel: availabilityLabel(capability.availability),
        sourceLabel: providerStatusSourceLabel(
          capability.source,
          capability.availability === "unsupported" ? "unsupported" : state,
        ),
        confidenceLabel: providerStatusConfidenceLabel(capability.confidence),
        detail: capability.detail,
      }))
      .toSorted(
        (left, right) =>
          CAPABILITY_ORDER.indexOf(left.id) -
          CAPABILITY_ORDER.indexOf(right.id),
      ),
    diagnostics: observation.diagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      severity: diagnostic.severity,
      severityLabel: diagnosticSeverityLabel(diagnostic.severity),
      message: diagnostic.message,
      observedAt: diagnostic.observedAt,
    })),
  };
}

export function providerStatusState(
  health: NonNullable<SessionSummary["providerObservation"]>["health"]["state"],
  staleAfter: string,
  now: string,
): ProviderStatusState {
  if (
    health === "ready" &&
    validTimestamp(staleAfter) &&
    validTimestamp(now) &&
    Date.parse(now) >= Date.parse(staleAfter)
  ) {
    return "stale";
  }
  return health;
}

export function providerStatusStateLabel(state: ProviderStatusState): string {
  switch (state) {
    case "ready":
      return "Ready";
    case "unavailable":
      return "Unavailable";
    case "unsupported":
      return "Unsupported";
    case "degraded":
      return "Degraded";
    case "failed":
      return "Failed";
    case "stale":
      return "Stale";
  }
}

function providerRecovery(
  state: ProviderStatusState,
  providerVersion: string | null,
): string {
  switch (state) {
    case "ready":
      return "Use provider cards for structured evidence. Terminal remains the raw process surface.";
    case "unavailable":
      return providerVersion === null
        ? "Check the installed CLI from Terminal. Pacium will keep process truth separate while compatibility is unknown."
        : "Continue in Terminal or wait for authenticated provider evidence. Pacium will not infer native state.";
    case "unsupported":
      return "Upgrade or change the installed CLI, then create a new provider session. This terminal remains a direct PTY.";
    case "degraded":
      return "Continue in Terminal. A later valid provider event can restore structured evidence automatically.";
    case "failed":
      return "Continue in Terminal if its process is live. Resolve the local provider runtime before creating another session.";
    case "stale":
      return "Wait for fresh authenticated evidence or inspect Terminal. Stale evidence is not current agent state.";
  }
}

function terminalDetail(session: SessionSummary): string {
  switch (session.processState) {
    case "creating":
      return "Direct terminal launch is still pending; observer health does not control it.";
    case "live":
      return "Direct terminal process is live; observer health does not control it.";
    case "exited":
      return "Direct terminal process exited; provider health does not prove task outcome.";
    case "closing":
      return "Direct terminal process is closing independently of provider observer state.";
    case "failed":
      return "Direct terminal process failed independently of provider observer state.";
  }
}

function providerStatusSourceLabel(
  source: ProviderObservationSource,
  state: ProviderStatusState,
): string {
  switch (source) {
    case "native":
      return "Provider native";
    case "hook":
      return "Provider hook";
    case "none":
      return state === "unsupported"
        ? "Local capability probe"
        : "No provider event";
  }
}

function providerStatusConfidenceLabel(
  confidence: ProviderEvidenceConfidence,
): string {
  switch (confidence) {
    case "confirmed":
      return "Confirmed";
    case "high":
      return "High confidence";
    case "medium":
      return "Medium confidence";
    case "low":
      return "Low confidence";
  }
}

function capabilityLabel(id: ProviderCapabilityId): string {
  switch (id) {
    case "attention":
      return "Attention";
    case "activity":
      return "Activity";
    case "tools":
      return "Tools";
    case "approvals":
      return "Approvals";
    case "questions":
      return "Questions";
    case "plan":
      return "Plan";
    case "usage":
      return "Usage";
    case "completion":
      return "Completion";
  }
}

function availabilityLabel(
  availability: ProviderStatusCapability["availability"],
): string {
  switch (availability) {
    case "supported":
      return "Supported";
    case "unsupported":
      return "Unsupported";
    case "unknown":
      return "Unknown";
  }
}

function diagnosticSeverityLabel(
  severity: ProviderStatusDiagnostic["severity"],
): string {
  switch (severity) {
    case "info":
      return "Info";
    case "warning":
      return "Warning";
    case "error":
      return "Error";
  }
}

function validTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}
