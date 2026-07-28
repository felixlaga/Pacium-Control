import { execFile } from "node:child_process";
import { lstat, realpath } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, parse } from "node:path";
import { promisify } from "node:util";

import {
  MAX_TMUX_SESSIONS,
  TmuxSessionSchema,
  TmuxSessionsObservationSchema,
  type TmuxCapability,
  type TmuxSession,
  type TmuxSessionsObservation,
  type TmuxTarget,
} from "@pacium/contracts";

import { findExecutable } from "./launch-presets.js";

const execFileAsync = promisify(execFile);
const SERVER_ID = "configured";
const DISCOVERY_TIMEOUT_MS = 2_000;
const MAX_DISCOVERY_BYTES = 64 * 1024;
const FIELD_SEPARATOR = "__PACIUM_TMUX_FIELD__";
const FORMAT = [
  "#{session_id}",
  "#{session_name}",
  "#{session_windows}",
  "#{session_attached}",
  "#{session_created}",
  "#{pane_current_path}",
].join(FIELD_SEPARATOR);

export interface TmuxAttachSpec {
  executable: string;
  args: readonly string[];
  cwd: string;
  target: TmuxTarget;
}

export class TmuxAdapter {
  public constructor(
    private readonly socketPath: string | null,
    private readonly executable: string | null,
    private readonly version: string | null,
    private readonly environment: Readonly<Record<string, string>>,
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
      const { stdout } = await execFileAsync(
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
    };
  }
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
