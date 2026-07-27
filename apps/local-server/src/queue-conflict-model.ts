import { createHash } from "node:crypto";

import {
  QueueSourcesObservationSchema,
  type QueueDecisionRecord,
  type QueueSourceConflict,
  type QueueSourceObservation,
  type QueueSourcesObservation,
} from "@pacium/contracts";

export function withQueueSourceConflicts(
  observation: QueueSourcesObservation,
  workspaceId: string,
  decisions: readonly QueueDecisionRecord[],
): QueueSourcesObservation {
  if (observation.status !== "ready") {
    return observation;
  }
  const decisionsBySource = new Map<string, QueueDecisionRecord[]>();
  for (const decision of decisions) {
    if (decision.source.workspaceId !== workspaceId) {
      continue;
    }
    const sourceDecisions =
      decisionsBySource.get(decision.source.sourceId) ?? [];
    sourceDecisions.push(decision);
    decisionsBySource.set(decision.source.sourceId, sourceDecisions);
  }
  const duplicateSources = currentDuplicateSources(observation.sources);
  return QueueSourcesObservationSchema.parse({
    ...observation,
    sources: observation.sources.map((source) => ({
      ...source,
      conflicts: conflictsForSource(
        source,
        decisionsBySource.get(source.sourceId) ?? [],
        duplicateSources.get(source.sourceId) ?? [],
        observation.observedAt,
      ),
    })),
  });
}

function conflictsForSource(
  source: QueueSourceObservation,
  decisions: readonly QueueDecisionRecord[],
  duplicateSourceIds: readonly string[],
  observedAt: string,
): QueueSourceConflict[] {
  const conflicts: QueueSourceConflict[] = [];
  const currentItemId = source.classification?.candidate?.itemId ?? null;
  if (source.status === "stable" && currentItemId !== null) {
    const changed = decisions.filter(
      (decision) => decision.source.itemId !== currentItemId,
    );
    if (changed.length > 0) {
      conflicts.push({
        conflictId: conflictId([
          "source_changed_after_decision",
          source.sourceId,
          currentItemId,
          ...changed.map((decision) => decision.decisionHash).sort(),
        ]),
        kind: "source_changed_after_decision",
        decisionCount: changed.length,
        relatedSourceIds: [],
        observedAt,
      });
    }
  } else if (decisions.length > 0) {
    conflicts.push({
      conflictId: conflictId([
        "source_unavailable_after_decision",
        source.sourceId,
        source.status,
        ...decisions.map((decision) => decision.decisionHash).sort(),
      ]),
      kind: "source_unavailable_after_decision",
      decisionCount: decisions.length,
      relatedSourceIds: [],
      observedAt,
    });
  }
  if (duplicateSourceIds.length > 0) {
    conflicts.push({
      conflictId: conflictId([
        "duplicate_current_item",
        source.contentHash ?? "",
        source.sourceId,
        ...duplicateSourceIds,
      ]),
      kind: "duplicate_current_item",
      decisionCount: decisions.length,
      relatedSourceIds: [...duplicateSourceIds],
      observedAt,
    });
  }
  return conflicts;
}

function currentDuplicateSources(
  sources: readonly QueueSourceObservation[],
): Map<string, string[]> {
  const sourcesByHash = new Map<string, string[]>();
  for (const source of sources) {
    if (
      source.status !== "stable" ||
      source.contentHash === null ||
      source.classification?.candidate === null ||
      source.classification === null
    ) {
      continue;
    }
    const ids = sourcesByHash.get(source.contentHash) ?? [];
    ids.push(source.sourceId);
    sourcesByHash.set(source.contentHash, ids);
  }
  const duplicates = new Map<string, string[]>();
  for (const ids of sourcesByHash.values()) {
    if (ids.length < 2) {
      continue;
    }
    const sorted = [...ids].sort();
    for (const sourceId of sorted) {
      duplicates.set(
        sourceId,
        sorted.filter((candidate) => candidate !== sourceId),
      );
    }
  }
  return duplicates;
}

function conflictId(parts: readonly string[]): string {
  return createHash("sha256")
    .update(parts.join("\u0000"), "utf8")
    .digest("hex");
}
