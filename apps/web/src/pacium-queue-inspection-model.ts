import type {
  PaciumConfigObservation,
  PaciumQueueSource,
  QueueDecisionResult,
  QueueDeliveryResult,
  QueueDeliveryState,
  QueueItemConfidence,
  QueueItemDecisionState,
  QueueItemInspection,
  QueueItemInspectionIdentity,
  QueueItemType,
  QueueSourceObservation,
  QueueSourcesObservation,
} from "@pacium/contracts";

export interface QueueItemSelection {
  identity: QueueItemInspectionIdentity;
  sourceLabel: string;
  sourcePath: string;
  requestingRole: PaciumQueueSource["requestingRole"];
  type: QueueItemType;
  confidence: QueueItemConfidence;
  boundary: "whole_source_v1";
  diagnostic: string | null;
  firstObservedAt: string;
  sourceObservedAt: string;
}

export interface PaciumQueueInspectionState {
  selection: QueueItemSelection | null;
  requestId: string | null;
  status: "closed" | "loading" | "ready" | "stale" | "unavailable" | "error";
  originalText: string | null;
  inspection: QueueItemInspectionEvidence | null;
  errorMessage: string | null;
  decisionState: QueueItemDecisionState | null;
  decisionRequestId: string | null;
  decisionStatus: "idle" | "submitting" | "error";
  decisionErrorMessage: string | null;
  deliveryState: QueueDeliveryState | null;
  deliveryRequestId: string | null;
  deliveryStatus: "idle" | "submitting" | "error";
  deliveryErrorMessage: string | null;
}

export interface QueueItemInspectionEvidence extends QueueItemInspectionIdentity {
  status: QueueItemInspection["status"];
  sourceObservedAt: string;
  firstObservedAt: string | null;
  byteLength: number | null;
  error: { code: string; message: string } | null;
}

export const CLOSED_QUEUE_INSPECTION: PaciumQueueInspectionState = {
  selection: null,
  requestId: null,
  status: "closed",
  originalText: null,
  inspection: null,
  errorMessage: null,
  decisionState: null,
  decisionRequestId: null,
  decisionStatus: "idle",
  decisionErrorMessage: null,
  deliveryState: null,
  deliveryRequestId: null,
  deliveryStatus: "idle",
  deliveryErrorMessage: null,
};

export function queueItemSelection(
  source: PaciumQueueSource,
  observation: QueueSourceObservation | null,
  workspaceRevision: number | null,
): QueueItemSelection | null {
  const candidate = observation?.classification?.candidate ?? null;
  if (
    workspaceRevision === null ||
    observation?.status !== "stable" ||
    observation.contentHash === null ||
    observation.candidateFirstObservedAt === null ||
    observation.classification?.status !== "candidate" ||
    candidate === null
  ) {
    return null;
  }
  return {
    identity: {
      workspaceRevision,
      sourceId: source.id,
      observationRevision: observation.observationRevision,
      contentHash: observation.contentHash,
      itemId: candidate.itemId,
    },
    sourceLabel: source.label,
    sourcePath: source.path,
    requestingRole: source.requestingRole,
    type: candidate.type,
    confidence: candidate.confidence,
    boundary: observation.classification.boundary,
    diagnostic:
      observation.classification.diagnostics
        .map(({ message }) => message)
        .join(" ") || null,
    firstObservedAt: observation.candidateFirstObservedAt,
    sourceObservedAt: observation.observedAt,
  };
}

export function beginQueueItemInspection(
  selection: QueueItemSelection,
  requestId: string,
): PaciumQueueInspectionState {
  return {
    selection,
    requestId,
    status: "loading",
    originalText: null,
    inspection: null,
    errorMessage: null,
    decisionState: null,
    decisionRequestId: null,
    decisionStatus: "idle",
    decisionErrorMessage: null,
    deliveryState: null,
    deliveryRequestId: null,
    deliveryStatus: "idle",
    deliveryErrorMessage: null,
  };
}

export function acceptQueueItemInspection(
  state: PaciumQueueInspectionState,
  requestId: string,
  inspection: QueueItemInspection,
  decisionState: QueueItemDecisionState | null,
  deliveryState: QueueDeliveryState | null = null,
): PaciumQueueInspectionState {
  if (
    state.requestId !== requestId ||
    state.selection === null ||
    !sameQueueIdentity(state.selection.identity, inspection)
  ) {
    return state;
  }
  if (inspection.status !== "ready") {
    return {
      ...state,
      requestId: null,
      status: inspection.status,
      originalText: null,
      inspection: inspectionEvidence(inspection),
      errorMessage: inspection.error.message,
      decisionState: null,
      decisionRequestId: null,
      decisionStatus: "idle",
      decisionErrorMessage: null,
      deliveryState: null,
      deliveryRequestId: null,
      deliveryStatus: "idle",
      deliveryErrorMessage: null,
    };
  }
  const originalText = decodeQueueItemText(
    inspection.originalTextBase64,
    inspection.byteLength,
  );
  if (originalText === null) {
    return {
      ...state,
      requestId: null,
      status: "error",
      originalText: null,
      inspection: null,
      errorMessage:
        "The queue item text could not be decoded safely. The source file and terminals were not changed.",
      decisionState: null,
      decisionRequestId: null,
      decisionStatus: "idle",
      decisionErrorMessage: null,
      deliveryState: null,
      deliveryRequestId: null,
      deliveryStatus: "idle",
      deliveryErrorMessage: null,
    };
  }
  return {
    ...state,
    requestId: null,
    status: "ready",
    originalText,
    inspection: inspectionEvidence(inspection),
    errorMessage: null,
    decisionState,
    deliveryState,
    deliveryRequestId: null,
    deliveryStatus: "idle",
    deliveryErrorMessage: null,
  };
}

export function beginQueueDecision(
  state: PaciumQueueInspectionState,
  requestId: string,
): PaciumQueueInspectionState {
  if (
    state.status !== "ready" ||
    state.decisionState?.status !== "open" ||
    state.decisionStatus === "submitting"
  ) {
    return state;
  }
  return {
    ...state,
    decisionRequestId: requestId,
    decisionStatus: "submitting",
    decisionErrorMessage: null,
  };
}

export function acceptQueueDecision(
  state: PaciumQueueInspectionState,
  requestId: string,
  result: QueueDecisionResult,
): PaciumQueueInspectionState {
  if (
    state.decisionRequestId !== requestId ||
    state.selection === null ||
    !sameQueueIdentity(state.selection.identity, result)
  ) {
    return state;
  }
  if (result.status === "recorded" || result.status === "existing") {
    return {
      ...state,
      decisionRequestId: null,
      decisionStatus: "idle",
      decisionErrorMessage: null,
      decisionState: {
        status: "decided",
        decision: result.decision,
        error: null,
      },
      deliveryState: null,
      deliveryRequestId: null,
      deliveryStatus: "idle",
      deliveryErrorMessage: null,
    };
  }
  const error = result.error;
  if (error === null) {
    return state;
  }
  if (result.status === "stale" || error.code === "ITEM_TYPE_MISMATCH") {
    return {
      ...state,
      requestId: null,
      status: "stale",
      originalText: null,
      inspection: null,
      errorMessage: error.message,
      decisionState: null,
      decisionRequestId: null,
      decisionStatus: "error",
      decisionErrorMessage: error.message,
      deliveryState: null,
      deliveryRequestId: null,
      deliveryStatus: "idle",
      deliveryErrorMessage: null,
    };
  }
  return {
    ...state,
    decisionRequestId: null,
    decisionStatus: "error",
    decisionErrorMessage: error.message,
  };
}

export function interruptQueueDecision(
  state: PaciumQueueInspectionState,
  requestId: string,
  message: string,
): PaciumQueueInspectionState {
  if (state.decisionRequestId !== requestId) {
    return state;
  }
  return {
    ...state,
    decisionRequestId: null,
    decisionStatus: "error",
    decisionErrorMessage: message,
  };
}

export function beginQueueDelivery(
  state: PaciumQueueInspectionState,
  requestId: string,
): PaciumQueueInspectionState {
  if (
    state.status !== "ready" ||
    state.decisionState?.status !== "decided" ||
    state.deliveryState?.status !== "ready" ||
    state.deliveryStatus === "submitting"
  ) {
    return state;
  }
  return {
    ...state,
    deliveryRequestId: requestId,
    deliveryStatus: "submitting",
    deliveryErrorMessage: null,
  };
}

export function acceptQueueDelivery(
  state: PaciumQueueInspectionState,
  requestId: string,
  result: QueueDeliveryResult,
): PaciumQueueInspectionState {
  const decision =
    state.decisionState?.status === "decided"
      ? state.decisionState.decision
      : null;
  if (
    state.deliveryRequestId !== requestId ||
    decision === null ||
    result.decisionId !== decision.decisionId ||
    result.decisionHash !== decision.decisionHash
  ) {
    return state;
  }
  return {
    ...state,
    deliveryState: result.state,
    deliveryRequestId: null,
    deliveryStatus: "idle",
    deliveryErrorMessage: null,
  };
}

export function interruptQueueDelivery(
  state: PaciumQueueInspectionState,
  requestId: string,
  message: string,
): PaciumQueueInspectionState {
  if (state.deliveryRequestId !== requestId) {
    return state;
  }
  return {
    ...state,
    deliveryRequestId: null,
    deliveryStatus: "error",
    deliveryErrorMessage: message,
  };
}

function inspectionEvidence(
  inspection: QueueItemInspection,
): QueueItemInspectionEvidence {
  return {
    status: inspection.status,
    workspaceRevision: inspection.workspaceRevision,
    sourceId: inspection.sourceId,
    observationRevision: inspection.observationRevision,
    contentHash: inspection.contentHash,
    itemId: inspection.itemId,
    sourceObservedAt: inspection.sourceObservedAt,
    firstObservedAt: inspection.firstObservedAt,
    byteLength: inspection.byteLength,
    error: inspection.error,
  };
}

export function interruptQueueItemInspection(
  state: PaciumQueueInspectionState,
  requestId: string,
  message: string,
): PaciumQueueInspectionState {
  if (state.requestId !== requestId) {
    return state;
  }
  return {
    ...state,
    requestId: null,
    status: "error",
    originalText: null,
    inspection: null,
    errorMessage: message,
    decisionState: null,
    decisionRequestId: null,
    decisionStatus: "idle",
    decisionErrorMessage: null,
    deliveryState: null,
    deliveryRequestId: null,
    deliveryStatus: "idle",
    deliveryErrorMessage: null,
  };
}

export function reconcileQueueItemInspection(
  state: PaciumQueueInspectionState,
  observation: QueueSourcesObservation,
): PaciumQueueInspectionState {
  if (state.selection === null) {
    return state;
  }
  const selected = state.selection.identity;
  const source = observation.sources.find(
    ({ sourceId }) => sourceId === selected.sourceId,
  );
  const candidate = source?.classification?.candidate ?? null;
  const current =
    observation.status === "ready" &&
    observation.workspaceRevision === selected.workspaceRevision &&
    source?.status === "stable" &&
    source.observationRevision === selected.observationRevision &&
    source.contentHash === selected.contentHash &&
    candidate?.itemId === selected.itemId;
  if (current) {
    return state;
  }
  return {
    ...state,
    requestId: null,
    status: observation.status === "ready" ? "stale" : "unavailable",
    originalText: null,
    inspection: null,
    errorMessage:
      observation.status === "ready"
        ? "This queue item is no longer current. The source file and terminals were not changed."
        : "Current queue evidence is unavailable. The source file and terminals were not changed.",
    decisionState: null,
    decisionRequestId: null,
    decisionStatus: "idle",
    decisionErrorMessage: null,
    deliveryState: null,
    deliveryRequestId: null,
    deliveryStatus: "idle",
    deliveryErrorMessage: null,
  };
}

export function reconcileQueueItemInspectionConfig(
  state: PaciumQueueInspectionState,
  config: PaciumConfigObservation,
): PaciumQueueInspectionState {
  if (
    state.selection === null ||
    (config.status === "ready" &&
      config.revision === state.selection.identity.workspaceRevision)
  ) {
    return state;
  }
  const stale = config.status === "ready";
  return {
    ...state,
    requestId: null,
    status: stale ? "stale" : "unavailable",
    originalText: null,
    inspection: null,
    errorMessage: stale
      ? "The Pacium workspace changed, so this queue item is no longer current. The source file and terminals were not changed."
      : "Current queue configuration is unavailable. The source file and terminals were not changed.",
    decisionState: null,
    decisionRequestId: null,
    decisionStatus: "idle",
    decisionErrorMessage: null,
    deliveryState: null,
    deliveryRequestId: null,
    deliveryStatus: "idle",
    deliveryErrorMessage: null,
  };
}

export function closeQueueItemInspection(): PaciumQueueInspectionState {
  return CLOSED_QUEUE_INSPECTION;
}

export function sameQueueIdentity(
  left: QueueItemInspectionIdentity,
  right: QueueItemInspectionIdentity,
): boolean {
  return (
    left.workspaceRevision === right.workspaceRevision &&
    left.sourceId === right.sourceId &&
    left.observationRevision === right.observationRevision &&
    left.contentHash === right.contentHash &&
    left.itemId === right.itemId
  );
}

export function decodeQueueItemText(
  originalTextBase64: string,
  byteLength: number,
): string | null {
  try {
    const binary = atob(originalTextBase64);
    if (binary.length !== byteLength) {
      return null;
    }
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0),
    );
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return new TextEncoder().encode(text).byteLength === byteLength
      ? text
      : null;
  } catch {
    return null;
  }
}
