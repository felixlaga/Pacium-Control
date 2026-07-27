import { watch } from "node:fs";
import { basename, dirname } from "node:path";

import type {
  PaciumConfigObservation,
  QueueItemInspection,
  QueueItemInspectionIdentity,
  QueueSourceClassification,
  QueueSourcesObservation,
} from "@pacium/contracts";
import { queueItemInspectionError } from "@pacium/contracts";

import {
  applyQueueFileRead,
  queueSourcesFromConfig,
  queueWatchFailure,
  readyQueueSources,
  type QueueSourceRuntimeState,
} from "./queue-observation-model.js";
import {
  readStableQueueFile,
  type QueueFileReadResult,
} from "./queue-file-reader.js";
import {
  classifyQueueItem,
  type QueueItemClassifierInput,
} from "./queue-item-classifier.js";

export interface QueueDirectoryWatcher {
  close(): void;
}

export type QueueWatchDirectory = (
  directory: string,
  onEvent: (filename: string | null) => void,
  onError: () => void,
) => QueueDirectoryWatcher;

export interface QueueObserverOptions {
  readFile?: (path: string) => Promise<QueueFileReadResult>;
  watchDirectory?: QueueWatchDirectory;
  now?: () => string;
  debounceMs?: number;
  retryDelayMs?: number;
  classifyItem?: (input: QueueItemClassifierInput) => QueueSourceClassification;
}

const NODE_WATCH_DIRECTORY: QueueWatchDirectory = (
  directory,
  onEvent,
  onError,
) => {
  const watcher = watch(directory, (_eventType, filename) => {
    onEvent(filename === null ? null : filename.toString());
  });
  watcher.on("error", onError);
  return watcher;
};

export class QueueObserver {
  private aggregate: QueueSourcesObservation;
  private readonly debounceMs: number;
  private readonly classifyItem: (
    input: QueueItemClassifierInput,
  ) => QueueSourceClassification;
  private disposed = false;
  private generation = 0;
  private readonly now: () => string;
  private readonly readFile: (path: string) => Promise<QueueFileReadResult>;
  private readonly readSequences = new Map<string, number>();
  private readonly retryDelayMs: number;
  private readonly states = new Map<string, QueueSourceRuntimeState>();
  private readonly subscribers = new Set<
    (observation: QueueSourcesObservation) => void
  >();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly watchDirectory: QueueWatchDirectory;
  private readonly watchers = new Map<string, QueueDirectoryWatcher>();
  private workspaceRevision: number | null = null;

  public constructor(options: QueueObserverOptions = {}) {
    this.readFile = options.readFile ?? readStableQueueFile;
    this.classifyItem = options.classifyItem ?? classifyQueueItem;
    this.watchDirectory = options.watchDirectory ?? NODE_WATCH_DIRECTORY;
    this.now = options.now ?? (() => new Date().toISOString());
    this.debounceMs = options.debounceMs ?? 200;
    this.retryDelayMs = options.retryDelayMs ?? 25;
    this.aggregate = {
      status: "unconfigured",
      workspaceRevision: null,
      observedAt: this.now(),
      sources: [],
      error: null,
    };
  }

  public snapshot(): QueueSourcesObservation {
    return this.aggregate;
  }

  public subscribe(
    subscriber: (observation: QueueSourcesObservation) => void,
  ): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  public sourceText(
    workspaceRevision: number,
    sourceId: string,
  ): string | null {
    if (workspaceRevision !== this.workspaceRevision) {
      return null;
    }
    return this.states.get(sourceId)?.text ?? null;
  }

  public sourceClassification(
    workspaceRevision: number,
    sourceId: string,
  ): QueueSourceClassification | null {
    if (workspaceRevision !== this.workspaceRevision) {
      return null;
    }
    return this.states.get(sourceId)?.classification ?? null;
  }

  public inspectItem(
    identity: QueueItemInspectionIdentity,
  ): QueueItemInspection {
    const sourceState = this.states.get(identity.sourceId);
    const sourceObservedAt =
      sourceState?.observation.observedAt ?? this.aggregate.observedAt;
    const common = {
      ...identity,
      sourceObservedAt,
    };
    if (this.aggregate.status !== "ready" || this.disposed) {
      return {
        status: "unavailable",
        ...common,
        firstObservedAt: null,
        byteLength: null,
        encoding: null,
        originalTextBase64: null,
        error: queueItemInspectionError("QUEUE_UNAVAILABLE"),
      };
    }

    const observation = sourceState?.observation;
    const candidate = sourceState?.classification?.candidate ?? null;
    const current =
      identity.workspaceRevision === this.workspaceRevision &&
      observation?.status === "stable" &&
      observation.observationRevision === identity.observationRevision &&
      observation.contentHash === identity.contentHash &&
      candidate?.itemId === identity.itemId;
    if (!current) {
      return {
        status: "stale",
        ...common,
        firstObservedAt: null,
        byteLength: null,
        encoding: null,
        originalTextBase64: null,
        error: queueItemInspectionError("ITEM_STALE"),
      };
    }

    if (
      sourceState?.text === null ||
      sourceState?.text === undefined ||
      observation.byteLength === null ||
      observation.candidateFirstObservedAt === null
    ) {
      return {
        status: "unavailable",
        ...common,
        firstObservedAt: null,
        byteLength: null,
        encoding: null,
        originalTextBase64: null,
        error: queueItemInspectionError("QUEUE_UNAVAILABLE"),
      };
    }

    return {
      status: "ready",
      ...common,
      firstObservedAt: observation.candidateFirstObservedAt,
      byteLength: observation.byteLength,
      encoding: "utf8_base64",
      originalTextBase64: Buffer.from(sourceState.text, "utf8").toString(
        "base64",
      ),
      error: null,
    };
  }

  public async syncConfig(
    config: PaciumConfigObservation,
  ): Promise<QueueSourcesObservation> {
    if (this.disposed) {
      return this.aggregate;
    }
    if (
      config.status === "ready" &&
      config.revision === this.workspaceRevision
    ) {
      return this.refresh();
    }

    this.generation += 1;
    this.clearResources();
    this.states.clear();
    this.readSequences.clear();
    const projected = queueSourcesFromConfig(config, this.now());
    this.aggregate = projected.aggregate;
    this.workspaceRevision = projected.aggregate.workspaceRevision;
    for (const state of projected.states) {
      this.states.set(state.definition.id, state);
    }
    if (projected.aggregate.status !== "ready") {
      this.publish();
      return this.aggregate;
    }

    this.startWatchers();
    if (this.states.size === 0) {
      this.publish();
      return this.aggregate;
    }
    await this.refresh();
    return this.aggregate;
  }

  public async refresh(): Promise<QueueSourcesObservation> {
    if (
      this.disposed ||
      this.workspaceRevision === null ||
      this.aggregate.status !== "ready"
    ) {
      return this.aggregate;
    }
    const generation = this.generation;
    const changed = (
      await Promise.all(
        [...this.states.keys()].map((sourceId) =>
          this.observeSource(sourceId, generation),
        ),
      )
    ).some(Boolean);
    this.rebuildAggregate();
    if (changed) {
      this.publish();
    }
    return this.aggregate;
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.generation += 1;
    this.clearResources();
    this.states.clear();
    this.readSequences.clear();
    this.subscribers.clear();
  }

  private startWatchers(): void {
    const directories = new Set(
      [...this.states.values()].map(({ definition }) =>
        dirname(definition.path),
      ),
    );
    for (const directory of directories) {
      try {
        const watcher = this.watchDirectory(
          directory,
          (filename) => this.handleWatchEvent(directory, filename),
          () => this.handleWatchError(directory),
        );
        this.watchers.set(directory, watcher);
      } catch {
        this.handleWatchError(directory);
      }
    }
  }

  private handleWatchEvent(directory: string, filename: string | null): void {
    for (const state of this.states.values()) {
      if (
        dirname(state.definition.path) === directory &&
        (filename === null || basename(state.definition.path) === filename)
      ) {
        this.schedule(state.definition.id);
      }
    }
  }

  private handleWatchError(directory: string): void {
    let changed = false;
    const observedAt = this.now();
    for (const [sourceId, state] of this.states) {
      if (dirname(state.definition.path) !== directory) {
        continue;
      }
      this.cancelScheduled(sourceId);
      this.readSequences.set(
        sourceId,
        (this.readSequences.get(sourceId) ?? 0) + 1,
      );
      const transition = queueWatchFailure(state, observedAt);
      this.states.set(sourceId, transition.state);
      changed ||= transition.changed;
    }
    this.watchers.get(directory)?.close();
    this.watchers.delete(directory);
    if (changed) {
      this.rebuildAggregate();
      this.publish();
    }
  }

  private schedule(sourceId: string): void {
    this.cancelScheduled(sourceId);
    const generation = this.generation;
    this.timers.set(
      sourceId,
      setTimeout(() => {
        this.timers.delete(sourceId);
        void this.observeSource(sourceId, generation).then((changed) => {
          if (changed) {
            this.rebuildAggregate();
            this.publish();
          }
        });
      }, this.debounceMs),
    );
  }

  private async observeSource(
    sourceId: string,
    generation: number,
  ): Promise<boolean> {
    const initial = this.states.get(sourceId);
    if (
      initial === undefined ||
      this.disposed ||
      generation !== this.generation
    ) {
      return false;
    }
    const sequence = (this.readSequences.get(sourceId) ?? 0) + 1;
    this.readSequences.set(sourceId, sequence);
    let result = await this.readFile(initial.definition.path);
    for (
      let attempt = 0;
      result.status === "changing" && attempt < 2;
      attempt++
    ) {
      await delay(this.retryDelayMs);
      if (
        this.disposed ||
        generation !== this.generation ||
        this.readSequences.get(sourceId) !== sequence
      ) {
        return false;
      }
      result = await this.readFile(initial.definition.path);
    }
    if (
      this.disposed ||
      generation !== this.generation ||
      this.readSequences.get(sourceId) !== sequence
    ) {
      return false;
    }
    const current = this.states.get(sourceId);
    if (current === undefined) {
      return false;
    }
    const classification = this.classificationFor(current, result);
    const transition = applyQueueFileRead(
      current,
      result,
      this.now(),
      classification,
    );
    this.states.set(sourceId, transition.state);
    return transition.changed;
  }

  private classificationFor(
    current: QueueSourceRuntimeState,
    result: QueueFileReadResult,
  ): QueueSourceClassification | null {
    if (
      result.status !== "stable" ||
      result.contentHash === null ||
      result.text === null
    ) {
      return null;
    }
    if (
      current.observation.status === "stable" &&
      current.observation.contentHash === result.contentHash &&
      current.classification !== null
    ) {
      return current.classification;
    }
    return this.classifyItem({
      sourceId: current.definition.id,
      contentHash: result.contentHash,
      text: result.text,
    });
  }

  private rebuildAggregate(): void {
    if (this.workspaceRevision === null) {
      return;
    }
    this.aggregate = readyQueueSources(
      this.workspaceRevision,
      [...this.states.values()],
      this.now(),
    );
  }

  private publish(): void {
    if (this.disposed) {
      return;
    }
    for (const subscriber of this.subscribers) {
      subscriber(this.aggregate);
    }
  }

  private cancelScheduled(sourceId: string): void {
    const timer = this.timers.get(sourceId);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(sourceId);
    }
  }

  private clearResources(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
  }
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}
