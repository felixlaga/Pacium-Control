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
  type LaunchPresetId,
  type SessionSummary,
} from "@pacium/contracts";

import type { LaunchPresetDefinition } from "./launch-presets.js";
import type { PtyFactory, PtyProcess } from "./pty-adapter.js";
import { discoverRepositoryContext } from "./repository-context.js";

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
  | { type: "closed"; sessionId: string; requestId?: string };

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

  public constructor(
    private readonly ptyFactory: PtyFactory,
    private readonly launchPresets: readonly LaunchPresetDefinition[],
  ) {}

  public list(): SessionSummary[] {
    return [...this.sessions.values()]
      .map(({ summary }) => ({ ...summary }))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  public async create(input: CreateSessionInput): Promise<SessionSummary> {
    const cwd = await this.validateCwd(input.cwd);
    const preset = this.requireAvailablePreset(input.launchPreset);
    const repository = await discoverRepositoryContext(cwd);
    const id = randomUUID();
    const createdAt = new Date().toISOString();
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
        repositoryRoot: repository?.root ?? null,
        repositoryName: repository?.name ?? null,
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
