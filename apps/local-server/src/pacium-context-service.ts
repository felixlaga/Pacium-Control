import {
  MAX_PACIUM_DECISION_PREVIEW_BYTES,
  MAX_PACIUM_RECENT_DECISIONS,
  PaciumContextObservationSchema,
  PaciumRecentDecisionStateSchema,
  PaciumRecentDecisionSummarySchema,
  type PaciumContextObservation,
  type PaciumContextSourceObservation,
  type PaciumRecentDecisionState,
  type PaciumRecentDecisionSummary,
  type PaciumWorkspace,
  type QueueDecisionRecord,
  type QueueDeliveryRecord,
  type QueueResolutionRecord,
} from "@pacium/contracts";

import {
  readPaciumContextSource,
  type ContextFileReaderOptions,
} from "./context-file-reader.js";
import type { PaciumConfigStore } from "./pacium-config-store.js";
import type {
  QueueDecisionStore,
  QueueDecisionStoreObservation,
} from "./queue-decision-store.js";

export interface PaciumContextServiceOptions {
  now?: () => string;
  readSource?: (
    kind: "objective" | "plan",
    source: PaciumWorkspace["context"]["objective"],
    options?: ContextFileReaderOptions,
  ) => Promise<PaciumContextSourceObservation>;
  isDeliveryActive?: (deliveryId: string) => boolean;
}

export class PaciumContextService {
  private readonly now: () => string;
  private readonly readSource: NonNullable<
    PaciumContextServiceOptions["readSource"]
  >;
  private readonly isDeliveryActive: (deliveryId: string) => boolean;

  public constructor(
    private readonly config: PaciumConfigStore,
    private readonly state: QueueDecisionStore,
    options: PaciumContextServiceOptions = {},
  ) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.readSource = options.readSource ?? readPaciumContextSource;
    this.isDeliveryActive = options.isDeliveryActive ?? (() => false);
  }

  public async inspect(): Promise<PaciumContextObservation> {
    const observedAt = this.now();
    const before = await this.config.inspect();
    if (
      before.status !== "ready" ||
      before.workspace === null ||
      before.revision === null
    ) {
      return unavailable(
        observedAt,
        "config_unavailable",
        "Pacium workspace context is unavailable until configuration is ready.",
      );
    }

    const workspace = before.workspace;
    const revision = before.revision;
    const [objective, plan, state] = await Promise.all([
      this.readSource("objective", workspace.context.objective, {
        now: () => observedAt,
      }),
      this.readSource("plan", workspace.context.plan, {
        now: () => observedAt,
      }),
      this.state.inspect(),
    ]);
    const after = await this.config.inspect();
    if (
      after.status !== "ready" ||
      after.workspace?.id !== workspace.id ||
      after.revision !== revision
    ) {
      return unavailable(
        observedAt,
        "config_drift",
        "Pacium configuration changed during context inspection. Refresh the accepted definition.",
      );
    }

    const recentDecisions = projectRecentDecisions(
      workspace,
      state,
      this.isDeliveryActive,
    );
    const ready =
      sourceAvailable(objective) &&
      sourceAvailable(plan) &&
      recentDecisions.status === "ready";
    return PaciumContextObservationSchema.parse({
      status: ready ? "ready" : "partial",
      workspaceId: workspace.id,
      workspaceRevision: revision,
      objective,
      plan,
      recentDecisions,
      observedAt,
      error: null,
    });
  }
}

export function projectRecentDecisions(
  workspace: PaciumWorkspace,
  state: QueueDecisionStoreObservation,
  isDeliveryActive: (deliveryId: string) => boolean = () => false,
): PaciumRecentDecisionState {
  if (state.status === "error") {
    return PaciumRecentDecisionStateSchema.parse({
      status: "unavailable",
      decisions: [],
      truncated: false,
      error: {
        code: "decision_state_unavailable",
        message:
          "Recent decision state is unavailable. Context files and terminals remain available.",
      },
    });
  }

  const ordered = [...state.decisions].toSorted(
    (left, right) =>
      Date.parse(right.decidedAt) - Date.parse(left.decidedAt) ||
      left.decisionId.localeCompare(right.decisionId),
  );
  return PaciumRecentDecisionStateSchema.parse({
    status: "ready",
    decisions: ordered
      .slice(0, MAX_PACIUM_RECENT_DECISIONS)
      .map((decision) =>
        projectDecision(
          workspace,
          decision,
          state.deliveries,
          state.resolutions,
          isDeliveryActive,
        ),
      ),
    truncated: ordered.length > MAX_PACIUM_RECENT_DECISIONS,
    error: null,
  });
}

function projectDecision(
  workspace: PaciumWorkspace,
  decision: QueueDecisionRecord,
  deliveries: readonly QueueDeliveryRecord[],
  resolutions: readonly QueueResolutionRecord[],
  isDeliveryActive: (deliveryId: string) => boolean,
): PaciumRecentDecisionSummary {
  const source =
    decision.source.workspaceId === workspace.id
      ? workspace.queueSources.find(
          (candidate) => candidate.id === decision.source.sourceId,
        )
      : undefined;
  const attempts = deliveries
    .filter((delivery) => delivery.decisionId === decision.decisionId)
    .toSorted(
      (left, right) =>
        Date.parse(right.requestedAt) - Date.parse(left.requestedAt) ||
        left.deliveryId.localeCompare(right.deliveryId),
    );
  const latestDelivery = attempts[0] ?? null;
  const lifecycle =
    resolutions
      .filter((resolution) => resolution.decisionId === decision.decisionId)
      .toSorted(
        (left, right) =>
          Date.parse(right.recordedAt) - Date.parse(left.recordedAt) ||
          left.resolutionId.localeCompare(right.resolutionId),
      )[0] ?? null;

  return PaciumRecentDecisionSummarySchema.parse({
    decisionId: decision.decisionId,
    decisionHash: decision.decisionHash,
    workspaceId: decision.source.workspaceId,
    sourceId: decision.source.sourceId,
    sourceLabel: source?.label ?? null,
    sourceCurrent: source !== undefined,
    itemId: decision.source.itemId,
    contentHash: decision.source.contentHash,
    decidedAt: decision.decidedAt,
    actorLabel: decision.actor.label,
    response:
      decision.kind === "question_answer"
        ? {
            kind: decision.kind,
            ...previewAnswer(decision.payload.answer),
          }
        : {
            kind: decision.kind,
            outcome: decision.payload.outcome,
          },
    delivery:
      latestDelivery === null
        ? null
        : {
            attemptCount: attempts.length,
            deliveryId: latestDelivery.deliveryId,
            deliveryHash: latestDelivery.deliveryHash,
            status:
              latestDelivery.outcome?.status ??
              (isDeliveryActive(latestDelivery.deliveryId)
                ? "delivering"
                : "unknown"),
            requestedAt: latestDelivery.requestedAt,
            completedAt: latestDelivery.outcome?.recordedAt ?? null,
            evidenceKind: latestDelivery.outcome?.evidence?.kind ?? null,
          },
    lifecycle:
      lifecycle === null
        ? null
        : {
            resolutionId: lifecycle.resolutionId,
            resolutionHash: lifecycle.resolutionHash,
            action: lifecycle.action,
            source: lifecycle.source,
            actorLabel: lifecycle.actor.label,
            recordedAt: lifecycle.recordedAt,
          },
  });
}

function previewAnswer(answer: string): {
  preview: string;
  truncated: boolean;
} {
  const bytes = new TextEncoder().encode(answer);
  if (bytes.byteLength <= MAX_PACIUM_DECISION_PREVIEW_BYTES) {
    return { preview: answer, truncated: false };
  }
  let end = MAX_PACIUM_DECISION_PREVIEW_BYTES;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  while (end > 0) {
    try {
      return {
        preview: decoder.decode(bytes.subarray(0, end)),
        truncated: true,
      };
    } catch {
      end -= 1;
    }
  }
  return { preview: "", truncated: true };
}

function sourceAvailable(source: PaciumContextSourceObservation): boolean {
  return ["ready", "empty", "unconfigured"].includes(source.status);
}

function unavailable(
  observedAt: string,
  code: "config_unavailable" | "config_drift",
  message: string,
): PaciumContextObservation {
  return PaciumContextObservationSchema.parse({
    status: "unavailable",
    workspaceId: null,
    workspaceRevision: null,
    objective: null,
    plan: null,
    recentDecisions: null,
    observedAt,
    error: { code, message },
  });
}
