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
      env: buildChildEnvironment(this.config.environmentKeys),
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
