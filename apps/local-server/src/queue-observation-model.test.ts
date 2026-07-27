import { describe, expect, it } from "vitest";

import { classifyQueueItem } from "./queue-item-classifier.js";
import {
  applyQueueFileRead,
  pendingQueueSource,
  queueSourcesFromConfig,
  queueWatchFailure,
  readyQueueSources,
} from "./queue-observation-model.js";

const firstTime = "2026-07-27T12:00:00.000Z";
const secondTime = "2026-07-27T12:01:00.000Z";
const hash = "a".repeat(64);

describe("queue observation revision model", () => {
  it("starts each configured source pending with a process-local revision", () => {
    expect(pendingQueueSource(source(), firstTime)).toMatchObject({
      definition: { id: "needs-felix" },
      observation: {
        sourceId: "needs-felix",
        observationRevision: 1,
        status: "pending",
      },
      text: null,
    });
  });

  it("advances revision only when complete source evidence changes", () => {
    const pending = pendingQueueSource(source(), firstTime);
    const first = applyQueueFileRead(
      pending,
      stable("Question one"),
      firstTime,
      classification("Question one"),
    );
    expect(first.changed).toBe(true);
    expect(first.state.observation.observationRevision).toBe(2);

    const repeated = applyQueueFileRead(
      first.state,
      stable("Question one"),
      secondTime,
      classification("Question one"),
    );
    expect(repeated.changed).toBe(false);
    expect(repeated.state.observation.observationRevision).toBe(2);
    expect(repeated.state.observation.observedAt).toBe(secondTime);

    const changed = applyQueueFileRead(
      repeated.state,
      { ...stable("Question two"), contentHash: "b".repeat(64) },
      secondTime,
      classification("Question two", "b".repeat(64)),
    );
    expect(changed.changed).toBe(true);
    expect(changed.state.observation.observationRevision).toBe(3);
  });

  it("clears prior text and hash when current evidence degrades", () => {
    const stableState = applyQueueFileRead(
      pendingQueueSource(source(), firstTime),
      stable("Question"),
      firstTime,
      classification("Question"),
    ).state;
    const missing = applyQueueFileRead(
      stableState,
      {
        status: "missing",
        byteLength: null,
        modifiedAt: null,
        contentHash: null,
        text: null,
        error: null,
      },
      secondTime,
      null,
    );

    expect(missing.changed).toBe(true);
    expect(missing.state).toMatchObject({
      observation: {
        status: "missing",
        contentHash: null,
        observationRevision: 3,
      },
      text: null,
    });
  });

  it("turns watcher failure into bounded current evidence", () => {
    const failure = queueWatchFailure(
      pendingQueueSource(source(), firstTime),
      secondTime,
    );
    expect(failure.state).toMatchObject({
      observation: {
        status: "watch_error",
        observationRevision: 2,
        error: {
          code: "WATCH_FAILED",
        },
      },
      text: null,
    });
  });
});

describe("queue observation config projection", () => {
  it("preserves accepted queue source order in ready snapshots", () => {
    const projection = queueSourcesFromConfig(
      {
        status: "ready",
        revision: 4,
        workspace: {
          id: "primary",
          label: "Pacium",
          repositories: [],
          roles: { meta: null, orchestrator: null },
          workers: [],
          queueSources: [source(), source({ id: "review", label: "Review" })],
          deliveryMethods: [],
          context: { objective: null, plan: null },
        },
        error: null,
      },
      firstTime,
    );

    expect(projection.aggregate.workspaceRevision).toBe(4);
    expect(
      projection.aggregate.sources.map(({ sourceId }) => sourceId),
    ).toEqual(["needs-felix", "review"]);
  });

  it("keeps unavailable config free of source evidence", () => {
    expect(
      queueSourcesFromConfig(
        {
          status: "unconfigured",
          revision: null,
          workspace: null,
          error: null,
        },
        firstTime,
      ).aggregate,
    ).toMatchObject({
      status: "unconfigured",
      workspaceRevision: null,
      sources: [],
      error: null,
    });
    expect(
      queueSourcesFromConfig(
        {
          status: "error",
          revision: null,
          workspace: null,
          error: {
            code: "invalid_file",
            message: "Invalid config",
          },
        },
        firstTime,
      ).aggregate,
    ).toMatchObject({
      status: "config_error",
      workspaceRevision: null,
      sources: [],
      error: { code: "CONFIG_UNAVAILABLE" },
    });
  });

  it("builds complete content-free snapshots from runtime state", () => {
    const state = applyQueueFileRead(
      pendingQueueSource(source(), firstTime),
      stable("Question"),
      firstTime,
      classification("Question"),
    ).state;
    const aggregate = readyQueueSources(2, [state], secondTime);

    expect(aggregate.sources[0]).not.toHaveProperty("text");
    expect(aggregate).toMatchObject({
      status: "ready",
      workspaceRevision: 2,
      observedAt: secondTime,
    });
  });
});

function source(overrides: Partial<ReturnType<typeof sourceBase>> = {}) {
  return { ...sourceBase(), ...overrides };
}

function sourceBase() {
  return {
    id: "needs-felix",
    label: "Needs Felix",
    path: "/configured/NEEDS-FELIX",
    format: "plain_text" as const,
    requestingRole: "meta" as const,
    deliveryMethodId: null,
  };
}

function stable(text: string) {
  return {
    status: "stable" as const,
    byteLength: new TextEncoder().encode(text).byteLength,
    modifiedAt: firstTime,
    contentHash: hash,
    text,
    error: null,
  };
}

function classification(text: string, contentHash = hash) {
  return classifyQueueItem({
    sourceId: "needs-felix",
    contentHash,
    text,
  });
}
