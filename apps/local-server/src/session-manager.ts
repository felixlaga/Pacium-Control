import { realpath, stat } from "node:fs/promises";
import { basename } from "node:path";
import { randomUUID } from "node:crypto";

import {
  SerializeAddon,
  type SerializeAddon as SerializeAddonInstance,
} from "@xterm/addon-serialize";
import * as HeadlessTerminalModule from "@xterm/headless";
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
  RELAUNCH_MANIFEST_SCHEMA_VERSION,
  type RepositoryObservation,
  type RelaunchManifest,
  type SessionSummary,
  type TmuxTarget,
  VerificationObservationSchema,
  type VerificationObservation,
  type VerificationRun,
} from "@pacium/contracts";

import type { LaunchPresetDefinition } from "./launch-presets.js";
import type { ClaudeObserver } from "./claude-observer.js";
import type { CodexObserver } from "./codex-observer.js";
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
import type { RelaunchManifestStore } from "./relaunch-manifest-store.js";
import type { TmuxAdapter, TmuxAttachSpec } from "./tmux-adapter.js";
import {
  verificationPresetsForRepository,
  type VerificationCatalog,
  type VerificationPresetDefinition,
} from "./verification-config.js";
import {
  VerificationRunnerError,
  type VerificationRunner,
} from "./verification-runner.js";

type HeadlessTerminalConstructor = new (
  options?: ITerminalOptions & ITerminalInitOnlyOptions,
) => HeadlessTerminalInstance;

const { Terminal: HeadlessTerminal } = (
  HeadlessTerminalModule as unknown as {
    default: { Terminal: HeadlessTerminalConstructor };
  }
).default;

interface ManagedSession {
  summary: SessionSummary;
  pty: PtyProcess;
  ptySubscriptions: Array<{ dispose(): void }>;
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
  predecessorSessionId?: string;
  keepAlive?: boolean;
  tmux?: TmuxAttachSpec;
  retainedKeepAliveManifest?: RelaunchManifest;
}

export interface TmuxRestoreResult {
  attempted: number;
  restored: number;
  unavailable: number;
  deferred: number;
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
  private static readonly MAX_STARTUP_TMUX_REATTACHMENTS = 20;
  private readonly sessions = new Map<string, ManagedSession>();
  private readonly dataListeners = new Set<
    (event: TerminalDataEvent) => void
  >();
  private readonly sessionListeners = new Set<(event: SessionEvent) => void>();
  private readonly verificationRuns = new Map<string, VerificationRun>();
  private readonly unsubscribeVerification: (() => void) | undefined;
  private readonly unsubscribeClaudeObserver: (() => void) | undefined;
  private readonly unsubscribeCodexObserver: (() => void) | undefined;

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
    private readonly claudeObserver?: ClaudeObserver,
    private readonly codexObserver?: CodexObserver,
    private readonly relaunchManifests?: RelaunchManifestStore,
    private readonly environmentKeys: readonly string[] = [],
    private readonly tmuxAdapter?: TmuxAdapter,
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
    this.unsubscribeClaudeObserver = claudeObserver?.onUpdate(
      (sessionId, observation) => {
        const session = this.sessions.get(sessionId);
        if (
          session === undefined ||
          session.summary.launchPreset !== "claude"
        ) {
          return;
        }
        session.summary = {
          ...session.summary,
          providerObservation: observation,
        };
        this.emitSession({ type: "updated", session: { ...session.summary } });
        void this.retainResumeReference(session, observation);
      },
    );
    this.unsubscribeCodexObserver = codexObserver?.onUpdate(
      (sessionId, observation) => {
        const session = this.sessions.get(sessionId);
        if (session === undefined || session.summary.launchPreset !== "codex") {
          return;
        }
        session.summary = {
          ...session.summary,
          providerObservation: observation,
        };
        this.emitSession({ type: "updated", session: { ...session.summary } });
        void this.retainResumeReference(session, observation);
      },
    );
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

  public async flushRelaunchManifests(): Promise<void> {
    await this.relaunchManifests?.settle();
  }

  public listRelaunchManifests(): RelaunchManifest[] {
    if (this.relaunchManifests !== undefined) {
      return this.relaunchManifests.list();
    }
    return [...this.sessions.values()]
      .flatMap(({ summary }) =>
        summary.relaunchManifest === undefined
          ? []
          : [structuredClone(summary.relaunchManifest)],
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  public async relaunch(
    manifestId: string,
    cols: number,
    rows: number,
  ): Promise<SessionSummary> {
    const manifest =
      this.relaunchManifests?.get(manifestId) ??
      [...this.sessions.values()]
        .flatMap(({ summary }) =>
          summary.relaunchManifest === undefined
            ? []
            : [summary.relaunchManifest],
        )
        .find(({ id }) => id === manifestId) ??
      null;
    if (manifest === null) {
      throw new SessionError(
        "RELAUNCH_MANIFEST_NOT_FOUND",
        "The retained relaunch manifest no longer exists.",
      );
    }
    const tmuxTarget = manifest.tmuxTarget ?? null;
    if (manifest.runtime === "tmux" && tmuxTarget !== null) {
      if (manifest.tmuxMode === "keep_alive") {
        return this.reattachKeepAliveManifest(manifest, cols, rows);
      }
      return this.attachTmux(
        tmuxTarget.serverId,
        tmuxTarget.sessionId,
        cols,
        rows,
        manifest.sessionId,
      );
    }
    return this.create({
      displayName: manifest.displayName,
      launchPreset: manifest.launchPreset,
      cwd: manifest.cwd,
      cols,
      rows,
      predecessorSessionId: manifest.sessionId,
    });
  }

  public async discoverTmux() {
    if (this.tmuxAdapter === undefined) {
      throw new SessionError(
        "TMUX_UNCONFIGURED",
        "No optional tmux socket is configured.",
      );
    }
    return this.tmuxAdapter.discover();
  }

  public tmuxCapability() {
    return (
      this.tmuxAdapter?.capability() ?? {
        state: "unconfigured" as const,
        serverId: null,
        executable: null,
        version: null,
        detail: "No optional tmux socket is configured.",
      }
    );
  }

  public async attachTmux(
    serverId: string,
    sessionId: string,
    cols: number,
    rows: number,
    predecessorSessionId?: string,
  ): Promise<SessionSummary> {
    if (this.tmuxAdapter === undefined) {
      throw new SessionError(
        "TMUX_UNCONFIGURED",
        "No optional tmux socket is configured.",
      );
    }
    let spec: TmuxAttachSpec;
    try {
      spec = await this.tmuxAdapter.attachSpec(serverId, sessionId);
    } catch (error) {
      throw new SessionError(
        "TMUX_TARGET_UNAVAILABLE",
        error instanceof Error
          ? error.message
          : "The selected tmux target is unavailable.",
        true,
      );
    }
    return this.create({
      displayName: spec.target.sessionName,
      launchPreset: "shell",
      cwd: spec.cwd,
      cols,
      rows,
      ...(predecessorSessionId === undefined ? {} : { predecessorSessionId }),
      tmux: spec,
    });
  }

  public async restoreKeepAliveSessions(
    cols = 100,
    rows = 30,
  ): Promise<TmuxRestoreResult> {
    const candidates = this.listRelaunchManifests().filter(
      (manifest) =>
        manifest.runtime === "tmux" &&
        manifest.tmuxMode === "keep_alive" &&
        (manifest.tmuxTarget ?? null) !== null,
    );
    const activeTargets = new Set(
      [...this.sessions.values()].flatMap(({ summary }) =>
        summary.runtime === "tmux" && summary.tmuxTarget != null
          ? [tmuxTargetKey(summary.tmuxTarget)]
          : [],
      ),
    );
    const selected: RelaunchManifest[] = [];
    const selectedTargets = new Set<string>();
    for (const manifest of candidates) {
      const target = manifest.tmuxTarget;
      if (target === null || target === undefined) {
        continue;
      }
      const key = tmuxTargetKey(target);
      if (activeTargets.has(key) || selectedTargets.has(key)) {
        continue;
      }
      selectedTargets.add(key);
      selected.push(manifest);
    }
    const attempted = Math.min(
      selected.length,
      SessionManager.MAX_STARTUP_TMUX_REATTACHMENTS,
    );
    let restored = 0;
    for (const manifest of selected.slice(0, attempted)) {
      try {
        await this.reattachKeepAliveManifest(manifest, cols, rows);
        restored += 1;
      } catch {
        // The retained manifest remains the recovery evidence. Startup never
        // reruns a missing target or its command.
      }
    }
    return {
      attempted,
      restored,
      unavailable: attempted - restored,
      deferred: Math.max(0, selected.length - attempted),
    };
  }

  private async launchKeepAlivePreset(
    cwd: string,
    preset: LaunchPresetDefinition & { executable: string },
    cols: number,
    rows: number,
  ): Promise<TmuxAttachSpec> {
    if (this.tmuxAdapter === undefined) {
      throw new SessionError(
        "TMUX_UNCONFIGURED",
        "No optional tmux socket is configured. The direct terminal was not launched.",
      );
    }
    try {
      return await this.tmuxAdapter.launchSpec({
        sessionName: `pacium-${randomUUID()}`,
        cwd,
        cols,
        rows,
        executable: preset.executable,
        args: preset.args,
      });
    } catch (error) {
      throw new SessionError(
        "TMUX_KEEP_ALIVE_FAILED",
        error instanceof Error
          ? error.message
          : "The tmux keep-alive target could not be created.",
        true,
      );
    }
  }

  private async reattachKeepAliveManifest(
    manifest: RelaunchManifest,
    cols: number,
    rows: number,
  ): Promise<SessionSummary> {
    const target = manifest.tmuxTarget;
    if (
      this.tmuxAdapter === undefined ||
      target === null ||
      target === undefined ||
      manifest.tmuxMode !== "keep_alive"
    ) {
      throw new SessionError(
        "TMUX_TARGET_UNAVAILABLE",
        "The retained keep-alive target is unavailable.",
        true,
      );
    }
    let attached: TmuxAttachSpec;
    try {
      attached = await this.tmuxAdapter.attachSpec(
        target.serverId,
        target.sessionId,
      );
    } catch (error) {
      throw new SessionError(
        "TMUX_TARGET_UNAVAILABLE",
        error instanceof Error
          ? error.message
          : "The retained keep-alive target is unavailable.",
        true,
      );
    }
    return this.create({
      displayName: manifest.displayName,
      launchPreset: manifest.launchPreset,
      cwd: manifest.cwd,
      cols,
      rows,
      predecessorSessionId: manifest.sessionId,
      tmux: {
        ...attached,
        mode: "keep_alive",
        launchCommand: manifest.command,
      },
      retainedKeepAliveManifest: manifest,
    });
  }

  public async create(input: CreateSessionInput): Promise<SessionSummary> {
    const cwd = await this.validateCwd(input.cwd);
    const preset =
      input.retainedKeepAliveManifest === undefined
        ? this.requireAvailablePreset(input.launchPreset)
        : {
            ...this.requireKnownPreset(input.launchPreset),
            executable: input.retainedKeepAliveManifest.command.executable,
          };
    if (input.keepAlive === true && input.tmux !== undefined) {
      throw new SessionError(
        "INVALID_TMUX_LAUNCH",
        "A session cannot request and supply a tmux target together.",
      );
    }
    const tmux =
      input.keepAlive === true
        ? await this.launchKeepAlivePreset(cwd, preset, input.cols, input.rows)
        : input.tmux;
    const tmuxMode = tmux?.mode ?? (tmux === undefined ? null : "attached");
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const repository = await this.inspectRepository(cwd, createdAt);
    const displayName =
      (tmux === undefined || tmuxMode === "keep_alive"
        ? input.displayName?.trim()
        : tmux.target.sessionName) ||
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
    let claudePreparation: ReturnType<ClaudeObserver["prepare"]> | undefined;
    if (
      tmux === undefined &&
      preset.id === "claude" &&
      this.claudeObserver !== undefined
    ) {
      try {
        claudePreparation = this.claudeObserver.prepare(id, createdAt);
      } catch {
        this.claudeObserver.release(id);
      }
    }
    let codexPreparation: ReturnType<CodexObserver["prepare"]> | undefined;
    if (
      tmux === undefined &&
      preset.id === "codex" &&
      this.codexObserver !== undefined
    ) {
      try {
        codexPreparation = this.codexObserver.prepare(id, createdAt);
      } catch {
        this.codexObserver.release(id);
      }
    }
    const providerPreparation = claudePreparation ?? codexPreparation;
    const relaunchManifest: RelaunchManifest = {
      schemaVersion: RELAUNCH_MANIFEST_SCHEMA_VERSION,
      id: randomUUID(),
      sessionId: id,
      predecessorSessionId: input.predecessorSessionId ?? null,
      displayName,
      launchPreset: preset.id,
      provider:
        preset.id !== "shell" &&
        (tmux === undefined || tmuxMode === "keep_alive")
          ? preset.id
          : null,
      command: {
        executable:
          tmux?.launchCommand?.executable ??
          tmux?.executable ??
          preset.executable,
        args: [...(tmux?.launchCommand?.args ?? tmux?.args ?? preset.args)],
      },
      cwd,
      repository:
        repository.status === "ready" && repository.root !== null
          ? {
              root: repository.root,
              name: repository.name ?? basename(repository.root),
            }
          : null,
      environmentKeys: [...new Set(this.environmentKeys)].slice(0, 32),
      runtime: tmux === undefined ? "pty" : "tmux",
      tmuxTarget: tmux?.target ?? null,
      tmuxMode,
      resumeReference: null,
      createdAt,
      updatedAt: createdAt,
    };

    const persistBeforeClient = tmuxMode === "keep_alive";
    if (persistBeforeClient) {
      try {
        await this.relaunchManifests?.upsert(relaunchManifest);
      } catch (error) {
        terminal.dispose();
        throw new SessionError(
          "TMUX_MANIFEST_WRITE_FAILED",
          error instanceof Error
            ? `${error.message} The new tmux target may still be running; inspect tmux before retrying.`
            : "The keep-alive manifest could not be stored. The tmux target may still be running.",
          true,
        );
      }
    }

    let pty: PtyProcess;
    try {
      pty = this.ptyFactory.create({
        executable: tmux?.executable ?? preset.executable,
        args: [
          ...(tmux?.args ?? preset.args),
          ...(providerPreparation?.args ?? []),
        ],
        cwd,
        cols: input.cols,
        rows: input.rows,
        ...(providerPreparation === undefined
          ? {}
          : { environment: providerPreparation.environment }),
      });
    } catch (error) {
      this.claudeObserver?.release(id);
      this.codexObserver?.release(id);
      terminal.dispose();
      throw new SessionError(
        persistBeforeClient ? "TMUX_CLIENT_SPAWN_FAILED" : "PTY_SPAWN_FAILED",
        persistBeforeClient
          ? "The tmux target was created and retained, but its Pacium client could not start. Use Recovery or restart Pacium to reattach."
          : error instanceof Error
            ? error.message
            : "The terminal process could not start",
        true,
      );
    }
    try {
      if (!persistBeforeClient) {
        await this.relaunchManifests?.upsert(relaunchManifest);
      }
    } catch (error) {
      try {
        pty.kill("SIGTERM");
      } catch {
        // The failed launch remains unregistered even if its child already exited.
      }
      this.claudeObserver?.release(id);
      this.codexObserver?.release(id);
      terminal.dispose();
      throw new SessionError(
        "RELAUNCH_MANIFEST_WRITE_FAILED",
        error instanceof Error
          ? error.message
          : "The relaunch manifest could not be stored.",
        true,
      );
    }

    const session: ManagedSession = {
      summary: {
        id,
        epoch: 1,
        displayName,
        cwd,
        shell: tmux?.executable ?? preset.executable,
        launchPreset: preset.id,
        commandLabel:
          tmux === undefined
            ? preset.label
            : tmuxMode === "keep_alive"
              ? `tmux keep-alive · ${preset.label}`
              : `tmux · ${tmux.target.sessionName}`,
        agentClassification:
          tmux === undefined || tmuxMode === "keep_alive"
            ? {
                ...preset.classification,
                observedAt: createdAt,
              }
            : {
                type: "unknown",
                label: "tmux session",
                source: "process_observed",
                confidence: "confirmed",
                observedAt: createdAt,
              },
        providerObservation:
          providerPreparation?.observation ??
          initialProviderObservation(preset.id, createdAt),
        relaunchManifest,
        repository,
        runtime: tmux === undefined ? "pty" : "tmux",
        tmuxTarget: tmux?.target ?? null,
        tmuxMode,
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
      ptySubscriptions: [],
      terminal,
      serializer,
      writeChain: Promise.resolve(),
      sequence: 0,
      closeRequestId: undefined,
      forceTimer: undefined,
    };

    this.sessions.set(id, session);

    session.ptySubscriptions.push(
      pty.onData((data) => {
        this.handleData(session, data);
      }),
      pty.onExit((event) => {
        this.handleExit(session, event.exitCode, event.signal);
      }),
    );

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
      if (
        session.summary.runtime === "tmux" &&
        session.summary.tmuxTarget !== null &&
        session.summary.tmuxTarget !== undefined &&
        this.tmuxAdapter !== undefined
      ) {
        void this.tmuxAdapter
          .detachClient(session.summary.tmuxTarget, session.pty.pid)
          .catch(() => session.pty.kill("SIGKILL"));
      } else {
        session.pty.kill("SIGTERM");
      }
      session.forceTimer = setTimeout(
        () => {
          if (
            this.sessions.get(sessionId)?.summary.processState === "closing"
          ) {
            session.pty.kill("SIGKILL");
          }
        },
        session.summary.runtime === "tmux" ? 3_000 : 1_500,
      );
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

  public async shutdown(): Promise<void> {
    this.unsubscribeVerification?.();
    this.unsubscribeClaudeObserver?.();
    this.unsubscribeCodexObserver?.();
    this.verificationRunner?.shutdown();
    const detachments: Promise<void>[] = [];
    for (const session of this.sessions.values()) {
      this.claudeObserver?.release(session.summary.id);
      this.codexObserver?.release(session.summary.id);
      if (session.forceTimer !== undefined) {
        clearTimeout(session.forceTimer);
      }
      if (
        session.summary.processState === "live" ||
        session.summary.processState === "closing"
      ) {
        if (
          session.summary.runtime === "tmux" &&
          session.summary.tmuxTarget !== null &&
          session.summary.tmuxTarget !== undefined &&
          this.tmuxAdapter !== undefined
        ) {
          detachments.push(
            this.tmuxAdapter
              .detachClient(session.summary.tmuxTarget, session.pty.pid)
              .catch(() => {
                console.warn(
                  `Pacium could not detach tmux client ${session.summary.id}; forcing client exit.`,
                );
                session.pty.kill("SIGKILL");
              }),
          );
        } else {
          session.pty.kill("SIGHUP");
        }
      }
      for (const subscription of session.ptySubscriptions) {
        subscription.dispose();
      }
      session.terminal.dispose();
    }
    await Promise.all(detachments);
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

  private async retainResumeReference(
    session: ManagedSession,
    observation: NonNullable<SessionSummary["providerObservation"]>,
  ): Promise<void> {
    const reference = [...observation.activities]
      .reverse()
      .map(({ extension, observedAt }) => {
        const id =
          extension.provider === "claude"
            ? extension.providerSessionId
            : extension.threadId;
        return id === null
          ? null
          : {
              provider: extension.provider,
              id,
              observedAt,
            };
      })
      .find((candidate) => candidate !== null);
    const currentManifest = session.summary.relaunchManifest;
    if (
      currentManifest === undefined ||
      reference === undefined ||
      (currentManifest.resumeReference?.provider === reference.provider &&
        currentManifest.resumeReference.id === reference.id)
    ) {
      return;
    }
    const manifest: RelaunchManifest = {
      ...currentManifest,
      resumeReference: reference,
      updatedAt: reference.observedAt,
    };
    try {
      await this.relaunchManifests?.upsert(manifest);
    } catch {
      return;
    }
    if (!this.sessions.has(session.summary.id)) {
      return;
    }
    session.summary = { ...session.summary, relaunchManifest: manifest };
    this.emitSession({ type: "updated", session: { ...session.summary } });
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
    this.claudeObserver?.release(session.summary.id);
    this.codexObserver?.release(session.summary.id);
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
    this.claudeObserver?.release(session.summary.id);
    this.codexObserver?.release(session.summary.id);
    for (const subscription of session.ptySubscriptions) {
      subscription.dispose();
    }
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

  private requireKnownPreset(id: LaunchPresetId): LaunchPresetDefinition {
    const preset = this.launchPresets.find((candidate) => candidate.id === id);
    if (preset === undefined) {
      throw new SessionError(
        "PRESET_UNAVAILABLE",
        "The retained launch preset is no longer known.",
      );
    }
    return preset;
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

function tmuxTargetKey(target: TmuxTarget): string {
  return `${target.serverId}\u0000${target.sessionId}`;
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
