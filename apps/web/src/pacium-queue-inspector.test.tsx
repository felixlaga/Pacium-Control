import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PaciumQueueInspector } from "./pacium-queue-inspector.js";
import type { PaciumQueueInspectionState } from "./pacium-queue-inspection-model.js";

describe("Pacium queue item inspector", () => {
  it("renders hostile original content as inert text with provenance", () => {
    const state = ready(
      "<script>queue()</script>\nhttps://example.test\n\u001b]52;c;copy\u0007",
    );
    const markup = renderToStaticMarkup(
      <PaciumQueueInspector
        onBack={() => undefined}
        requestingSessionLabel="Meta shell"
        state={state}
      />,
    );

    expect(markup).toContain("Question from Needs Felix");
    expect(markup).toContain("&lt;script&gt;queue()&lt;/script&gt;");
    expect(markup).not.toContain("<script>");
    expect(markup).not.toContain("<a ");
    expect(markup).not.toContain("href=");
    expect(markup).toContain("Displayed as inert text");
    expect(markup).toContain("Meta shell");
    expect(markup).toContain("High");
    expect(markup).toContain("whole-source adapter");
    expect(markup).toContain("Conflict detection is not implemented yet");
    expect(markup).toContain("/queue/NEEDS-FELIX");
    expect(markup).toContain("whole_source_v1");
    expect(markup).toContain("cannot answer a question");
    expect(markup).not.toContain(">Approve<");
    expect(markup).not.toContain(">Answer<");
  });

  it("explains loading and stale states without retaining original text", () => {
    const loading = renderToStaticMarkup(
      <PaciumQueueInspector
        onBack={() => undefined}
        requestingSessionLabel={null}
        state={{
          ...ready("Private answer"),
          status: "loading",
          requestId: "request-2",
          originalText: null,
          inspection: null,
        }}
      />,
    );
    expect(loading).toContain("Reading this exact current item");
    expect(loading).not.toContain("Private answer");

    const stale = renderToStaticMarkup(
      <PaciumQueueInspector
        onBack={() => undefined}
        requestingSessionLabel={null}
        state={{
          ...ready("Private answer"),
          status: "stale",
          requestId: null,
          originalText: null,
          inspection: null,
          errorMessage:
            "This queue item is no longer current. The source file and terminals were not changed.",
        }}
      />,
    );
    expect(stale).toContain("no longer current");
    expect(stale).toContain("source file and terminals were not changed");
    expect(stale).not.toContain("Private answer");
    expect(stale).toContain("← Back");
  });
});

function ready(originalText: string): PaciumQueueInspectionState {
  return {
    selection: {
      identity: {
        workspaceRevision: 4,
        sourceId: "needs-felix",
        observationRevision: 7,
        contentHash: "a".repeat(64),
        itemId: "b".repeat(64),
      },
      sourceLabel: "Needs Felix",
      sourcePath: "/queue/NEEDS-FELIX",
      requestingRole: "meta",
      type: "question",
      confidence: "high",
      boundary: "whole_source_v1",
      diagnostic: "A supported plain-text legacy marker was used.",
      firstObservedAt: "2026-07-27T11:50:00.000Z",
      sourceObservedAt: "2026-07-27T12:00:00.000Z",
    },
    requestId: null,
    status: "ready",
    originalText,
    inspection: {
      status: "ready",
      workspaceRevision: 4,
      sourceId: "needs-felix",
      observationRevision: 7,
      contentHash: "a".repeat(64),
      itemId: "b".repeat(64),
      sourceObservedAt: "2026-07-27T12:00:00.000Z",
      firstObservedAt: "2026-07-27T11:50:00.000Z",
      byteLength: new TextEncoder().encode(originalText).byteLength,
      error: null,
    },
    errorMessage: null,
  };
}
