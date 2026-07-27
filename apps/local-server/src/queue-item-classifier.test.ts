import { describe, expect, it } from "vitest";

import { classifyQueueItem } from "./queue-item-classifier.js";

const contentHash = "b".repeat(64);

describe("queue item classifier", () => {
  it.each([
    ["# Question: Choose a database", "question", "confirmed", null],
    ["Question: Choose a database", "question", "high", "legacy_marker"],
    [
      "# Approval request: Run the exact migration",
      "approval",
      "confirmed",
      null,
    ],
    [
      "Approval request: Run the exact migration",
      "approval",
      "high",
      "legacy_marker",
    ],
    ["# Failure: Tests failed", "failure", "confirmed", null],
    ["ERROR: Tests failed", "failure", "high", "legacy_marker"],
    ["FAILED: Tests failed", "failure", "high", "legacy_marker"],
    ["Failure: Tests failed", "failure", "high", "legacy_marker"],
    ["# Review request: Inspect patch", "review", "confirmed", null],
    ["Review: Inspect patch", "review", "high", "legacy_marker"],
    ["Review request: Inspect patch", "review", "high", "legacy_marker"],
  ])("classifies supported marker %s", (text, type, confidence, diagnostic) => {
    const result = classify(text);

    expect(result).toMatchObject({
      status: "candidate",
      candidate: { type, confidence },
    });
    expect(result.diagnostics.map(({ code }) => code)).toEqual(
      diagnostic === null ? [] : [diagnostic],
    );
  });

  it("allows leading blank lines and a Unicode BOM before an exact marker", () => {
    expect(classify("\uFEFF\n\n# Question: Keep Unicode ✓")).toMatchObject({
      candidate: { type: "question", confidence: "confirmed" },
    });
  });

  it("uses only a medium question heuristic for unmarked prose", () => {
    expect(classify("Can you approve running this command?")).toMatchObject({
      candidate: { type: "question", confidence: "medium" },
      diagnostics: [{ code: "question_heuristic" }],
    });
  });

  it.each([
    "Please approve running this command.",
    "allow=true",
    "<button>Approve</button>",
    "rm -rf /tmp/project",
    "[ ] Allow once",
  ])("never infers approval from unmarked content: %s", (text) => {
    expect(classify(text)).toMatchObject({
      candidate: { type: "unknown", confidence: "low" },
      diagnostics: [{ code: "unrecognized_format" }],
    });
  });

  it.each([
    "# Approval request:",
    "Approval request:   ",
    "# Question:",
    "ERROR:",
    "Review: ",
  ])("keeps malformed markers unknown: %s", (text) => {
    expect(classify(text)).toMatchObject({
      candidate: { type: "unknown", confidence: "low" },
      diagnostics: [{ code: "malformed_marker" }],
    });
  });

  it("rejects multiple top-level markers as one unknown candidate", () => {
    expect(
      classify("# Question: First\n\nApproval request: Run destructive action"),
    ).toMatchObject({
      candidate: { type: "unknown", confidence: "low" },
      diagnostics: [{ code: "multiple_markers" }],
    });
  });

  it("does not treat indented or embedded marker text as explicit authority", () => {
    expect(
      classify("Context\n  Approval request: Run destructive action"),
    ).toMatchObject({
      candidate: { type: "unknown", confidence: "low" },
      diagnostics: [{ code: "unrecognized_format" }],
    });
  });

  it("returns no candidate for whitespace-only stable content", () => {
    expect(classify(" \t\r\n  ")).toEqual({
      status: "none",
      boundary: "whole_source_v1",
      candidate: null,
      diagnostics: [
        {
          code: "blank_content",
          message: "The stable source contains only whitespace.",
        },
      ],
    });
  });

  it("binds deterministic identity to boundary, source ID, and content hash", () => {
    const first = classify("Question: One");
    const reconstructed = classify("Different retained text with same hash");
    const otherSource = classifyQueueItem({
      sourceId: "other-source",
      contentHash,
      text: "Question: One",
    });
    const otherHash = classifyQueueItem({
      sourceId: "needs-felix",
      contentHash: "c".repeat(64),
      text: "Question: One",
    });

    expect(first.candidate?.itemId).toMatch(/^[0-9a-f]{64}$/);
    expect(reconstructed.candidate?.itemId).toBe(first.candidate?.itemId);
    expect(otherSource.candidate?.itemId).not.toBe(first.candidate?.itemId);
    expect(otherHash.candidate?.itemId).not.toBe(first.candidate?.itemId);
  });

  it("treats controls, HTML, links, and commands only as unknown data", () => {
    const result = classify(
      "\u001b]8;;https://example.test\u0007click\u001b]8;;\u0007 <script>run()</script> `sudo reboot`",
    );

    expect(result).toMatchObject({
      candidate: { type: "unknown", confidence: "low" },
    });
    expect(JSON.stringify(result)).not.toContain("sudo");
    expect(JSON.stringify(result)).not.toContain("https://");
  });
});

function classify(text: string) {
  return classifyQueueItem({
    sourceId: "needs-felix",
    contentHash,
    text,
  });
}
