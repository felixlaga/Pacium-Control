import { execFile } from "node:child_process";
import { lstat, realpath } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, parse } from "node:path";
import { promisify } from "node:util";

import {
  MAX_RELAUNCH_COMMAND_ARGUMENTS,
  MAX_TMUX_SESSIONS,
  TmuxSessionSchema,
  TmuxSessionsObservationSchema,
  TmuxTargetSchema,
  type TmuxCapability,
  type TmuxSession,
  type TmuxSessionsObservation,
  type TmuxTarget,
} from "@pacium/contracts";

import { findExecutable } from "./launch-presets.js";

const execFileAsync = promisify(execFile);
const SERVER_ID = "configured";
const DISCOVERY_TIMEOUT_MS = 2_000;
const LAUNCH_TIMEOUT_MS = 5_000;
const MAX_DISCOVERY_BYTES = 64 * 1024;
const MAX_LAUNCH_BYTES = 4 * 1024;
const FIELD_SEPARATOR = "__PACIUM_TMUX_FIELD__";
const FORMAT = [
  "#{session_id}",
  "#{session_name}",
  "#{session_windows}",
  "#{session_attached}",
  "#{session_created}",
  "#{pane_current_path}",
].join(FIELD_SEPARATOR);
const LAUNCH_FORMAT = ["#{session_id}", "#{session_name}"].join(
  FIELD_SEPARATOR,
);
const CLIENT_FORMAT = [
  "#{client_pid}",
  "#{client_session}",
  "#{client_tty}",
].join(FIELD_SEPARATOR);
const PACIUM_SESSION_NAME =
  /^pacium-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

interface TmuxCommandOptions {
  encoding: "utf8";
  env: Readonly<Record<string, string>>;
  timeout: number;
  maxBuffer: number;
  windowsHide: boolean;
}

type TmuxCommandExecutor = (
  executable: string,
  args: readonly string[],
  options: TmuxCommandOptions,
) => Promise<{ stdout: string; stderr: string }>;

export interface TmuxAttachSpec {
  executable: string;
  args: readonly string[];
  cwd: string;
  target: TmuxTarget;
  mode?: "attached" | "keep_alive";
  launchCommand?: {
    executable: string;
    args: readonly string[];
  };
}

export interface TmuxLaunchInput {
  sessionName: string;
  cwd: string;
  cols: number;
  rows: number;
  executable: string;
  args: readonly string[];
}

export class TmuxAdapter {
  public constructor(
    private readonly socketPath: string | null,
    private readonly executable: string | null,
    private readonly version: string | null,
    private readonly environment: Readonly<Record<string, string>>,
    private readonly execute: TmuxCommandExecutor = executeTmux,
  ) {}

  public capability(): TmuxCapability {
    if (this.socketPath === null) {
      return {
        state: "unconfigured",
        serverId: null,
        executable: null,
        version: null,
        detail: "No optional tmux socket is configured.",
      };
    }
    if (this.executable === null || this.version === null) {
      return {
        state: "unavailable",
        serverId: SERVER_ID,
        executable: this.executable,
        version: this.version,
        detail: "tmux is not installed, executable, or version-detectable.",
      };
    }
    return {
      state: "ready",
      serverId: SERVER_ID,
      executable: this.executable,
      version: this.version,
      detail: "One explicit local tmux socket is configured.",
    };
  }

  public async discover(): Promise<TmuxSessionsObservation> {
    const observedAt = new Date().toISOString();
    const capability = this.capability();
    if (capability.state === "unconfigured") {
      return errorObservation(
        "unconfigured",
        null,
        observedAt,
        "not_configured",
        capability.detail,
      );
    }
    if (
      capability.state !== "ready" ||
      this.socketPath === null ||
      this.executable === null
    ) {
      return errorObservation(
        "unavailable",
        SERVER_ID,
        observedAt,
        "tmux_unavailable",
        capability.detail,
      );
    }
    try {
      const status = await lstat(this.socketPath);
      if (!status.isSocket()) {
        return errorObservation(
          "unavailable",
          SERVER_ID,
          observedAt,
          "socket_unavailable",
          "The configured tmux path is not an available Unix socket.",
        );
      }
    } catch {
      return errorObservation(
        "unavailable",
        SERVER_ID,
        observedAt,
        "socket_unavailable",
        "The configured tmux Unix socket is unavailable.",
      );
    }
    try {
      const { stdout } = await this.execute(
        this.executable,
        ["-S", this.socketPath, "list-sessions", "-F", FORMAT],
        {
          encoding: "utf8",
          env: { ...this.environment },
          timeout: DISCOVERY_TIMEOUT_MS,
          maxBuffer: MAX_DISCOVERY_BYTES,
          windowsHide: true,
        },
      );
      const sessions = parseTmuxSessions(stdout, observedAt);
      return TmuxSessionsObservationSchema.parse({
        status: sessions.length === 0 ? "empty" : "ready",
        serverId: SERVER_ID,
        observedAt,
        sessions,
        error: null,
      });
    } catch (error) {
      const timedOut =
        error instanceof Error &&
        "killed" in error &&
        (error as { killed?: unknown }).killed === true;
      return errorObservation(
        "error",
        SERVER_ID,
        observedAt,
        timedOut ? "timeout" : "inspection_failed",
        timedOut
          ? "tmux discovery exceeded its fixed timeout."
          : "tmux sessions could not be inspected safely.",
      );
    }
  }

  public async attachSpec(
    serverId: string,
    sessionId: string,
  ): Promise<TmuxAttachSpec> {
    if (
      serverId !== SERVER_ID ||
      this.socketPath === null ||
      this.executable === null
    ) {
      throw new Error("The selected tmux server is unavailable.");
    }
    const observation = await this.discover();
    const session = observation.sessions.find(
      ({ target }) =>
        target.serverId === serverId && target.sessionId === sessionId,
    );
    if (session === undefined) {
      throw new Error("The selected tmux session is no longer available.");
    }
    return {
      executable: this.executable,
      args: [
        "-S",
        this.socketPath,
        "attach-session",
        "-t",
        session.target.sessionId,
      ],
      cwd: session.currentPath ?? process.cwd(),
      target: session.target,
      mode: "attached",
    };
  }

  public async detachClient(
    target: TmuxTarget,
    clientPid: number,
  ): Promise<void> {
    if (
      this.capability().state !== "ready" ||
      this.socketPath === null ||
      this.executable === null
    ) {
      throw new Error("The tmux client cannot be detached safely.");
    }
    const parsedTarget = TmuxTargetSchema.parse(target);
    if (
      parsedTarget.serverId !== SERVER_ID ||
      !Number.isSafeInteger(clientPid) ||
      clientPid <= 0
    ) {
      throw new Error("The tmux client identity is invalid.");
    }
    const listed = await this.execute(
      this.executable,
      ["-S", this.socketPath, "list-clients", "-F", CLIENT_FORMAT],
      {
        encoding: "utf8",
        env: { ...this.environment },
        timeout: DISCOVERY_TIMEOUT_MS,
        maxBuffer: MAX_LAUNCH_BYTES,
        windowsHide: true,
      },
    );
    const clientTty = parseTmuxClient(
      listed.stdout,
      clientPid,
      parsedTarget.sessionName,
    );
    await this.execute(
      this.executable,
      ["-S", this.socketPath, "detach-client", "-t", clientTty],
      {
        encoding: "utf8",
        env: { ...this.environment },
        timeout: DISCOVERY_TIMEOUT_MS,
        maxBuffer: MAX_LAUNCH_BYTES,
        windowsHide: true,
      },
    );
  }

  public async launchSpec(input: TmuxLaunchInput): Promise<TmuxAttachSpec> {
    if (
      this.capability().state !== "ready" ||
      this.socketPath === null ||
      this.executable === null
    ) {
      throw new Error("tmux keep-alive is unavailable.");
    }
    validateLaunchInput(input);
    const observedAt = new Date().toISOString();
    const args = [
      "-S",
      this.socketPath,
      "new-session",
      "-d",
      "-P",
      "-F",
      LAUNCH_FORMAT,
      "-s",
      input.sessionName,
      "-c",
      input.cwd,
      "-x",
      String(input.cols),
      "-y",
      String(input.rows),
      input.executable,
      ...input.args,
    ];
    try {
      const result = await this.execute(this.executable, args, {
        encoding: "utf8",
        env: { ...this.environment },
        timeout: LAUNCH_TIMEOUT_MS,
        maxBuffer: MAX_LAUNCH_BYTES,
        windowsHide: true,
      });
      const target = parseTmuxLaunch(result.stdout, observedAt);
      if (target.sessionName !== input.sessionName) {
        throw new Error("tmux returned a different keep-alive target.");
      }
      return {
        executable: this.executable,
        args: ["-S", this.socketPath, "attach-session", "-t", target.sessionId],
        cwd: input.cwd,
        target,
        mode: "keep_alive",
        launchCommand: {
          executable: input.executable,
          args: [...input.args],
        },
      };
    } catch (error) {
      if (!didTimeOut(error)) {
        throw error;
      }
      const observation = await this.discover();
      const recovered = observation.sessions.find(
        ({ target }) => target.sessionName === input.sessionName,
      );
      if (recovered === undefined) {
        throw new Error(
          "tmux keep-alive launch timed out and no exact target was found.",
          { cause: error },
        );
      }
      return {
        executable: this.executable,
        args: [
          "-S",
          this.socketPath,
          "attach-session",
          "-t",
          recovered.target.sessionId,
        ],
        cwd: input.cwd,
        target: recovered.target,
        mode: "keep_alive",
        launchCommand: {
          executable: input.executable,
          args: [...input.args],
        },
      };
    }
  }
}

export function parseTmuxClient(
  output: string,
  clientPid: number,
  sessionName: string,
): string {
  if (Buffer.byteLength(output) > MAX_LAUNCH_BYTES) {
    throw new Error("tmux client output exceeded its fixed bound.");
  }
  const matches = output
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => line.split(FIELD_SEPARATOR))
    .filter(
      (fields) =>
        fields.length === 3 &&
        fields[0] === String(clientPid) &&
        fields[1] === sessionName,
    );
  if (matches.length !== 1) {
    throw new Error("The exact Pacium tmux client was not found.");
  }
  const clientTty = matches[0]?.[2] ?? "";
  if (
    clientTty.length === 0 ||
    clientTty.length > 256 ||
    !/^\/dev\/[A-Za-z0-9._/-]+$/.test(clientTty)
  ) {
    throw new Error("The tmux client terminal identity is invalid.");
  }
  return clientTty;
}

export async function createTmuxAdapter(
  socketPath: string | null,
  environment: Readonly<Record<string, string>>,
): Promise<TmuxAdapter> {
  if (socketPath === null) {
    return new TmuxAdapter(null, null, null, environment);
  }
  const safeSocketPath = await resolveSafeTmuxSocketLocation(socketPath);
  const executable = findExecutable("tmux", environment.PATH);
  if (executable === null) {
    return new TmuxAdapter(safeSocketPath, null, null, environment);
  }
  let version: string | null;
  try {
    const result = await execFileAsync(executable, ["-V"], {
      encoding: "utf8",
      env: { ...environment },
      timeout: DISCOVERY_TIMEOUT_MS,
      maxBuffer: 1_024,
      windowsHide: true,
    });
    const candidate = result.stdout.trim();
    version = /^tmux [0-9][0-9A-Za-z._-]{0,39}$/.test(candidate)
      ? candidate
      : null;
  } catch {
    return new TmuxAdapter(safeSocketPath, executable, null, environment);
  }
  return new TmuxAdapter(safeSocketPath, executable, version, environment);
}

export async function resolveSafeTmuxSocketLocation(
  socketPath: string,
): Promise<string> {
  let canonicalPath = socketPath;
  try {
    canonicalPath = await realpath(socketPath);
  } catch (error) {
    if (!isMissingPathError(error)) {
      throw error;
    }
    try {
      canonicalPath = join(
        await realpath(dirname(socketPath)),
        basename(socketPath),
      );
    } catch (parentError) {
      if (!isMissingPathError(parentError)) {
        throw parentError;
      }
    }
  }

  let current = dirname(canonicalPath);
  const root = parse(current).root;
  while (true) {
    try {
      await lstat(join(current, ".git"));
      throw new Error(
        "PACIUM_TMUX_SOCKET must be located outside Git repositories.",
      );
    } catch (error) {
      if (!isMissingPathError(error)) {
        throw error;
      }
    }
    if (current === root) {
      return canonicalPath;
    }
    current = dirname(current);
  }
}

export function parseTmuxSessions(
  stdout: string,
  observedAt: string,
): TmuxSession[] {
  if (Buffer.byteLength(stdout) > MAX_DISCOVERY_BYTES) {
    throw new Error("tmux discovery output is too large.");
  }
  const lines = stdout.length === 0 ? [] : stdout.trimEnd().split("\n");
  if (lines.length > MAX_TMUX_SESSIONS) {
    throw new Error("tmux returned too many sessions.");
  }
  const sessions = lines.map((line) => {
    const fields = line.split(FIELD_SEPARATOR);
    if (fields.length !== 6) {
      throw new Error("tmux discovery output is malformed.");
    }
    const [sessionId, sessionName, windows, attachedClients, created, path] =
      fields;
    const createdSeconds = Number(created);
    const parsed = TmuxSessionSchema.safeParse({
      target: {
        serverId: SERVER_ID,
        sessionId,
        sessionName,
        observedAt,
      },
      windows: Number(windows),
      attachedClients: Number(attachedClients),
      createdAt: new Date(createdSeconds * 1_000).toISOString(),
      currentPath:
        path === undefined || path === "" || !isAbsolute(path) ? null : path,
    });
    if (!parsed.success || !Number.isSafeInteger(createdSeconds)) {
      throw new Error("tmux discovery output is invalid.");
    }
    return parsed.data;
  });
  if (
    new Set(sessions.map(({ target }) => target.sessionId)).size !==
    sessions.length
  ) {
    throw new Error("tmux returned duplicate session identities.");
  }
  return sessions;
}

export function parseTmuxLaunch(
  stdout: string,
  observedAt: string,
): TmuxTarget {
  if (
    Buffer.byteLength(stdout) === 0 ||
    Buffer.byteLength(stdout) > MAX_LAUNCH_BYTES
  ) {
    throw new Error("tmux keep-alive launch output is invalid.");
  }
  const lines = stdout.trimEnd().split("\n");
  if (lines.length !== 1) {
    throw new Error("tmux keep-alive launch output is malformed.");
  }
  const [sessionId, sessionName, ...extra] = lines[0]!.split(FIELD_SEPARATOR);
  if (extra.length > 0) {
    throw new Error("tmux keep-alive launch output is malformed.");
  }
  return TmuxTargetSchema.parse({
    serverId: SERVER_ID,
    sessionId,
    sessionName,
    observedAt,
  });
}

function errorObservation(
  status: "unconfigured" | "unavailable" | "error",
  serverId: string | null,
  observedAt: string,
  code:
    | "not_configured"
    | "tmux_unavailable"
    | "socket_unavailable"
    | "timeout"
    | "inspection_failed",
  message: string,
): TmuxSessionsObservation {
  return TmuxSessionsObservationSchema.parse({
    status,
    serverId,
    observedAt,
    sessions: [],
    error: { code, message },
  });
}

function isMissingPathError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

function validateLaunchInput(input: TmuxLaunchInput): void {
  if (
    !PACIUM_SESSION_NAME.test(input.sessionName) ||
    !isAbsolute(input.cwd) ||
    !isAbsolute(input.executable) ||
    input.cols < 2 ||
    input.cols > 500 ||
    input.rows < 1 ||
    input.rows > 300 ||
    input.args.length > MAX_RELAUNCH_COMMAND_ARGUMENTS ||
    [input.cwd, input.executable, ...input.args].some(
      (value) =>
        value.length > 4096 ||
        [...value].some((character) => character.codePointAt(0) === 0),
    )
  ) {
    throw new Error("tmux keep-alive launch input is invalid.");
  }
}

function didTimeOut(error: unknown): boolean {
  return (
    error instanceof Error &&
    "killed" in error &&
    (error as { killed?: unknown }).killed === true
  );
}

async function executeTmux(
  executable: string,
  args: readonly string[],
  options: TmuxCommandOptions,
): Promise<{ stdout: string; stderr: string }> {
  const result = await execFileAsync(executable, [...args], {
    encoding: options.encoding,
    env: { ...options.env },
    timeout: options.timeout,
    maxBuffer: options.maxBuffer,
    windowsHide: options.windowsHide,
  });
  return { stdout: result.stdout, stderr: result.stderr };
}
