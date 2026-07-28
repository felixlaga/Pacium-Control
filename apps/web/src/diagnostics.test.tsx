import type { DiagnosticsSnapshot } from "@pacium/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DiagnosticsDialog } from "./diagnostics.js";
import {
  acceptDiagnosticsSnapshot,
  beginDiagnosticsRequest,
  initialDiagnosticsState,
} from "./diagnostics-model.js";

const snapshot = {
  schemaVersion: 1,
  generatedAt: "2026-07-28T07:30:00.000Z",
  application: {
    paciumVersion: "0.0.0",
    protocolVersion: 24,
    nodeVersion: "24.18.0",
    platform: "darwin",
    architecture: "arm64",
    dependencyVersions: {
      nodePty: "1.1.0-pacium.1",
      xtermHeadless: "6.0.0",
      xtermBrowser: "6.0.0",
      react: "19.2.8",
      ws: "8.21.1",
      zod: "4.4.3",
    },
  },
  overview: {
    state: "degraded",
    sessions: {
      total: 0,
      creating: 0,
      live: 0,
      closing: 0,
      exited: 0,
      failed: 0,
      directPty: 0,
      tmux: 0,
    },
    queueStatus: "unconfigured",
    queueSources: 0,
    queueItems: {
      question: 0,
      approval: 0,
      failure: 0,
      review: 0,
      unknown: 0,
    },
    queueConflicts: 0,
    tmuxStatus: "unconfigured",
    tmuxVersion: null,
  },
  components: [
    {
      id: "local_server",
      state: "healthy",
      summary: "The local server constructed this snapshot.",
      operatorAction: null,
    },
  ],
  sessions: [],
  sessionsTruncated: false,
  diagnostics: [],
  diagnosticsTruncated: false,
  redactionManifest: {
    included: ["application_versions"],
    omitted: ["terminal_content", "environment_and_credentials"],
  },
} as DiagnosticsSnapshot;

describe("diagnostics dialog markup", () => {
  it("shows bounded health, empty state, and preview-gated export", () => {
    const request = beginDiagnosticsRequest(initialDiagnosticsState());
    const ready = acceptDiagnosticsSnapshot(
      request,
      request.requestGeneration,
      snapshot,
    );
    const markup = renderToStaticMarkup(
      <DiagnosticsDialog
        connection="connected"
        initialState={ready}
        load={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain("Bounded application health");
    expect(markup).toContain("No terminal sessions are currently reported");
    expect(markup).toContain("Runtime versions");
    expect(markup).toContain("1.1.0-pacium.1");
    expect(markup).toContain("No fixed diagnostic codes");
    expect(markup).toContain("Always omitted");
    expect(markup).toContain("Terminal content");
    expect(markup).toContain('<button disabled="" type="button">Download JSON');
    expect(markup).not.toContain("Exact diagnostics JSON");
  });

  it("explains disconnect safety without claiming terminals ended", () => {
    const markup = renderToStaticMarkup(
      <DiagnosticsDialog
        connection="disconnected"
        initialState={initialDiagnosticsState()}
        load={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(markup).toContain("cannot stop server-owned terminal processes");
    expect(markup).toContain("Running terminals are unchanged");
  });
});
