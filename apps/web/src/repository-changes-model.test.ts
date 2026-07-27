import type { GitChangesObservation } from "@pacium/contracts";
import { describe, expect, it } from "vitest";

import {
  IDLE_REPOSITORY_CHANGES,
  acceptRepositoryChangesResponse,
  beginRepositoryChangesRequest,
  visibleRepositoryChanges,
} from "./repository-changes-model.js";

const observation: GitChangesObservation = {
  status: "ready",
  root: "/work/pacium",
  headCommit: "a".repeat(40),
  observedAt: "2026-07-27T10:00:00.000Z",
  files: [],
  totals: {
    fileCount: 0,
    additions: 0,
    deletions: 0,
    unavailableLineCount: 0,
    conflictCount: 0,
  },
  truncated: false,
  error: null,
};

describe("repository changes request state", () => {
  it("starts idle, retains prior evidence while refreshing, and accepts the matching response", () => {
    const loading = beginRepositoryChangesRequest(
      IDLE_REPOSITORY_CHANGES,
      "request-1",
    );
    expect(visibleRepositoryChanges(loading)).toBeNull();
    const loaded = acceptRepositoryChangesResponse(
      loading,
      "request-1",
      observation,
    );
    const refreshing = beginRepositoryChangesRequest(loaded, "request-2");
    expect(visibleRepositoryChanges(refreshing)).toBe(observation);
    expect(
      acceptRepositoryChangesResponse(refreshing, "request-2", observation),
    ).toMatchObject({ status: "loaded", requestId: "request-2" });
  });

  it("ignores stale and unsolicited responses", () => {
    const loading = beginRepositoryChangesRequest(
      IDLE_REPOSITORY_CHANGES,
      "new-request",
    );
    expect(
      acceptRepositoryChangesResponse(loading, "old-request", observation),
    ).toBe(loading);
    expect(
      acceptRepositoryChangesResponse(
        IDLE_REPOSITORY_CHANGES,
        "unsolicited",
        observation,
      ),
    ).toBe(IDLE_REPOSITORY_CHANGES);
  });
});
