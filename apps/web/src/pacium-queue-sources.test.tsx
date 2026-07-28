import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PaciumQueueSources } from "./pacium-queue-sources.js";
import type { PaciumQueueProjection } from "./pacium-queue-model.js";

describe("Pacium queue list semantics", () => {
  it("renders current candidates as content-free queue buttons", () => {
    const markup = render();

    expect(markup).toContain('aria-label="Pacium queue"');
    expect(markup).toContain(
      "Question from Needs Felix, Meta, high confidence",
    );
    expect(markup).toContain('id="queue-item-needs-felix"');
    expect(markup).toContain("Question from Needs Felix");
    expect(markup).toContain("Meta · Seen");
    expect(markup).toContain("Seen");
    expect(markup).not.toContain(
      "decisions stay local until explicit delivery",
    );
    expect(markup).not.toContain("bbbbbbbb");
    expect(markup).not.toContain("A supported plain-text legacy marker");
    expect(markup).not.toContain("2 KiB");
  });

  it("renders degraded evidence and disables refresh while disconnected", () => {
    const projection = ready();
    projection.disconnected = true;
    projection.canRefresh = false;
    projection.message = "Last accepted source evidence · disconnected.";
    projection.sources[0]!.observation = {
      ...projection.sources[0]!.observation!,
      status: "watch_error",
      byteLength: null,
      modifiedAt: null,
      contentHash: null,
      classification: null,
      candidateFirstObservedAt: null,
      conflicts: [],
      error: {
        code: "WATCH_FAILED",
        message: "The source parent could not be watched.",
      },
    };
    const markup = render(projection);

    expect(markup).toContain("Watch error · Meta");
    expect(markup).not.toContain("could not be watched");
    expect(markup).not.toContain("disconnected");
    expect(markup).toContain("<button disabled");
  });

  it("escapes hostile labels and omits path and error detail", () => {
    const projection = ready();
    projection.sources[0]!.source.label = "<script>queue()</script>";
    projection.sources[0]!.source.path = '"><img src=x onerror=queue()>';
    projection.sources[0]!.observation!.classification!.diagnostics[0]!.message =
      "</span><script>classify()</script>";
    const classificationMarkup = render(projection);
    expect(classificationMarkup).not.toContain("classify()");
    expect(classificationMarkup).toContain(
      "&lt;script&gt;queue()&lt;/script&gt;",
    );
    projection.sources[0]!.observation = {
      ...projection.sources[0]!.observation!,
      status: "read_error",
      byteLength: null,
      modifiedAt: null,
      contentHash: null,
      classification: null,
      candidateFirstObservedAt: null,
      conflicts: [],
      error: {
        code: "READ_FAILED",
        message: "</small><script>read()</script>",
      },
    };
    const markup = render(projection);

    expect(markup).toContain("&lt;script&gt;queue()&lt;/script&gt;");
    expect(markup).not.toContain("onerror=queue");
    expect(markup).not.toContain("script&gt;read");
    expect(markup).not.toContain("<script>");
    expect(markup).not.toContain("<img");
  });

  it("teaches the next action when no sources are configured", () => {
    const markup = render({
      status: "unconfigured",
      message: "No Pacium queue sources are configured.",
      disconnected: false,
      canRefresh: true,
      workspaceRevision: null,
      itemCount: 0,
      sources: [],
    });
    expect(markup).toContain("No Pacium queue sources are configured.");
    expect(markup).toContain(">Refresh</button>");
  });

  it("shows content-free conflict evidence on the affected row", () => {
    const projection = ready();
    projection.sources[0]!.observation!.conflicts = [
      {
        conflictId: "f".repeat(64),
        kind: "source_changed_after_decision",
        decisionCount: 1,
        relatedSourceIds: [],
        observedAt: "2026-07-27T12:01:00.000Z",
      },
    ];
    const markup = render(projection);

    expect(markup).toContain(">Conflict</small>");
    expect(markup).toContain("1 conflict signal");
    expect(markup).not.toContain("ffffffff");
  });
});

function render(projection: PaciumQueueProjection = ready()) {
  return renderToStaticMarkup(
    <PaciumQueueSources
      onOpenItem={() => undefined}
      onRefresh={() => undefined}
      projection={projection}
    />,
  );
}

function ready(): PaciumQueueProjection {
  return {
    status: "ready",
    message:
      "1 current whole-source item · decisions stay local until explicit delivery.",
    disconnected: false,
    canRefresh: true,
    workspaceRevision: 4,
    itemCount: 1,
    sources: [
      {
        source: {
          id: "needs-felix",
          label: "Needs Felix",
          path: "/queue/NEEDS-FELIX",
          format: "plain_text",
          requestingRole: "meta",
          deliveryMethodId: null,
        },
        observation: {
          sourceId: "needs-felix",
          observationRevision: 2,
          status: "stable",
          observedAt: "2026-07-27T12:00:00.000Z",
          byteLength: 2_048,
          modifiedAt: "2026-07-27T12:00:00.000Z",
          contentHash: "a".repeat(64),
          classification: {
            status: "candidate",
            boundary: "whole_source_v1",
            candidate: {
              itemId: "b".repeat(64),
              type: "question",
              confidence: "high",
            },
            diagnostics: [
              {
                code: "legacy_marker",
                message: "A supported plain-text legacy marker was used.",
              },
            ],
          },
          candidateFirstObservedAt: "2026-07-27T11:58:00.000Z",
          conflicts: [],
          error: null,
        },
      },
    ],
  };
}
