import type { DiagnosticsSnapshot } from "@pacium/contracts";

export interface DiagnosticsViewState {
  phase: "idle" | "loading" | "ready" | "error";
  snapshot: DiagnosticsSnapshot | null;
  error: string | null;
  requestGeneration: number;
  snapshotRevision: number;
  previewedRevision: number | null;
}

export function initialDiagnosticsState(): DiagnosticsViewState {
  return {
    phase: "idle",
    snapshot: null,
    error: null,
    requestGeneration: 0,
    snapshotRevision: 0,
    previewedRevision: null,
  };
}

export function beginDiagnosticsRequest(
  state: DiagnosticsViewState,
): DiagnosticsViewState {
  return {
    ...state,
    phase: "loading",
    error: null,
    requestGeneration: state.requestGeneration + 1,
  };
}

export function acceptDiagnosticsSnapshot(
  state: DiagnosticsViewState,
  requestGeneration: number,
  snapshot: DiagnosticsSnapshot,
): DiagnosticsViewState {
  if (requestGeneration !== state.requestGeneration) {
    return state;
  }
  return {
    ...state,
    phase: "ready",
    snapshot,
    error: null,
    snapshotRevision: state.snapshotRevision + 1,
    previewedRevision: null,
  };
}

export function rejectDiagnosticsRequest(
  state: DiagnosticsViewState,
  requestGeneration: number,
  message: string,
): DiagnosticsViewState {
  if (requestGeneration !== state.requestGeneration) {
    return state;
  }
  return {
    ...state,
    phase: "error",
    error: message,
  };
}

export function previewDiagnostics(
  state: DiagnosticsViewState,
): DiagnosticsViewState {
  return state.snapshot === null
    ? state
    : { ...state, previewedRevision: state.snapshotRevision };
}

export function canDownloadDiagnostics(state: DiagnosticsViewState): boolean {
  return (
    state.snapshot !== null &&
    state.previewedRevision === state.snapshotRevision
  );
}

export function isDiagnosticsRoute(pathname: string): boolean {
  return pathname === "/diagnostics";
}

export function diagnosticsJson(snapshot: DiagnosticsSnapshot): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

export function diagnosticsFilename(generatedAt: string): string {
  const safeTimestamp = generatedAt
    .replaceAll(":", "-")
    .replaceAll(".", "-")
    .replaceAll(/[^A-Za-z0-9TZ_-]/g, "")
    .replaceAll(/[-_]{2,}/g, "-")
    .replaceAll(/^[-_]+|[-_]+$/g, "");
  return safeTimestamp.length === 0
    ? "pacium-diagnostics.json"
    : `pacium-diagnostics-${safeTimestamp}.json`;
}
