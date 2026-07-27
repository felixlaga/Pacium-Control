import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PaciumQueueSources } from "./pacium-queue-sources.js";
import type { PaciumQueueProjection } from "./pacium-queue-model.js";

describe("Pacium queue source semantics", () => {
  it("renders source health and content-free classification metadata", () => {
    const markup = render();

    expect(markup).toContain('aria-label="Queue source observation"');
    expect(markup).toContain(
      "Needs Felix queue source, Stable, Question · High confidence",
    );
    expect(markup).toContain("Stable · Meta");
    expect(markup).toContain("Question · High confidence");
    expect(markup).toContain("A supported plain-text legacy marker was used.");
    expect(markup).toContain("2 KiB · aaaaaaaa · observed");
    expect(markup).toContain("metadata only; no queue actions");
    expect(markup).not.toContain("bbbbbbbb");
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
      error: {
        code: "WATCH_FAILED",
        message: "The source parent could not be watched.",
      },
    };
    const markup = render(projection);

    expect(markup).toContain("Watch error · Meta");
    expect(markup).toContain("could not be watched");
    expect(markup).toContain("disconnected");
    expect(markup).toContain("<button disabled");
  });

  it("escapes hostile labels, paths, and errors as text", () => {
    const projection = ready();
    projection.sources[0]!.source.label = "<script>queue()</script>";
    projection.sources[0]!.source.path = '"><img src=x onerror=queue()>';
    projection.sources[0]!.observation!.classification!.diagnostics[0]!.message =
      "</span><script>classify()</script>";
    const classificationMarkup = render(projection);
    expect(classificationMarkup).toContain(
      "&lt;/span&gt;&lt;script&gt;classify()",
    );
    projection.sources[0]!.observation = {
      ...projection.sources[0]!.observation!,
      status: "read_error",
      byteLength: null,
      modifiedAt: null,
      contentHash: null,
      classification: null,
      error: {
        code: "READ_FAILED",
        message: "</small><script>read()</script>",
      },
    };
    const markup = render(projection);

    expect(markup).toContain("&lt;script&gt;queue()&lt;/script&gt;");
    expect(markup).toContain("&lt;img src=x onerror=queue()&gt;");
    expect(markup).toContain("&lt;/small&gt;&lt;script&gt;read()");
    expect(markup).not.toContain("<script>");
    expect(markup).not.toContain("<img");
  });

  it("teaches the next action when no sources are configured", () => {
    const markup = render({
      status: "unconfigured",
      message: "No Pacium queue sources are configured.",
      disconnected: false,
      canRefresh: true,
      sources: [],
    });
    expect(markup).toContain("No Pacium queue sources are configured.");
    expect(markup).toContain(">Refresh</button>");
  });
});

function render(projection: PaciumQueueProjection = ready()) {
  return renderToStaticMarkup(
    <PaciumQueueSources onRefresh={() => undefined} projection={projection} />,
  );
}

function ready(): PaciumQueueProjection {
  return {
    status: "ready",
    message: "Whole-source classification is metadata only; no queue actions.",
    disconnected: false,
    canRefresh: true,
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
          error: null,
        },
      },
    ],
  };
}
