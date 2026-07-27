import {
  MAX_APPLICATION_MESSAGE_BYTES,
  type ServerMessage,
} from "@pacium/contracts";
import { describe, expect, it } from "vitest";

import {
  boundRepositoryDiffResponse,
  boundRepositoryHistoryResponse,
} from "./ws-hub.js";

type DiffResponse = Extract<ServerMessage, { type: "repository.diff" }>;
type HistoryResponse = Extract<ServerMessage, { type: "repository.history" }>;

function response(patch: string): DiffResponse {
  const byteCount = new TextEncoder().encode(patch).byteLength;
  return {
    type: "repository.diff",
    requestId: "66bd01dc-a1c3-4341-9c3c-153027b7f098",
    sessionId: "5fe26a52-3f3c-41ef-8dba-6f93062eeec5",
    observation: {
      status: "ready",
      root: "/work/pacium",
      headCommit: "a".repeat(40),
      path: "src/file.ts",
      previousPath: null,
      observedAt: "2026-07-27T10:00:00.000Z",
      sections: [
        {
          source: "combined",
          patch,
          byteCount,
          lineCount: 1,
        },
      ],
      patchBytes: byteCount,
      patchLines: 1,
      error: null,
    },
  };
}

describe("outbound diff response bound", () => {
  it("preserves bounded responses and degrades excessive serialized JSON", () => {
    const small = response("@@ -1 +1 @@");
    expect(boundRepositoryDiffResponse(small)).toBe(small);

    const escaped = response("\\".repeat(64 * 1024));
    expect(Buffer.byteLength(JSON.stringify(escaped))).toBeGreaterThan(
      MAX_APPLICATION_MESSAGE_BYTES,
    );
    const bounded = boundRepositoryDiffResponse(escaped);
    expect(bounded.observation).toMatchObject({
      status: "too_large",
      sections: [],
      patchBytes: 0,
      patchLines: 0,
      error: null,
    });
    expect(Buffer.byteLength(JSON.stringify(bounded))).toBeLessThanOrEqual(
      MAX_APPLICATION_MESSAGE_BYTES,
    );
  });
});

describe("outbound history response bound", () => {
  it("preserves bounded responses and removes excessive commit evidence", () => {
    const small = historyResponse(1, 0, "Recent work");
    expect(boundRepositoryHistoryResponse(small)).toBe(small);

    const escaped = historyResponse(50, 16, "\\".repeat(1_000));
    expect(Buffer.byteLength(JSON.stringify(escaped))).toBeGreaterThan(
      MAX_APPLICATION_MESSAGE_BYTES,
    );
    const bounded = boundRepositoryHistoryResponse(escaped);
    expect(bounded.observation).toMatchObject({
      status: "error",
      commits: [],
      truncated: false,
      error: {
        code: "invalid_output",
        message: "Git returned invalid or excessive commit history.",
      },
    });
    expect(Buffer.byteLength(JSON.stringify(bounded))).toBeLessThanOrEqual(
      MAX_APPLICATION_MESSAGE_BYTES,
    );
  });
});

function historyResponse(
  commitCount: number,
  parentCount: number,
  subject: string,
): HistoryResponse {
  const commits = Array.from({ length: commitCount }, (_, index) => ({
    id: index.toString(16).padStart(40, "0"),
    parents: Array.from({ length: parentCount }, (__, parentIndex) =>
      (commitCount + index * parentCount + parentIndex)
        .toString(16)
        .padStart(40, "0"),
    ),
    authorName: "\\".repeat(200),
    authoredAt: "2026-07-27T11:00:00+02:00",
    subject,
  }));
  return {
    type: "repository.history",
    requestId: "66bd01dc-a1c3-4341-9c3c-153027b7f098",
    sessionId: "5fe26a52-3f3c-41ef-8dba-6f93062eeec5",
    observation: {
      status: "ready",
      root: "/work/pacium",
      headCommit: commits[0]?.id ?? "a".repeat(40),
      observedAt: "2026-07-27T11:00:00.000Z",
      commits,
      truncated: commitCount === 50,
      error: null,
    },
  };
}
