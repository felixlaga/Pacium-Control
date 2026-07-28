import type { DiagnosticsSnapshot } from "@pacium/contracts";
import { describe, expect, it } from "vitest";

import {
  acceptDiagnosticsSnapshot,
  beginDiagnosticsRequest,
  canDownloadDiagnostics,
  diagnosticsFilename,
  diagnosticsJson,
  initialDiagnosticsState,
  isDiagnosticsRoute,
  previewDiagnostics,
  rejectDiagnosticsRequest,
} from "./diagnostics-model.js";

const snapshot = {
  schemaVersion: 1,
  generatedAt: "2026-07-28T07:30:00.000Z",
} as DiagnosticsSnapshot;

describe("diagnostics view model", () => {
  it("retains last-good evidence on refresh failure and ignores late results", () => {
    const firstRequest = beginDiagnosticsRequest(initialDiagnosticsState());
    const ready = acceptDiagnosticsSnapshot(
      firstRequest,
      firstRequest.requestGeneration,
      snapshot,
    );
    const previewed = previewDiagnostics(ready);
    const refresh = beginDiagnosticsRequest(previewed);
    const failed = rejectDiagnosticsRequest(
      refresh,
      refresh.requestGeneration,
      "Disconnected",
    );

    expect(failed.snapshot).toBe(snapshot);
    expect(failed.error).toBe("Disconnected");
    expect(canDownloadDiagnostics(failed)).toBe(true);
    expect(
      acceptDiagnosticsSnapshot(failed, firstRequest.requestGeneration, {
        ...snapshot,
        generatedAt: "2026-07-28T08:00:00.000Z",
      }),
    ).toBe(failed);
  });

  it("requires preview again after a successful replacement", () => {
    const request = beginDiagnosticsRequest(initialDiagnosticsState());
    const ready = acceptDiagnosticsSnapshot(
      request,
      request.requestGeneration,
      snapshot,
    );
    expect(canDownloadDiagnostics(ready)).toBe(false);
    expect(canDownloadDiagnostics(previewDiagnostics(ready))).toBe(true);

    const refresh = beginDiagnosticsRequest(previewDiagnostics(ready));
    const replaced = acceptDiagnosticsSnapshot(
      refresh,
      refresh.requestGeneration,
      { ...snapshot, generatedAt: "2026-07-28T08:00:00.000Z" },
    );
    expect(canDownloadDiagnostics(replaced)).toBe(false);
  });

  it("recognizes only the dedicated route and creates a safe exact export", () => {
    expect(isDiagnosticsRoute("/diagnostics")).toBe(true);
    expect(isDiagnosticsRoute("/diagnostics/extra")).toBe(false);
    expect(diagnosticsFilename(snapshot.generatedAt)).toBe(
      "pacium-diagnostics-2026-07-28T07-30-00-000Z.json",
    );
    expect(diagnosticsFilename("../../token")).toBe(
      "pacium-diagnostics-token.json",
    );
    expect(diagnosticsJson(snapshot)).toBe(
      `${JSON.stringify(snapshot, null, 2)}\n`,
    );
  });
});
