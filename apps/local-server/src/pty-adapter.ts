import * as nodePty from "node-pty";

import { buildChildEnvironment, type ServerConfig } from "./config.js";

export interface PtyExitEvent {
  exitCode: number;
  signal: number;
}

export interface PtyProcess {
  readonly pid: number;
  onData(listener: (data: string) => void): { dispose(): void };
  onExit(listener: (event: PtyExitEvent) => void): { dispose(): void };
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(signal?: string): void;
}

export interface PtyCreateOptions {
  executable: string;
  args: readonly string[];
  cwd: string;
  cols: number;
  rows: number;
  environment?: Readonly<Record<string, string>>;
}

export interface PtyFactory {
  create(options: PtyCreateOptions): PtyProcess;
}

export class NodePtyFactory implements PtyFactory {
  public constructor(private readonly config: ServerConfig) {}

  public create(options: PtyCreateOptions): PtyProcess {
    const pty = nodePty.spawn(options.executable, [...options.args], {
      name: "xterm-256color",
      cols: options.cols,
      rows: options.rows,
      cwd: options.cwd,
      env: mergePtyEnvironment(
        buildChildEnvironment(this.config.environmentKeys),
        options.environment,
      ),
    });
    return {
      pid: pty.pid,
      onData(listener) {
        return pty.onData(listener);
      },
      onExit(listener) {
        return pty.onExit((event) => {
          listener({
            exitCode: event.exitCode,
            signal: event.signal ?? 0,
          });
        });
      },
      write(data) {
        pty.write(data);
      },
      resize(cols, rows) {
        pty.resize(cols, rows);
      },
      kill(signal) {
        pty.kill(signal);
      },
    };
  }
}

export function mergePtyEnvironment(
  base: Readonly<Record<string, string>>,
  additions: Readonly<Record<string, string>> | undefined,
): Record<string, string> {
  if (additions === undefined) {
    return { ...base };
  }
  const entries = Object.entries(additions);
  if (
    entries.length > 8 ||
    entries.some(
      ([key, value]) =>
        !/^PACIUM_[A-Z0-9_]{1,80}$/.test(key) ||
        key === "PACIUM_SESSION" ||
        Buffer.byteLength(value) > 8_192 ||
        containsControlCharacter(value),
    )
  ) {
    throw new Error("Invalid server-owned PTY environment additions.");
  }
  return { ...base, ...additions };
}

function containsControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 31 || code === 127) {
      return true;
    }
  }
  return false;
}
