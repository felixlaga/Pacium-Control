import { describe, expect, it, vi } from "vitest";

import type { PaciumConfigObservation } from "@pacium/contracts";

import type { QueueFileReadResult } from "./queue-file-reader.js";
import { classifyQueueItem } from "./queue-item-classifier.js";
import {
  QueueObserver,
  type QueueDirectoryWatcher,
  type QueueWatchDirectory,
} from "./queue-observer.js";

const now = "2026-07-27T12:00:00.000Z";

describe("queue observer", () => {
  it("retains bounded text internally but publishes metadata only", async () => {
    const observer = new QueueObserver({
      now: () => now,
      readFile: () => Promise.resolve(stable("Question: Private decision")),
      watchDirectory: inertWatcher,
    });
    const snapshots: unknown[] = [];
    observer.subscribe((snapshot) => snapshots.push(snapshot));

    const snapshot = await observer.syncConfig(config());

    expect(snapshot).toMatchObject({
      status: "ready",
      workspaceRevision: 4,
      sources: [
        {
          sourceId: "needs-felix",
          status: "stable",
          observationRevision: 2,
          candidateFirstObservedAt: now,
          classification: {
            status: "candidate",
            candidate: {
              type: "question",
              confidence: "high",
            },
          },
        },
      ],
    });
    expect(snapshot.sources[0]).not.toHaveProperty("text");
    expect(observer.sourceText(4, "needs-felix")).toBe(
      "Question: Private decision",
    );
    expect(observer.sourceClassification(4, "needs-felix")).toEqual(
      snapshot.sources[0]?.classification,
    );
    expect(observer.sourceText(3, "needs-felix")).toBeNull();
    expect(JSON.stringify(snapshots)).not.toContain("Private decision");
    observer.dispose();
  });

  it("does not advance or publish duplicate evidence on refresh", async () => {
    const classifyItem = vi.fn(classifyQueueItem);
    const observer = new QueueObserver({
      classifyItem,
      now: () => now,
      readFile: () => Promise.resolve(stable("# Question: Choose")),
      watchDirectory: inertWatcher,
    });
    const subscriber = vi.fn();
    observer.subscribe(subscriber);
    await observer.syncConfig(config());
    subscriber.mockClear();

    const refreshed = await observer.refresh();

    expect(refreshed.sources[0]?.observationRevision).toBe(2);
    expect(classifyItem).toHaveBeenCalledTimes(1);
    expect(observer.sourceClassification(4, "needs-felix")).toMatchObject({
      candidate: { type: "question", confidence: "confirmed" },
    });
    expect(subscriber).not.toHaveBeenCalled();
    observer.dispose();
  });

  it("inspects only an exact current item identity", async () => {
    let content = "Question: Private decision λ";
    const observer = new QueueObserver({
      now: () => now,
      readFile: () => Promise.resolve(stable(content)),
      watchDirectory: inertWatcher,
    });
    const snapshot = await observer.syncConfig(config());
    const source = snapshot.sources[0]!;
    const candidate = source.classification?.candidate;
    if (source.contentHash === null || candidate == null) {
      throw new Error("Expected current queue candidate");
    }
    const identity = {
      workspaceRevision: snapshot.workspaceRevision!,
      sourceId: source.sourceId,
      observationRevision: source.observationRevision,
      contentHash: source.contentHash,
      itemId: candidate.itemId,
    };

    const ready = observer.inspectItem(identity);
    expect(ready).toMatchObject({
      status: "ready",
      ...identity,
      firstObservedAt: now,
      byteLength: new TextEncoder().encode(content).byteLength,
      encoding: "utf8_base64",
      error: null,
    });
    if (ready.status !== "ready") {
      throw new Error("Expected ready queue inspection");
    }
    expect(Buffer.from(ready.originalTextBase64, "base64").toString("utf8")).toBe(
      content,
    );

    content = "Review: Replacement";
    await observer.refresh();
    expect(observer.inspectItem(identity)).toMatchObject({
      status: "stale",
      originalTextBase64: null,
      error: { code: "ITEM_STALE" },
    });
    expect(
      observer.inspectItem({ ...identity, sourceId: "arbitrary-path" }),
    ).toMatchObject({
      status: "stale",
      originalTextBase64: null,
    });
    observer.dispose();
  });

  it("withholds item text while queue evidence is unavailable", () => {
    const observer = new QueueObserver({
      now: () => now,
      watchDirectory: inertWatcher,
    });
    expect(
      observer.inspectItem({
        workspaceRevision: 4,
        sourceId: "needs-felix",
        observationRevision: 2,
        contentHash: "a".repeat(64),
        itemId: "b".repeat(64),
      }),
    ).toMatchObject({
      status: "unavailable",
      originalTextBase64: null,
      error: { code: "QUEUE_UNAVAILABLE" },
    });
    observer.dispose();
  });

  it("debounces matching events and publishes changed evidence once", async () => {
    const hooks: { onEvent?: (filename: string | null) => void } = {};
    let content = "One";
    const observer = new QueueObserver({
      now: () => now,
      debounceMs: 1,
      readFile: () => Promise.resolve(stable(content)),
      watchDirectory: (_directory, event) => {
        hooks.onEvent = event;
        return { close: vi.fn() };
      },
    });
    const subscriber = vi.fn();
    observer.subscribe(subscriber);
    await observer.syncConfig(config());
    subscriber.mockClear();

    content = "Two";
    hooks.onEvent?.("NEEDS-FELIX");
    hooks.onEvent?.("NEEDS-FELIX");
    await wait(10);

    expect(observer.snapshot().sources[0]).toMatchObject({
      status: "stable",
      observationRevision: 3,
    });
    expect(observer.sourceText(4, "needs-felix")).toBe("Two");
    expect(observer.sourceClassification(4, "needs-felix")).toMatchObject({
      candidate: { type: "unknown", confidence: "low" },
    });
    expect(subscriber).toHaveBeenCalledTimes(1);
    observer.dispose();
  });

  it("discards a late read from a replaced configuration generation", async () => {
    const hooks: {
      resolveRead?: (result: QueueFileReadResult) => void;
    } = {};
    const observer = new QueueObserver({
      now: () => now,
      readFile: () =>
        new Promise((resolve) => {
          hooks.resolveRead = resolve;
        }),
      watchDirectory: inertWatcher,
    });
    const firstSync = observer.syncConfig(config());
    await wait(0);
    const replacement = observer.syncConfig({
      status: "unconfigured",
      revision: null,
      workspace: null,
      error: null,
    });
    hooks.resolveRead?.(stable("Stale question"));
    await firstSync;
    await replacement;

    expect(observer.snapshot().status).toBe("unconfigured");
    expect(observer.sourceText(4, "needs-felix")).toBeNull();
    expect(observer.sourceClassification(4, "needs-felix")).toBeNull();
    observer.dispose();
  });

  it("degrades all sources in a failed parent watcher and disposes handles", async () => {
    const hooks: { onError?: () => void } = {};
    const close = vi.fn();
    const watcher: QueueDirectoryWatcher = { close };
    const observer = new QueueObserver({
      now: () => now,
      readFile: () => Promise.resolve(stable("Question")),
      watchDirectory: (_directory, _event, error) => {
        hooks.onError = error;
        return watcher;
      },
    });
    await observer.syncConfig(config());

    hooks.onError?.();
    expect(observer.snapshot().sources[0]).toMatchObject({
      status: "watch_error",
      error: { code: "WATCH_FAILED" },
    });
    expect(observer.sourceText(4, "needs-felix")).toBeNull();
    expect(observer.sourceClassification(4, "needs-felix")).toBeNull();
    expect(close).toHaveBeenCalledTimes(1);
    observer.dispose();
  });
});

const inertWatcher: QueueWatchDirectory = () => ({ close: () => undefined });

function config(): PaciumConfigObservation {
  return {
    status: "ready",
    revision: 4,
    workspace: {
      id: "primary",
      label: "Pacium",
      repositories: [],
      roles: { meta: null, orchestrator: null },
      workers: [],
      queueSources: [
        {
          id: "needs-felix",
          label: "Needs Felix",
          path: "/configured/NEEDS-FELIX",
          format: "plain_text",
          requestingRole: "meta",
          deliveryMethodId: null,
        },
      ],
      deliveryMethods: [],
      context: { objective: null, plan: null },
    },
    error: null,
  };
}

function stable(text: string): QueueFileReadResult {
  return {
    status: text.length === 0 ? "empty" : "stable",
    byteLength: new TextEncoder().encode(text).byteLength,
    modifiedAt: now,
    contentHash:
      text.length === 0
        ? "0".repeat(64)
        : (text === "Two" ? "b" : "a").repeat(64),
    text,
    error: null,
  };
}

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}
