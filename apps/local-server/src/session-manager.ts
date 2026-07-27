import { realpath, stat } from "node:fs/promises";
import { basename } from "node:path";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

import type { SerializeAddon as SerializeAddonInstance } from "@xterm/addon-serialize";
import type {
  ITerminalInitOnlyOptions,
  ITerminalOptions,
  Terminal as HeadlessTerminalInstance,
} from "@xterm/headless";
import {
  MAX_TERMINAL_SNAPSHOT_CHARS,
  type GitChangesObservation,
  type GitDiffObservation,
  type GitHistoryObservation,
  type LaunchPresetId,
  type RepositoryObservation,
  type SessionSummary,
  VerificationObservationSchema,
  type VerificationObservation,
  type VerificationRun,
} from "@pacium/contracts";

import type { LaunchPresetDefinition } from "./launch-presets.js";
import { inspectGitChanges, type GitChangesInspector } from "./git-changes.js";
import { inspectGitDiff, type GitDiffInspector } from "./git-diff.js";
import { inspectGitHistory, type GitHistoryInspector } from "./git-history.js";
import { HostActionError, type HostActions } from "./host-actions.js";
import type { PtyFactory, PtyProcess } from "./pty-adapter.js";
import {
  inspectRepositoryContext,
  type RepositoryInspector,
} from "./repository-context.js";
import { initialProviderObservation } from "./provider-observation.js";
import {
  verificationPresetsForRepository,
  type VerificationCatalog,
  type VerificationPresetDefinition,
} from "./verification-config.js";
import {
  VerificationRunnerError,
  type VerificationRunner,
} from "./verification-runner.js";

type SerializeAddonConstructor = new () => SerializeAddonInstance;
type HeadlessTerminalConstructor = new (
  options?: ITerminalOptions & ITerminalInitOnlyOptions,
) => HeadlessTerminalInstance;

const require = createRequire(import.meta.url);
const { SerializeAddon } = require("@xterm/addon-serialize") as {
  SerializeAddon: SerializeAddonConstructor;
};
const { Terminal: HeadlessTerminal } = require("@xterm/headless") as {
  Terminal: HeadlessTerminalConstructor;
};

interface ManagedSession {
  summary: SessionSummary;
  pty: PtyProcess;
  terminal: HeadlessTerminalInstance;
  serializer: SerializeAddonInstance;
  writeChain: Promise<void>;
  sequence: number;
  closeRequestId: string | undefined;
  forceTimer: NodeJS.Timeout | undefined;
}

export interface CreateSessionInput {
  displayName?: string;
  launchPreset: LaunchPresetId;
  cwd: string;
  cols: number;
  rows: number;
}

export interface SessionSnapshot {
  sessionId: string;
  epoch: number;
  sequence: number;
  data: string;
  cols: number;
  rows: number;
  truncated: boolean;
}

export interface TerminalDataEvent {
  sessionId: string;
  epoch: number;
  sequence: number;
  data: string;
}

export type SessionEvent =
  | { type: "updated"; session: SessionSummary }
  | { type: "exited"; session: SessionSummary }
  | { type: "closed"; sessionId: string; requestId?: string }
  | {
      type: "verification";
      sessionId: string;
      observation: VerificationObservation;
    };

export class SessionError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
  }
}

export class SessionManager {
  private readonly sessions = new Map<string, ManagedSession>();
  private readonly dataListeners = new Set<
    (event: TerminalDataEvent) => void
  >();
  private readonly sessionListeners = new Set<(event: SessionEvent) => void>();
  private readonly verificationRuns = new Map<string, VerificationRun>();
  private readonly unsubscribeVerification: (() => void) | undefined;

  public constructor(
    private readonly ptyFactory: PtyFactory,
    private readonly launchPresets: readonly LaunchPresetDefinition[],
    private readonly hostActions?: HostActions,
    private readonly inspectRepository: RepositoryInspector = (
      cwd,
      observedAt,
    ) =>
      observedAt === undefined
        ? inspectRepositoryContext(cwd)
        : inspectRepositoryContext(cwd, { observedAt }),
    private readonly gitChangesInspector: GitChangesInspector = (
      repository,
      observedAt,
    ) =>
      observedAt === undefined
        ? inspectGitChanges(repository)
        : inspectGitChanges(repository, { observedAt }),
    private readonly gitDiffInspector: GitDiffInspector = (
      repository,
      path,
      observedAt,
    ) =>
      observedAt === undefined
        ? inspectGitDiff(repository, path)
        : inspectGitDiff(repository, path, { observedAt }),
    private readonly gitHistoryInspector: GitHistoryInspector = (
      repository,
      observedAt,
    ) =>
      observedAt === undefined
        ? inspectGitHistory(repository)
        : inspectGitHistory(repository, { observedAt }),
    private readonly verificationCatalog: VerificationCatalog = {
      configured: false,
      repositories: [],
    },
    private readonly verificationRunner?: VerificationRunner,
  ) {
    this.unsubscribeVerification = verificationRunner?.onUpdate((event) => {
      const session = this.sessions.get(event.ownerId);
      if (session === undefined) {
        return;
      }
      this.verificationRuns.set(event.ownerId, event.run);
      this.emitSession({
        type: "verification",
        sessionId: event.ownerId,
        observation: this.buildVerificationObservation(session),
      });
    });
  }

  public list(): SessionSummary[] {
    return [...this.sessions.values()]
      .map(({ summary }) => ({ ...summary }))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  public hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  public hasLaunchPreset(launchPreset: LaunchPresetId): boolean {
    return this.launchPresets.some(({ id }) => id === launchPreset);
  }

  public async create(input: CreateSessionInput): Promise<SessionSummary> {
    const cwd = await this.validateCwd(input.cwd);
    const preset = this.requireAvailablePreset(input.launchPreset);
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const repository = await this.inspectRepository(cwd, createdAt);
    const displayName =
      input.displayName?.trim() ||
      (preset.id === "shell"
        ? basename(cwd) || preset.label
        : `${preset.label} — ${basename(cwd) || "Terminal"}`);
    const terminal = new HeadlessTerminal({
      cols: input.cols,
      rows: input.rows,
      scrollback: 2_000,
      allowProposedApi: true,
    });
    const serializer = new SerializeAddon();
    terminal.loadAddon(serializer);

    let pty: PtyProcess;
    try {
      pty = this.ptyFactory.create({
        executable: preset.executable,
        args: preset.args,
        cwd,
        cols: input.cols,
        rows: input.rows,
      });
    } catch (error) {
      terminal.dispose();
      throw new SessionError(
        "PTY_SPAWN_FAILED",
        error instanceof Error
          ? error.message
          : "The terminal process could not start",
        true,
      );
    }

    const session: ManagedSession = {
      summary: {
        id,
        epoch: 1,
        displayName,
        cwd,
        shell: preset.executable,
        launchPreset: preset.id,
        commandLabel: preset.label,
        agentClassification: {
          ...preset.classification,
          observedAt: createdAt,
        },
        providerObservation: initialProviderObservation(preset.id, createdAt),
        repository,
        runtime: "pty",
        processState: "live",
        pid: pty.pid,
        cols: input.cols,
        rows: input.rows,
        createdAt,
        exitedAt: null,
        exitCode: null,
        exitSignal: null,
      },
      pty,
      terminal,
      serializer,
      writeChain: Promise.resolve(),
      sequence: 0,
      closeRequestId: undefined,
      forceTimer: undefined,
    };

    this.sessions.set(id, session);

    pty.onData((data) => {
      this.handleData(session, data);
    });
    pty.onExit((event) => {
      this.handleExit(session, event.exitCode, event.signal);
    });

    return { ...session.summary };
  }

  public async snapshot(sessionId: string): Promise<SessionSnapshot> {
    const session = this.requireSession(sessionId);
    const targetWrite = session.writeChain;
    const targetSequence = session.sequence;
    await targetWrite;

    const attempts = [2_000, 500, 100, 0];
    let data = "";
    let truncated = false;
    for (const scrollback of attempts) {
      data = session.serializer.serialize({ scrollback });
      if (data.length <= MAX_TERMINAL_SNAPSHOT_CHARS) {
        truncated = scrollback < 2_000;
        break;
      }
    }

    if (data.length > MAX_TERMINAL_SNAPSHOT_CHARS) {
      data = data.slice(-MAX_TERMINAL_SNAPSHOT_CHARS);
      truncated = true;
    }

    return {
      sessionId,
      epoch: session.summary.epoch,
      sequence: targetSequence,
      data,
      cols: session.summary.cols,
      rows: session.summary.rows,
      truncated,
    };
  }

  public input(sessionId: string, data: string): void {
    const session = this.requireLiveSession(sessionId);
    session.pty.write(data);
  }

  public resize(sessionId: string, cols: number, rows: number): void {
    const session = this.requireLiveSession(sessionId);
    session.terminal.resize(cols, rows);
    session.pty.resize(cols, rows);
    session.summary = { ...session.summary, cols, rows };
    this.emitSession({ type: "updated", session: { ...session.summary } });
  }

  public interrupt(sessionId: string): void {
    const session = this.requireLiveSession(sessionId);
    session.pty.kill("SIGINT");
  }

  public rename(sessionId: string, displayName: string): void {
    const normalized = displayName.trim();
    if (normalized.length === 0 || normalized.length > 120) {
      throw new SessionError(
        "INVALID_DISPLAY_NAME",
        "Session names must contain between 1 and 120 characters.",
      );
    }
    const session = this.requireSession(sessionId);
    session.summary = { ...session.summary, displayName: normalized };
    this.emitSession({ type: "updated", session: { ...session.summary } });
  }

  public async revealRepository(sessionId: string): Promise<void> {
    const session = this.requireSession(sessionId);
    const repositoryRoot = session.summary.repository.root;
    if (repositoryRoot === null) {
      throw new SessionError(
        "SESSION_HAS_NO_REPOSITORY",
        "This terminal is not associated with a Git repository.",
      );
    }
    if (this.hostActions === undefined) {
      throw new SessionError(
        "REVEAL_UNSUPPORTED",
        "Revealing a repository is not supported on this Pacium host.",
      );
    }
    try {
      await this.hostActions.revealPath(repositoryRoot);
    } catch (error) {
      if (error instanceof HostActionError) {
        throw new SessionError(error.code, error.message, error.retryable);
      }
      throw new SessionError(
        "REVEAL_FAILED",
        "Pacium could not open the repository on the host.",
        true,
      );
    }
  }

  public async refreshRepository(
    sessionId: string,
  ): Promise<RepositoryObservation> {
    const session = this.requireSession(sessionId);
    const repository = await this.inspectRepository(
      session.summary.cwd,
      new Date().toISOString(),
    );
    session.summary = { ...session.summary, repository };
    this.emitSession({ type: "updated", session: { ...session.summary } });
    return repository;
  }

  public repositoryChanges(sessionId: string): Promise<GitChangesObservation> {
    const session = this.requireSession(sessionId);
    return this.gitChangesInspector(
      session.summary.repository,
      new Date().toISOString(),
    );
  }

  public repositoryDiff(
    sessionId: string,
    path: string,
  ): Promise<GitDiffObservation> {
    const session = this.requireSession(sessionId);
    return this.gitDiffInspector(
      session.summary.repository,
      path,
      new Date().toISOString(),
    );
  }

  public repositoryHistory(sessionId: string): Promise<GitHistoryObservation> {
    const session = this.requireSession(sessionId);
    return this.gitHistoryInspector(
      session.summary.repository,
      new Date().toISOString(),
    );
  }

  public repositoryVerification(sessionId: string): VerificationObservation {
    return this.buildVerificationObservation(this.requireSession(sessionId));
  }

  public async runRepositoryVerification(
    sessionId: string,
    presetId: string,
  ): Promise<VerificationObservation> {
    const session = this.requireSession(sessionId);
    const { root, presets } = this.requireVerificationRepository(session);
    const preset = presets.find((candidate) => candidate.id === presetId);
    if (preset === undefined) {
      throw new SessionError(
        "VERIFICATION_PRESET_UNAVAILABLE",
        "The selected verification preset is not configured for this repository.",
      );
    }
    if (this.verificationRunner === undefined) {
      throw new SessionError(
        "VERIFICATION_UNAVAILABLE",
        "Verification execution is not available on this Pacium server.",
      );
    }

    try {
      const run = await this.verificationRunner.start(sessionId, root, preset);
      this.verificationRuns.set(sessionId, run);
      return this.buildVerificationObservation(session);
    } catch (error) {
      throw mapVerificationRunnerError(error);
    }
  }

  public cancelRepositoryVerification(
    sessionId: string,
    runId: string,
  ): VerificationObservation {
    const session = this.requireSession(sessionId);
    if (this.verificationRunner === undefined) {
      throw new SessionError(
        "VERIFICATION_UNAVAILABLE",
        "Verification execution is not available on this Pacium server.",
      );
    }
    try {
      const run = this.verificationRunner.cancel(sessionId, runId);
      this.verificationRuns.set(sessionId, run);
      return this.buildVerificationObservation(session);
    } catch (error) {
      throw mapVerificationRunnerError(error);
    }
  }

  public close(sessionId: string, force: boolean, requestId: string): void {
    const session = this.requireSession(sessionId);

    if (session.summary.processState === "live" && !force) {
      throw new SessionError(
        "SESSION_LIVE",
        "The terminal process is still running. Confirm force close to terminate it.",
      );
    }

    if (session.summary.processState === "live") {
      session.summary = { ...session.summary, processState: "closing" };
      session.closeRequestId = requestId;
      this.emitSession({ type: "updated", session: { ...session.summary } });
      session.pty.kill("SIGTERM");
      session.forceTimer = setTimeout(() => {
        if (this.sessions.get(sessionId)?.summary.processState === "closing") {
          session.pty.kill("SIGKILL");
        }
      }, 1_500);
      session.forceTimer.unref();
      return;
    }

    this.removeSession(session, requestId);
  }

  public onTerminalData(
    listener: (event: TerminalDataEvent) => void,
  ): () => void {
    this.dataListeners.add(listener);
    return () => {
      this.dataListeners.delete(listener);
    };
  }

  public onSessionEvent(listener: (event: SessionEvent) => void): () => void {
    this.sessionListeners.add(listener);
    return () => {
      this.sessionListeners.delete(listener);
    };
  }

  public shutdown(): void {
    this.unsubscribeVerification?.();
    this.verificationRunner?.shutdown();
    for (const session of this.sessions.values()) {
      if (session.forceTimer !== undefined) {
        clearTimeout(session.forceTimer);
      }
      if (
        session.summary.processState === "live" ||
        session.summary.processState === "closing"
      ) {
        session.pty.kill("SIGHUP");
      }
      session.terminal.dispose();
    }
    this.sessions.clear();
  }

  private async validateCwd(input: string): Promise<string> {
    let cwd: string;
    try {
      cwd = await realpath(input);
      const info = await stat(cwd);
      if (!info.isDirectory()) {
        throw new Error("not a directory");
      }
    } catch {
      throw new SessionError(
        "INVALID_CWD",
        "The selected working directory does not exist or is not a directory.",
      );
    }
    return cwd;
  }

  private handleData(session: ManagedSession, data: string): void {
    for (const chunk of splitTerminalData(data)) {
      this.handleDataChunk(session, chunk);
    }
  }

  private handleDataChunk(session: ManagedSession, data: string): void {
    session.sequence += 1;
    const sequence = session.sequence;
    session.writeChain = session.writeChain.then(
      () =>
        new Promise<void>((resolve) => {
          session.terminal.write(data, resolve);
        }),
    );

    const event: TerminalDataEvent = {
      sessionId: session.summary.id,
      epoch: session.summary.epoch,
      sequence,
      data,
    };
    for (const listener of this.dataListeners) {
      listener(event);
    }
  }

  private handleExit(
    session: ManagedSession,
    exitCode: number,
    signal: number,
  ): void {
    if (!this.sessions.has(session.summary.id)) {
      return;
    }
    if (session.forceTimer !== undefined) {
      clearTimeout(session.forceTimer);
      session.forceTimer = undefined;
    }

    const exitedAt = new Date().toISOString();
    session.summary = {
      ...session.summary,
      processState: "exited",
      pid: null,
      exitedAt,
      exitCode,
      exitSignal: signal,
    };
    this.emitSession({ type: "exited", session: { ...session.summary } });

    if (session.closeRequestId !== undefined) {
      this.removeSession(session, session.closeRequestId);
    }
  }

  private removeSession(session: ManagedSession, requestId?: string): void {
    if (session.forceTimer !== undefined) {
      clearTimeout(session.forceTimer);
    }
    const verificationRun = this.verificationRunner?.activeRun(
      session.summary.id,
    );
    if (verificationRun !== null && verificationRun !== undefined) {
      try {
        this.verificationRunner?.cancel(
          session.summary.id,
          verificationRun.runId,
        );
      } catch {
        // Session removal remains authoritative if the run exited concurrently.
      }
    }
    this.verificationRuns.delete(session.summary.id);
    session.terminal.dispose();
    this.sessions.delete(session.summary.id);
    const event: SessionEvent =
      requestId === undefined
        ? { type: "closed", sessionId: session.summary.id }
        : { type: "closed", sessionId: session.summary.id, requestId };
    this.emitSession(event);
  }

  private requireSession(sessionId: string): ManagedSession {
    const session = this.sessions.get(sessionId);
    if (session === undefined) {
      throw new SessionError(
        "SESSION_NOT_FOUND",
        "Terminal session not found.",
      );
    }
    return session;
  }

  private requireAvailablePreset(
    id: LaunchPresetId,
  ): LaunchPresetDefinition & { executable: string } {
    const preset = this.launchPresets.find((candidate) => candidate.id === id);
    if (
      preset === undefined ||
      !preset.available ||
      preset.executable === null
    ) {
      throw new SessionError(
        "PRESET_UNAVAILABLE",
        preset?.unavailableReason ??
          "The selected launch preset is not available.",
      );
    }
    return { ...preset, executable: preset.executable };
  }

  private requireVerificationRepository(session: ManagedSession): {
    root: string;
    presets: readonly VerificationPresetDefinition[];
  } {
    if (!this.verificationCatalog.configured) {
      throw new SessionError(
        "VERIFICATION_UNCONFIGURED",
        "No verification configuration was supplied to this Pacium server.",
      );
    }
    const repository = session.summary.repository;
    if (repository.status !== "ready" || repository.root === null) {
      throw new SessionError(
        "VERIFICATION_REPOSITORY_UNAVAILABLE",
        "The selected terminal does not have ready repository evidence.",
        true,
      );
    }
    const presets = verificationPresetsForRepository(
      this.verificationCatalog,
      repository.root,
    );
    if (presets.length === 0) {
      throw new SessionError(
        "VERIFICATION_PRESET_UNAVAILABLE",
        "No verification presets are configured for this repository.",
      );
    }
    return { root: repository.root, presets };
  }

  private buildVerificationObservation(
    session: ManagedSession,
  ): VerificationObservation {
    const observedAt = new Date().toISOString();
    if (!this.verificationCatalog.configured) {
      return VerificationObservationSchema.parse({
        status: "unconfigured",
        configured: false,
        root: null,
        observedAt,
        presets: [],
        run: null,
        error: null,
      });
    }

    const repository = session.summary.repository;
    if (repository.status === "not_repository") {
      return VerificationObservationSchema.parse({
        status: "not_repository",
        configured: true,
        root: null,
        observedAt,
        presets: [],
        run: null,
        error: null,
      });
    }
    if (repository.status === "error" || repository.root === null) {
      return VerificationObservationSchema.parse({
        status: "error",
        configured: true,
        root: repository.root,
        observedAt,
        presets: [],
        run: null,
        error: {
          code: "repository_unavailable",
          message: "Repository evidence is unavailable for verification.",
        },
      });
    }

    const presets = verificationPresetsForRepository(
      this.verificationCatalog,
      repository.root,
    );
    if (presets.length === 0) {
      return VerificationObservationSchema.parse({
        status: "no_presets",
        configured: true,
        root: repository.root,
        observedAt,
        presets: [],
        run: null,
        error: null,
      });
    }
    const presetIds = new Set(presets.map(({ id }) => id));
    const latestRun = this.verificationRuns.get(session.summary.id) ?? null;
    return VerificationObservationSchema.parse({
      status: "ready",
      configured: true,
      root: repository.root,
      observedAt,
      presets: presets.map(publicVerificationPreset),
      run:
        latestRun !== null && presetIds.has(latestRun.presetId)
          ? latestRun
          : null,
      error: null,
    });
  }

  private requireLiveSession(sessionId: string): ManagedSession {
    const session = this.requireSession(sessionId);
    if (session.summary.processState !== "live") {
      throw new SessionError(
        "SESSION_NOT_LIVE",
        "The terminal process is not running.",
      );
    }
    return session;
  }

  private emitSession(event: SessionEvent): void {
    for (const listener of this.sessionListeners) {
      listener(event);
    }
  }
}

function publicVerificationPreset(
  preset: VerificationPresetDefinition,
): VerificationPresetDefinition {
  return {
    id: preset.id,
    label: preset.label,
    description: preset.description,
    executable: preset.executable,
    args: [...preset.args],
    timeoutMs: preset.timeoutMs,
  };
}

function mapVerificationRunnerError(error: unknown): SessionError {
  if (error instanceof VerificationRunnerError) {
    return new SessionError(error.code, error.message, error.retryable);
  }
  return new SessionError(
    "VERIFICATION_START_FAILED",
    "The configured verification process could not be started.",
    true,
  );
}

function splitTerminalData(data: string): string[] {
  const maximumCharacters = 32 * 1024;
  if (data.length <= maximumCharacters) {
    return [data];
  }

  const chunks: string[] = [];
  let start = 0;
  while (start < data.length) {
    let end = Math.min(start + maximumCharacters, data.length);
    const finalCodeUnit = data.charCodeAt(end - 1);
    if (
      end < data.length &&
      finalCodeUnit >= 0xd800 &&
      finalCodeUnit <= 0xdbff
    ) {
      end -= 1;
    }
    chunks.push(data.slice(start, end));
    start = end;
  }
  return chunks;
}
