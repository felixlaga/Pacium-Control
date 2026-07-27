import type { SessionSummary } from "@pacium/contracts";
import { describe, expect, it } from "vitest";

import {
  classificationConfidenceLabel,
  classificationSourceLabel,
  sessionAccessibleName,
} from "./agent-classification-model.js";

const session: SessionSummary = {
  id: "53cfec56-181c-4e9c-b187-8f323780c175",
  epoch: 1,
  displayName: "Meta",
  cwd: "/work/pacium",
  shell: "/opt/bin/codex",
  launchPreset: "codex",
  commandLabel: "Codex",
  agentClassification: {
    type: "codex",
    label: "Codex CLI",
    source: "launch_preset",
    confidence: "confirmed",
    observedAt: "2026-07-27T10:00:00.000Z",
  },
  repositoryRoot: "/work/pacium",
  repositoryName: "pacium",
  runtime: "pty",
  processState: "live",
  pid: 42,
  cols: 100,
  rows: 30,
  createdAt: "2026-07-27T10:00:00.000Z",
  exitedAt: null,
  exitCode: null,
  exitSignal: null,
};

describe("agent classification presentation", () => {
  it("labels evidence source and confidence without activity inference", () => {
    expect(classificationSourceLabel("launch_preset")).toBe("Launch preset");
    expect(classificationSourceLabel("process_observed")).toBe(
      "Process observed",
    );
    expect(classificationSourceLabel("human_labelled")).toBe("Human labelled");
    expect(classificationConfidenceLabel("confirmed")).toBe("Confirmed");
    expect(classificationConfidenceLabel("low")).toBe("Low confidence");
  });

  it("builds a concise session name from classification and process truth", () => {
    const label = sessionAccessibleName(session);
    expect(label).toBe("Meta, Codex CLI, process live");
    expect(label).not.toContain("working");
  });
});
