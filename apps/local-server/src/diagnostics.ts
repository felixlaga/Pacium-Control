import {
  DIAGNOSTICS_SCHEMA_VERSION,
  DiagnosticsSnapshotSchema,
  MAX_DIAGNOSTIC_CODES,
  MAX_DIAGNOSTICS_SESSIONS,
  PROTOCOL_VERSION,
  type DiagnosticsCode,
  type DiagnosticsComponent,
  type DiagnosticsHealthState,
  type DiagnosticsSnapshot,
  type LaunchPresetCapability,
  type QueueItemType,
  type QueueSourcesObservation,
  type SessionSummary,
  type TmuxCapability,
} from "@pacium/contracts";

export interface DiagnosticsRuntime {
  nodeVersion: string;
  platform: string;
  architecture: string;
}

export interface BuildDiagnosticsInput {
  sessions: readonly SessionSummary[];
  queue: QueueSourcesObservation;
  tmux: TmuxCapability;
  launchPresets: readonly LaunchPresetCapability[];
  generatedAt?: string;
  runtime?: DiagnosticsRuntime;
}

const INCLUDED_CATEGORIES: DiagnosticsSnapshot["redactionManifest"]["included"] =
  [
    "application_versions",
    "runtime_platform",
    "component_health",
    "session_state",
    "provider_health",
    "queue_status",
    "tmux_status",
    "diagnostic_codes",
  ];

const OMITTED_CATEGORIES: DiagnosticsSnapshot["redactionManifest"]["omitted"] =
  [
    "terminal_content",
    "terminal_input",
    "terminal_titles",
    "session_identifiers",
    "process_identifiers",
    "commands_and_arguments",
    "paths_and_repositories",
    "git_content",
    "queue_content_and_decisions",
    "provider_content_and_fields",
    "environment_and_credentials",
    "host_and_operator_identity",
    "relaunch_metadata",
  ];

const DEPENDENCY_VERSIONS = {
  nodePty: "1.1.0-pacium.1",
  xtermHeadless: "6.0.0",
  xtermBrowser: "6.0.0",
  react: "19.2.8",
  ws: "8.21.1",
  zod: "4.4.3",
} as const;

export function buildDiagnosticsSnapshot(
  input: BuildDiagnosticsInput,
): DiagnosticsSnapshot {
  const allSessions = [...input.sessions];
  const sessionCounts = {
    total: allSessions.length,
    creating: countBy(
      allSessions,
      ({ processState }) => processState === "creating",
    ),
    live: countBy(allSessions, ({ processState }) => processState === "live"),
    closing: countBy(
      allSessions,
      ({ processState }) => processState === "closing",
    ),
    exited: countBy(
      allSessions,
      ({ processState }) => processState === "exited",
    ),
    failed: countBy(
      allSessions,
      ({ processState }) => processState === "failed",
    ),
    directPty: countBy(allSessions, ({ runtime }) => runtime === "pty"),
    tmux: countBy(allSessions, ({ runtime }) => runtime === "tmux"),
  };
  const queueItems = emptyQueueItemCounts();
  let queueConflicts = 0;
  for (const source of input.queue.sources) {
    const itemType = source.classification?.candidate?.type;
    if (itemType !== undefined) {
      queueItems[itemType] += 1;
    }
    queueConflicts += source.conflicts.length;
  }
  const tmuxVersion =
    input.tmux.state === "ready"
      ? safeOptionalVersion(input.tmux.version)
      : null;
  const tmuxStatus =
    input.tmux.state === "ready" && tmuxVersion === null
      ? "unavailable"
      : input.tmux.state;

  const components = buildComponents(input);
  const allDiagnostics = buildDiagnosticCodes(input);
  const snapshot: DiagnosticsSnapshot = {
    schemaVersion: DIAGNOSTICS_SCHEMA_VERSION,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    application: {
      paciumVersion: "0.0.0",
      protocolVersion: PROTOCOL_VERSION,
      nodeVersion: safeRequiredVersion(
        input.runtime?.nodeVersion ?? process.versions.node,
      ),
      platform: safeRuntimeLabel(input.runtime?.platform ?? process.platform),
      architecture: safeRuntimeLabel(
        input.runtime?.architecture ?? process.arch,
      ),
      dependencyVersions: DEPENDENCY_VERSIONS,
    },
    overview: {
      state: overallHealth(components),
      sessions: sessionCounts,
      queueStatus: input.queue.status,
      queueSources: input.queue.sources.length,
      queueItems,
      queueConflicts,
      tmuxStatus,
      tmuxVersion,
    },
    components,
    sessions: allSessions
      .slice(0, MAX_DIAGNOSTICS_SESSIONS)
      .map(sanitizeSession),
    sessionsTruncated: allSessions.length > MAX_DIAGNOSTICS_SESSIONS,
    diagnostics: allDiagnostics.slice(0, MAX_DIAGNOSTIC_CODES),
    diagnosticsTruncated: allDiagnostics.length > MAX_DIAGNOSTIC_CODES,
    redactionManifest: {
      included: [...INCLUDED_CATEGORIES],
      omitted: [...OMITTED_CATEGORIES],
    },
  };
  return DiagnosticsSnapshotSchema.parse(snapshot);
}

function sanitizeSession(
  session: SessionSummary,
  index: number,
): DiagnosticsSnapshot["sessions"][number] {
  const exited = session.processState === "exited";
  const observation = session.providerObservation;
  return {
    label: `Terminal ${index + 1}`,
    launchPreset: session.launchPreset,
    runtime: session.runtime,
    tmuxMode:
      session.runtime === "tmux"
        ? (session.tmuxMode ?? session.relaunchManifest?.tmuxMode ?? "attached")
        : null,
    processState: session.processState,
    cols: session.cols,
    rows: session.rows,
    exitCode: exited ? boundedExitValue(session.exitCode, -1) : null,
    exitSignal: exited ? boundedExitValue(session.exitSignal, 0) : null,
    repositoryPresent: session.repository.status === "ready",
    provider:
      observation === null
        ? null
        : {
            id: observation.provider,
            health: observation.health.state,
            adapterVersion: safeRequiredVersion(observation.adapterVersion),
            providerVersion: safeOptionalVersion(observation.providerVersion),
            diagnosticCount: observation.diagnostics.length,
          },
  };
}

function buildComponents(input: BuildDiagnosticsInput): DiagnosticsComponent[] {
  return [
    component(
      "local_server",
      "healthy",
      "The local server constructed this diagnostics snapshot.",
    ),
    component(
      "http_transport",
      "healthy",
      "The protected diagnostics read completed.",
    ),
    ptyComponent(input.sessions),
    component(
      "local_state",
      "healthy",
      "Required local state initialized before the server accepted requests.",
    ),
    providerComponent("claude", input),
    providerComponent("codex", input),
    queueComponent(input.queue),
    tmuxComponent(input.tmux),
  ];
}

function ptyComponent(
  sessions: readonly SessionSummary[],
): DiagnosticsComponent {
  const failedSessions = countBy(
    sessions,
    ({ processState }) => processState === "failed",
  );
  return failedSessions === 0
    ? component(
        "pty_runtime",
        "healthy",
        "The PTY runtime is loaded; session outcomes remain separate.",
      )
    : component(
        "pty_runtime",
        "degraded",
        `${failedSessions} terminal ${failedSessions === 1 ? "session has" : "sessions have"} failed.`,
        "Close the failed terminal and create a new session after checking its launch preset.",
      );
}

function providerComponent(
  provider: "claude" | "codex",
  input: BuildDiagnosticsInput,
): DiagnosticsComponent {
  const preset = input.launchPresets.find(({ id }) => id === provider);
  if (preset?.available !== true) {
    return component(
      `${provider}_observer`,
      "unavailable",
      `${provider === "claude" ? "Claude Code" : "Codex"} is not available as a launch preset.`,
      `Install or configure the CLI to enable ${provider === "claude" ? "Claude" : "Codex"} observation.`,
    );
  }
  const observations = input.sessions
    .filter(({ launchPreset }) => launchPreset === provider)
    .flatMap(({ providerObservation }) =>
      providerObservation === null ? [] : [providerObservation],
    );
  if (observations.length === 0) {
    return component(
      `${provider}_observer`,
      "unknown",
      `No current ${provider === "claude" ? "Claude" : "Codex"} session exposes observer health.`,
      `Launch a ${provider === "claude" ? "Claude" : "Codex"} terminal to inspect observer health.`,
    );
  }
  const degraded = observations.some(({ health }) => health.state !== "ready");
  return degraded
    ? component(
        `${provider}_observer`,
        "degraded",
        `At least one ${provider === "claude" ? "Claude" : "Codex"} observer is not ready.`,
        "Open the affected terminal Activity view for bounded recovery guidance.",
      )
    : component(
        `${provider}_observer`,
        "healthy",
        `All current ${provider === "claude" ? "Claude" : "Codex"} observers report ready.`,
      );
}

function queueComponent(queue: QueueSourcesObservation): DiagnosticsComponent {
  if (queue.status === "unconfigured") {
    return component(
      "queue_observer",
      "unknown",
      "No Pacium queue sources are configured.",
      "Configure queue sources only if Pacium mode needs them.",
    );
  }
  if (
    queue.status === "config_error" ||
    queue.sources.some(({ status }) =>
      [
        "oversized",
        "invalid_utf8",
        "unsafe_type",
        "read_error",
        "watch_error",
      ].includes(status),
    )
  ) {
    return component(
      "queue_observer",
      "degraded",
      "At least one queue source or its configuration is unavailable.",
      "Open Pacium Queue and inspect the fixed source status.",
    );
  }
  return component(
    "queue_observer",
    "healthy",
    `${queue.sources.length} configured queue source${queue.sources.length === 1 ? "" : "s"} observed.`,
  );
}

function tmuxComponent(tmux: TmuxCapability): DiagnosticsComponent {
  switch (tmux.state) {
    case "ready":
      return safeOptionalVersion(tmux.version) === null
        ? component(
            "tmux_adapter",
            "degraded",
            "The optional tmux adapter version is unavailable.",
            "Check the configured local tmux installation.",
          )
        : component(
            "tmux_adapter",
            "healthy",
            "The optional tmux adapter is ready.",
          );
    case "unavailable":
      return component(
        "tmux_adapter",
        "unavailable",
        "The configured optional tmux adapter is unavailable.",
        "Check the configured local socket and tmux installation.",
      );
    case "unconfigured":
      return component(
        "tmux_adapter",
        "unknown",
        "The optional tmux adapter is not configured.",
        "No action is required for direct PTY use.",
      );
  }
}

function buildDiagnosticCodes(input: BuildDiagnosticsInput): DiagnosticsCode[] {
  const counts = new Map<
    string,
    Omit<DiagnosticsCode, "count"> & { count: number }
  >();
  const add = (
    componentId: DiagnosticsCode["component"],
    code: string,
    severity: DiagnosticsCode["severity"],
  ) => {
    const key = `${componentId}\u0000${code}`;
    const existing = counts.get(key);
    if (existing === undefined) {
      counts.set(key, { component: componentId, code, severity, count: 1 });
    } else {
      existing.count += 1;
      if (severityRank(severity) > severityRank(existing.severity)) {
        existing.severity = severity;
      }
    }
  };

  for (const session of input.sessions) {
    if (session.processState === "failed") {
      add("pty_runtime", "PTY_SESSION_FAILED", "error");
    }
    if (
      session.processState === "exited" &&
      session.exitCode !== null &&
      session.exitCode !== 0
    ) {
      add("pty_runtime", "PTY_NONZERO_EXIT", "warning");
    }
    for (const diagnostic of session.providerObservation?.diagnostics ?? []) {
      add(
        `${session.launchPreset}_observer` as
          "claude_observer" | "codex_observer",
        diagnostic.code,
        diagnostic.severity,
      );
    }
  }
  if (input.queue.error !== null) {
    add("queue_observer", input.queue.error.code, "error");
  }
  for (const source of input.queue.sources) {
    if (source.error !== null) {
      add("queue_observer", source.error.code, "error");
    }
    for (const diagnostic of source.classification?.diagnostics ?? []) {
      add("queue_observer", diagnostic.code, "info");
    }
    for (const conflict of source.conflicts) {
      add("queue_observer", `QUEUE_${conflict.kind.toUpperCase()}`, "warning");
    }
  }
  return [...counts.values()].toSorted((left, right) => {
    const componentOrder = left.component.localeCompare(right.component);
    return componentOrder === 0
      ? left.code.localeCompare(right.code)
      : componentOrder;
  });
}

function component(
  id: DiagnosticsComponent["id"],
  state: DiagnosticsHealthState,
  summary: string,
  operatorAction: string | null = null,
): DiagnosticsComponent {
  return { id, state, summary, operatorAction };
}

function overallHealth(
  components: readonly DiagnosticsComponent[],
): DiagnosticsHealthState {
  return components.some(({ state }) => state === "degraded")
    ? "degraded"
    : "healthy";
}

function emptyQueueItemCounts(): Record<QueueItemType, number> {
  return {
    question: 0,
    approval: 0,
    failure: 0,
    review: 0,
    unknown: 0,
  };
}

function countBy<T>(
  values: readonly T[],
  predicate: (value: T) => boolean,
): number {
  return values.filter(predicate).length;
}

function boundedExitValue(value: number | null, minimum: number): number {
  if (
    value === null ||
    !Number.isInteger(value) ||
    value < minimum ||
    value > 255
  ) {
    return minimum;
  }
  return value;
}

function safeRequiredVersion(value: string): string {
  return safeOptionalVersion(value) ?? "unknown";
}

function safeOptionalVersion(value: string | null): string | null {
  if (
    value === null ||
    value.length === 0 ||
    value.length > 80 ||
    !/^[A-Za-z0-9][A-Za-z0-9._+ -]*$/.test(value)
  ) {
    return null;
  }
  return value;
}

function safeRuntimeLabel(value: string): string {
  return /^[A-Za-z0-9_-]{1,32}$/.test(value) ? value : "unknown";
}

function severityRank(value: DiagnosticsCode["severity"]): number {
  return value === "error" ? 2 : value === "warning" ? 1 : 0;
}
