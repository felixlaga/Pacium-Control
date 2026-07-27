import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PaciumQueueReconciliationPanel } from "./pacium-queue-reconciliation-panel.js";

describe("Pacium queue reconciliation panel", () => {
  it("keeps transport artifacts, conflicts, and human labels distinct", () => {
    const markup = renderToStaticMarkup(
      <PaciumQueueReconciliationPanel
        reconciliation={{
          decisionId: "28c9142a-8986-43c7-9451-445fd8c13c3e",
          decisionHash: "c".repeat(64),
          conflicts: [
            {
              conflictId: "f".repeat(64),
              kind: "source_changed_after_decision",
              decisionCount: 1,
              relatedSourceIds: [],
              observedAt: "2026-07-27T12:08:00.000Z",
            },
          ],
          priorDecisions: {
            decisions: [
              {
                decisionId: "38c9142a-8986-43c7-9451-445fd8c13c3e",
                decisionHash: "b".repeat(64),
                itemId: "a".repeat(64),
                itemType: "question",
                decidedAt: "2026-07-27T11:00:00.000Z",
              },
            ],
            truncated: false,
          },
          attempts: [attempt()],
          artifact: {
            status: "transport_artifact_present",
            source: "filesystem_observed",
            observedAt: "2026-07-27T12:07:30.000Z",
            reason: null,
            byteLength: 512,
            contentHash: "d".repeat(64),
          },
          lifecycle: {
            status: "acknowledged",
            current: resolution(),
            history: [resolution()],
            historyTruncated: false,
          },
          retry: { status: "not_applicable" },
        }}
      />,
    );

    expect(markup).toContain("Reconciliation evidence");
    expect(markup).toContain("Transport artifact present");
    expect(markup).toContain(
      "proves transport output only, not acknowledgement or application",
    );
    expect(markup).toContain("Acknowledged · human-labelled");
    expect(markup).toContain("Source changed after decision");
    expect(markup).toContain("Other decisions from this source");
    expect(markup).not.toContain("ffffffff");
    expect(markup).not.toContain("bbbbbbbb");
  });
});

function attempt() {
  return {
    deliveryId: "4699b11f-94d3-430a-960e-1c574a03db41",
    decisionId: "28c9142a-8986-43c7-9451-445fd8c13c3e",
    decisionHash: "c".repeat(64),
    target: {
      type: "answer_file" as const,
      methodId: "answers",
      methodLabel: "Pacium answers",
      path: "/queue/PACIUM-ANSWERS",
    },
    payloadHash: "d".repeat(64),
    payloadByteLength: 512,
    requestedAt: "2026-07-27T12:06:00.000Z",
    outcome: {
      status: "delivered" as const,
      recordedAt: "2026-07-27T12:06:01.000Z",
      evidence: {
        kind: "answer_file_created" as const,
        byteLength: 512,
        contentHash: "d".repeat(64),
      },
      error: null,
    },
    deliveryHash: "e".repeat(64),
  };
}

function resolution() {
  return {
    resolutionId: "253a4e0e-d606-4438-9e7e-c27b0021994c",
    decisionId: "28c9142a-8986-43c7-9451-445fd8c13c3e",
    decisionHash: "c".repeat(64),
    action: "acknowledged" as const,
    delivery: {
      deliveryId: "4699b11f-94d3-430a-960e-1c574a03db41",
      deliveryHash: "e".repeat(64),
    },
    relatedDecision: null,
    actor: {
      kind: "local_operator" as const,
      label: "Local operator" as const,
    },
    source: "human_labelled" as const,
    recordedAt: "2026-07-27T12:07:00.000Z",
    note: "Confirmed in the provider.",
    resolutionHash: "9".repeat(64),
  };
}
