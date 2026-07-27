import { createHash } from "node:crypto";

import {
  MAX_QUEUE_DELIVERY_PAYLOAD_BYTES,
  QueueAnswerFileDocumentSchema,
  QueueRolePromptDocumentSchema,
  type QueueDecisionRecord,
} from "@pacium/contracts";

export interface QueueDeliveryPayload {
  bytes: string;
  byteLength: number;
  contentHash: string;
}

export function serializeAnswerFileDelivery(
  decision: QueueDecisionRecord,
): QueueDeliveryPayload {
  const document = QueueAnswerFileDocumentSchema.parse({
    format: "pacium_decision_v1",
    decision,
  });
  return payload(`${JSON.stringify(document, null, 2)}\n`);
}

export function serializeRolePromptDelivery(
  decision: QueueDecisionRecord,
): QueueDeliveryPayload {
  const document = QueueRolePromptDocumentSchema.parse({
    format: "pacium_decision_v1",
    decisionId: decision.decisionId,
    decisionHash: decision.decisionHash,
    kind: decision.kind,
    payload: decision.payload,
  });
  const compact = JSON.stringify(document);
  return payload(
    `# Pacium decision v1 ${decision.decisionId} ${decision.decisionHash} ${compact}\r`,
  );
}

function payload(bytes: string): QueueDeliveryPayload {
  const byteLength = Buffer.byteLength(bytes, "utf8");
  if (byteLength === 0 || byteLength > MAX_QUEUE_DELIVERY_PAYLOAD_BYTES) {
    throw new Error("Queue delivery payload exceeds its safe byte bound.");
  }
  return {
    bytes,
    byteLength,
    contentHash: createHash("sha256").update(bytes, "utf8").digest("hex"),
  };
}
