import { createHash } from "node:crypto";

import type {
  QueueItemConfidence,
  QueueItemType,
  QueueSourceClassification,
} from "@pacium/contracts";
import {
  QUEUE_ITEM_BOUNDARY_VERSION,
  queueClassificationDiagnostic,
} from "@pacium/contracts";

export interface QueueItemClassifierInput {
  sourceId: string;
  contentHash: string;
  text: string;
}

interface Marker {
  markdown: boolean;
  type: Exclude<QueueItemType, "unknown">;
}

const VALID_MARKERS: ReadonlyArray<{
  pattern: RegExp;
  marker: Marker;
}> = [
  {
    pattern: /^# Question:\s*\S.*$/,
    marker: { markdown: true, type: "question" },
  },
  {
    pattern: /^Question:\s*\S.*$/,
    marker: { markdown: false, type: "question" },
  },
  {
    pattern: /^# Approval request:\s*\S.*$/,
    marker: { markdown: true, type: "approval" },
  },
  {
    pattern: /^Approval request:\s*\S.*$/,
    marker: { markdown: false, type: "approval" },
  },
  {
    pattern: /^# Failure:\s*\S.*$/,
    marker: { markdown: true, type: "failure" },
  },
  {
    pattern: /^(?:Failure|ERROR|FAILED):\s*\S.*$/,
    marker: { markdown: false, type: "failure" },
  },
  {
    pattern: /^# Review request:\s*\S.*$/,
    marker: { markdown: true, type: "review" },
  },
  {
    pattern: /^(?:Review request|Review):\s*\S.*$/,
    marker: { markdown: false, type: "review" },
  },
];

const MARKER_PREFIX =
  /^(?:# )?(?:Question|Approval request|Failure|Review request|Review|ERROR|FAILED):/;

export function classifyQueueItem(
  input: QueueItemClassifierInput,
): QueueSourceClassification {
  const text = input.text.startsWith("\uFEFF")
    ? input.text.slice(1)
    : input.text;
  const lines = text.split(/\r\n|\n|\r/);
  const firstContentLine = lines.find((line) => line.trim().length > 0);
  if (firstContentLine === undefined) {
    return {
      status: "none",
      boundary: QUEUE_ITEM_BOUNDARY_VERSION,
      candidate: null,
      diagnostics: [queueClassificationDiagnostic("blank_content")],
    };
  }

  const topLevelMarkers = lines.filter(
    (line) => line.trim().length > 0 && line === line.trimStart(),
  );
  const markerCount = topLevelMarkers.filter(
    (line) => matchMarker(line) !== null || MARKER_PREFIX.test(line),
  ).length;
  if (markerCount > 1) {
    return candidate(input, "unknown", "low", "multiple_markers");
  }

  const firstMarker =
    firstContentLine === firstContentLine.trimStart()
      ? matchMarker(firstContentLine)
      : null;
  if (firstMarker !== null) {
    return candidate(
      input,
      firstMarker.type,
      firstMarker.markdown ? "confirmed" : "high",
      firstMarker.markdown ? null : "legacy_marker",
    );
  }
  if (
    firstContentLine === firstContentLine.trimStart() &&
    MARKER_PREFIX.test(firstContentLine)
  ) {
    return candidate(input, "unknown", "low", "malformed_marker");
  }
  if (text.trim().endsWith("?")) {
    return candidate(input, "question", "medium", "question_heuristic");
  }
  return candidate(input, "unknown", "low", "unrecognized_format");
}

function matchMarker(line: string): Marker | null {
  const matched =
    VALID_MARKERS.find(({ pattern }) => pattern.test(line))?.marker ?? null;
  if (matched === null) {
    return null;
  }
  const suffix = line.slice(line.indexOf(":") + 1);
  return hasTerminalControl(suffix) ? null : matched;
}

function hasTerminalControl(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0);
    return (
      codePoint !== undefined &&
      (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f))
    );
  });
}

function candidate(
  input: QueueItemClassifierInput,
  type: QueueItemType,
  confidence: QueueItemConfidence,
  diagnostic: Parameters<typeof queueClassificationDiagnostic>[0] | null,
): QueueSourceClassification {
  const itemId = createHash("sha256")
    .update(QUEUE_ITEM_BOUNDARY_VERSION)
    .update("\0")
    .update(input.sourceId)
    .update("\0")
    .update(input.contentHash)
    .digest("hex");
  return {
    status: "candidate",
    boundary: QUEUE_ITEM_BOUNDARY_VERSION,
    candidate: { itemId, type, confidence },
    diagnostics:
      diagnostic === null ? [] : [queueClassificationDiagnostic(diagnostic)],
  };
}
