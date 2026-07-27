import {
  MAX_APPLICATION_MESSAGE_BYTES,
  type ServerMessage,
} from "@pacium/contracts";
import { describe, expect, it } from "vitest";

import { boundRepositoryDiffResponse } from "./ws-hub.js";

type DiffResponse = Extract<ServerMessage, { type: "repository.diff" }>;

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
