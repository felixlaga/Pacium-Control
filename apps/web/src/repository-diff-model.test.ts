import type { GitDiffObservation } from "@pacium/contracts";
import { describe, expect, it } from "vitest";

import {
  IDLE_REPOSITORY_DIFF,
  acceptRepositoryDiffResponse,
  beginRepositoryDiffRequest,
  interruptRepositoryDiffRequest,
  repositoryDiffKey,
  visibleRepositoryDiff,
} from "./repository-diff-model.js";

const observation: GitDiffObservation = {
  status: "ready",
  root: "/work/pacium",
  headCommit: "a".repeat(40),
  path: "src/file.ts",
  previousPath: null,
  observedAt: "2026-07-27T10:00:00.000Z",
  sections: [
    {
      source: "combined",
      patch: "@@ -1 +1 @@\n-old\n+new\n",
      byteCount: 22,
      lineCount: 3,
    },
  ],
  patchBytes: 22,
  patchLines: 3,
  error: null,
};

describe("repository diff request state", () => {
  it("keys selection by session and path and accepts only the matching response", () => {
    const key = repositoryDiffKey("session-1", observation.path);
    expect(key).not.toBe(
      repositoryDiffKey("session-1", `x\0${observation.path}`),
    );
    const loading = beginRepositoryDiffRequest(
      IDLE_REPOSITORY_DIFF,
      "session-1",
      observation.path,
      "request-1",
    );
    expect(visibleRepositoryDiff(loading)).toBeNull();
    const loaded = acceptRepositoryDiffResponse(
      loading,
      "request-1",
      "session-1",
      observation,
    );
    expect(loaded).toMatchObject({
      status: "loaded",
      path: observation.path,
      observation,
    });
  });

  it("retains prior evidence while refreshing and after interruption", () => {
    const loading = beginRepositoryDiffRequest(
      IDLE_REPOSITORY_DIFF,
      "session-1",
      observation.path,
      "request-1",
    );
    const loaded = acceptRepositoryDiffResponse(
      loading,
      "request-1",
      "session-1",
      observation,
    );
    const refreshing = beginRepositoryDiffRequest(
      loaded,
      "session-1",
      observation.path,
      "request-2",
    );
    expect(visibleRepositoryDiff(refreshing)).toBe(observation);
    expect(interruptRepositoryDiffRequest(refreshing)).toMatchObject({
      status: "loaded",
      observation,
    });
    expect(interruptRepositoryDiffRequest(loading)).toBe(IDLE_REPOSITORY_DIFF);
  });

  it("ignores stale, cross-session, cross-path, and unsolicited responses", () => {
    const loading = beginRepositoryDiffRequest(
      IDLE_REPOSITORY_DIFF,
      "session-1",
      observation.path,
      "request-new",
    );
    expect(
      acceptRepositoryDiffResponse(
        loading,
        "request-old",
        "session-1",
        observation,
      ),
    ).toBe(loading);
    expect(
      acceptRepositoryDiffResponse(
        loading,
        "request-new",
        "session-2",
        observation,
      ),
    ).toBe(loading);
    expect(
      acceptRepositoryDiffResponse(loading, "request-new", "session-1", {
        ...observation,
        path: "src/other.ts",
      }),
    ).toBe(loading);
    expect(
      acceptRepositoryDiffResponse(
        IDLE_REPOSITORY_DIFF,
        "request-new",
        "session-1",
        observation,
      ),
    ).toBe(IDLE_REPOSITORY_DIFF);
  });
});
