import type { ConnectionState } from "./transport.js";
import {
  visiblePaciumConfig,
  type PaciumConfigViewState,
} from "./pacium-config-model.js";

export interface PaciumModeSummary {
  status: "loading" | "unconfigured" | "ready" | "error";
  title: string;
  detail: string;
  freshness: string;
  canRetry: boolean;
  stats: Array<{ label: string; value: string }>;
}

export function buildPaciumModeSummary(
  state: PaciumConfigViewState,
  connection: ConnectionState,
): PaciumModeSummary {
  const observation = visiblePaciumConfig(state);
  const freshness =
    connection === "connected"
      ? state.status === "loading" || state.status === "replacing"
        ? "Refreshing server definition"
        : "Server definition"
      : "Last accepted definition · disconnected";

  if (observation === null) {
    return {
      status: "loading",
      title: "Loading Pacium workspace",
      detail:
        connection === "connected"
          ? "Reading the server-owned definition. Terminals remain available."
          : "Waiting to reconnect. General terminals remain available.",
      freshness,
      canRetry: connection === "connected",
      stats: [],
    };
  }

  if (observation.status === "unconfigured") {
    return {
      status: "unconfigured",
      title: "Pacium setup needed",
      detail:
        "Meta, Orchestrator, and queue sources are not configured yet. Terminals are unchanged.",
      freshness,
      canRetry: connection === "connected",
      stats: [],
    };
  }

  if (observation.status === "error") {
    return {
      status: "error",
      title: "Pacium configuration unavailable",
      detail:
        observation.error?.message ??
        "The server returned incomplete configuration evidence.",
      freshness,
      canRetry: connection === "connected",
      stats: [],
    };
  }

  const workspace = observation.workspace;
  if (workspace === null) {
    return {
      status: "error",
      title: "Pacium configuration unavailable",
      detail: "The server returned incomplete configuration evidence.",
      freshness,
      canRetry: connection === "connected",
      stats: [],
    };
  }
  const roles = [workspace.roles.meta, workspace.roles.orchestrator].filter(
    (binding) => binding !== null,
  ).length;
  return {
    status: "ready",
    title: workspace.label,
    detail:
      "Configured references only. Primary roles resolve below; queue observation and delivery are not active yet.",
    freshness,
    canRetry: connection === "connected",
    stats: [
      { label: "Roles", value: `${roles}/2` },
      {
        label: "Workers",
        value: String(workspace.workers.length),
      },
      {
        label: "Repos",
        value: String(workspace.repositories.length),
      },
      {
        label: "Queues",
        value: String(workspace.queueSources.length),
      },
    ],
  };
}
