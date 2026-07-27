import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";

import { VerificationRunSchema, type VerificationRun } from "@pacium/contracts";

import type { VerificationPresetDefinition } from "./verification-config.js";
import {
  observeVerificationHead,
  type VerificationHeadObserver,
} from "./verification-head.js";
import { VerificationOutputCapture } from "./verification-output.js";
import {
  completeVerificationRun,
  type VerificationProcessCompletion,
  type VerificationTerminationReason,
} from "./verification-result.js";

const DEFAULT_MAX_CONCURRENT_RUNS = 2;
const DEFAULT_TERMINATION_GRACE_MS = 2_000;

export interface VerificationRunnerEvent {
  ownerId: string;
  run: VerificationRun;
}

export interface VerificationRunnerOptions {
  environment: Readonly<Record<string, string>>;
  maxConcurrentRuns?: number;
  terminationGraceMs?: number;
  observeHead?: VerificationHeadObserver;
  now?: () => Date;
  createRunId?: () => string;
}

interface ActiveVerificationProcess {
  ownerId: string;
  repositoryRoot: string;
  child: ChildProcess;
  run: VerificationRun;
  stdout: VerificationOutputCapture;
  stderr: VerificationOutputCapture;
  timeout: NodeJS.Timeout;
  forceTimer: NodeJS.Timeout | undefined;
  terminationReason: VerificationTerminationReason | null;
  terminationForced: boolean;
  finishing: boolean;
}

export class VerificationRunnerError extends Error {
  public constructor(
    public readonly code:
      | "VERIFICATION_BUSY"
      | "VERIFICATION_NOT_RUNNING"
      | "VERIFICATION_RUN_MISMATCH",
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
  }
}

export class VerificationRunner {
  private readonly activeByOwner = new Map<string, ActiveVerificationProcess>();
  private readonly pendingOwners = new Set<string>();
  private readonly listeners = new Set<
    (event: VerificationRunnerEvent) => void
  >();
  private readonly maxConcurrentRuns: number;
  private readonly terminationGraceMs: number;
  private readonly observeHead: VerificationHeadObserver;
  private readonly now: () => Date;
  private readonly createRunId: () => string;

  public constructor(private readonly options: VerificationRunnerOptions) {
    this.maxConcurrentRuns =
      options.maxConcurrentRuns ?? DEFAULT_MAX_CONCURRENT_RUNS;
    this.terminationGraceMs =
      options.terminationGraceMs ?? DEFAULT_TERMINATION_GRACE_MS;
    this.observeHead = options.observeHead ?? observeVerificationHead;
    this.now = options.now ?? (() => new Date());
    this.createRunId = options.createRunId ?? randomUUID;
  }

  public async start(
    ownerId: string,
    repositoryRoot: string,
    preset: VerificationPresetDefinition,
  ): Promise<VerificationRun> {
    this.reserve(ownerId);
    try {
      const headCommitAtStart = await this.observeHead(repositoryRoot);
      const startedAt = this.now().toISOString();
      const run = VerificationRunSchema.parse({
        runId: this.createRunId(),
        presetId: preset.id,
        status: "running",
        startedAt,
        completedAt: null,
        durationMs: null,
        headCommitAtStart,
        headCommitAtEnd: null,
        headComparison: null,
        exitCode: null,
        signal: null,
        terminationForced: false,
        stdout: "",
        stderr: "",
        stdoutTruncated: false,
        stderrTruncated: false,
        error: null,
      });
      const child = spawn(preset.executable, [...preset.args], {
        cwd: repositoryRoot,
        env: { ...this.options.environment },
        shell: false,
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      const active: ActiveVerificationProcess = {
        ownerId,
        repositoryRoot,
        child,
        run,
        stdout: new VerificationOutputCapture(),
        stderr: new VerificationOutputCapture(),
        timeout: setTimeout(() => {
          this.requestTermination(active, "timed_out");
        }, preset.timeoutMs),
        forceTimer: undefined,
        terminationReason: null,
        terminationForced: false,
        finishing: false,
      };
      active.timeout.unref();
      this.activeByOwner.set(ownerId, active);

      child.stdout?.on("data", (chunk: Uint8Array) => {
        active.stdout.append(chunk);
      });
      child.stderr?.on("data", (chunk: Uint8Array) => {
        active.stderr.append(chunk);
      });
      child.once("error", () => {
        void this.finish(active, {
          kind: "error",
          code: child.pid === undefined ? "spawn_failed" : "process_error",
          message:
            child.pid === undefined
              ? "The configured verification process could not be started."
              : "The verification process reported an execution error.",
        });
      });
      child.once("close", (exitCode, signal) => {
        void this.finish(active, {
          kind: "closed",
          exitCode,
          signal,
          terminationReason: active.terminationReason,
          terminationForced: active.terminationForced,
        });
      });

      this.emit({ ownerId, run });
      return { ...run };
    } finally {
      this.pendingOwners.delete(ownerId);
    }
  }

  public cancel(ownerId: string, runId: string): VerificationRun {
    const active = this.activeByOwner.get(ownerId);
    if (active === undefined || active.finishing) {
      throw new VerificationRunnerError(
        "VERIFICATION_NOT_RUNNING",
        "No verification process is currently running for this terminal.",
        false,
      );
    }
    if (active.run.runId !== runId) {
      throw new VerificationRunnerError(
        "VERIFICATION_RUN_MISMATCH",
        "The requested verification run is no longer active.",
        false,
      );
    }
    if (active.terminationReason === null) {
      active.run = VerificationRunSchema.parse({
        ...active.run,
        status: "cancelling",
      });
      this.requestTermination(active, "cancelled");
      this.emit({ ownerId, run: active.run });
    }
    return { ...active.run };
  }

  public activeRun(ownerId: string): VerificationRun | null {
    const active = this.activeByOwner.get(ownerId);
    return active === undefined ? null : { ...active.run };
  }

  public onUpdate(
    listener: (event: VerificationRunnerEvent) => void,
  ): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public shutdown(): void {
    for (const active of this.activeByOwner.values()) {
      active.finishing = true;
      clearTimeout(active.timeout);
      if (active.forceTimer !== undefined) {
        clearTimeout(active.forceTimer);
      }
      this.signalProcessGroup(active.child, "SIGKILL");
    }
    this.activeByOwner.clear();
    this.pendingOwners.clear();
  }

  private reserve(ownerId: string): void {
    if (this.activeByOwner.has(ownerId) || this.pendingOwners.has(ownerId)) {
      throw new VerificationRunnerError(
        "VERIFICATION_BUSY",
        "This terminal already has an active verification run.",
        true,
      );
    }
    if (
      this.activeByOwner.size + this.pendingOwners.size >=
      this.maxConcurrentRuns
    ) {
      throw new VerificationRunnerError(
        "VERIFICATION_BUSY",
        "Pacium is already running the maximum number of verification checks.",
        true,
      );
    }
    this.pendingOwners.add(ownerId);
  }

  private requestTermination(
    active: ActiveVerificationProcess,
    reason: VerificationTerminationReason,
  ): void {
    if (active.finishing || active.terminationReason !== null) {
      return;
    }
    active.terminationReason = reason;
    this.signalProcessGroup(active.child, "SIGTERM");
    active.forceTimer = setTimeout(() => {
      if (!active.finishing) {
        active.terminationForced = true;
        this.signalProcessGroup(active.child, "SIGKILL");
      }
    }, this.terminationGraceMs);
    active.forceTimer.unref();
  }

  private async finish(
    active: ActiveVerificationProcess,
    completion: VerificationProcessCompletion,
  ): Promise<void> {
    if (active.finishing) {
      return;
    }
    active.finishing = true;
    clearTimeout(active.timeout);
    if (active.forceTimer !== undefined) {
      clearTimeout(active.forceTimer);
    }

    const completedAt = this.now().toISOString();
    const headCommitAtEnd = await this.observeHead(active.repositoryRoot);
    const run = completeVerificationRun({
      activeRun: active.run,
      completion,
      completedAt,
      headCommitAtEnd,
      stdout: active.stdout.finish(),
      stderr: active.stderr.finish(),
    });
    this.activeByOwner.delete(active.ownerId);
    this.emit({ ownerId: active.ownerId, run });
  }

  private signalProcessGroup(
    child: ChildProcess,
    signal: NodeJS.Signals,
  ): void {
    if (child.pid !== undefined) {
      try {
        process.kill(-child.pid, signal);
        return;
      } catch {
        // The process may have exited between observation and signalling.
      }
    }
    try {
      child.kill(signal);
    } catch {
      // The close/error event remains the source of final process evidence.
    }
  }

  private emit(event: VerificationRunnerEvent): void {
    for (const listener of this.listeners) {
      listener({ ownerId: event.ownerId, run: { ...event.run } });
    }
  }
}
