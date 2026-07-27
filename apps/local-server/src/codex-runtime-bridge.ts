import { spawn } from "node:child_process";
import type { IncomingMessage } from "node:http";
import type { Readable, Writable } from "node:stream";
import type { Duplex } from "node:stream";

import { WebSocket, WebSocketServer, type RawData } from "ws";

import type { CodexObserver } from "./codex-observer.js";

export const MAX_CODEX_RUNTIME_MESSAGE_BYTES = 4 * 1024 * 1024;
export const MAX_CODEX_RUNTIME_QUEUE_BYTES = 8 * 1024 * 1024;

const CODEX_RUNTIME_PATH =
  /^\/api\/provider\/codex\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/runtime$/;

export interface CodexRuntimeChild {
  stdin: Writable;
  stdout: Readable;
  stderr: Readable;
  once(event: "error", listener: (error: Error) => void): CodexRuntimeChild;
  once(
    event: "exit",
    listener: (code: number | null, signal: NodeJS.Signals | null) => void,
  ): CodexRuntimeChild;
  kill(signal: NodeJS.Signals): boolean;
}

export type CodexRuntimeChildFactory = (
  executable: string,
  environment: Readonly<Record<string, string>>,
) => CodexRuntimeChild;

interface ActiveBridge {
  webSocket: WebSocket;
  child: CodexRuntimeChild;
  finish(markFailure: boolean, code: string): void;
}

export class CodexRuntimeBridge {
  private readonly server = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_CODEX_RUNTIME_MESSAGE_BYTES,
    perMessageDeflate: false,
  });
  private readonly active = new Map<string, ActiveBridge>();
  private readonly unsubscribeRelease: () => void;

  public constructor(
    private readonly observer: CodexObserver,
    private readonly childFactory: CodexRuntimeChildFactory = spawnCodexRuntime,
  ) {
    this.unsubscribeRelease = observer.onRelease((sessionId) => {
      this.disposeSession(sessionId);
    });
  }

  public handleUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
    expectedPort: number,
  ): boolean {
    const path = request.url;
    if (path === undefined || !path.startsWith("/api/provider/codex/")) {
      return false;
    }
    const match = CODEX_RUNTIME_PATH.exec(path);
    const token = readBearerToken(request);
    if (
      match?.[1] === undefined ||
      request.method !== "GET" ||
      request.headers.host !== `127.0.0.1:${expectedPort}` ||
      request.headers.origin !== undefined ||
      token === null
    ) {
      rejectUpgrade(socket);
      return true;
    }
    const sessionId = match[1];
    const claimed = this.observer.claimBridge(sessionId, token);
    if (claimed === null) {
      rejectUpgrade(socket);
      return true;
    }
    try {
      this.server.handleUpgrade(request, socket, head, (webSocket) => {
        this.start(sessionId, webSocket, claimed);
      });
    } catch {
      this.observer.releaseBridge(sessionId);
      rejectUpgrade(socket);
    }
    return true;
  }

  public disposeSession(sessionId: string): void {
    this.active.get(sessionId)?.finish(false, "codex.session_released");
  }

  public dispose(): void {
    this.unsubscribeRelease();
    for (const bridge of [...this.active.values()]) {
      bridge.finish(false, "codex.server_shutdown");
    }
    this.server.close();
  }

  private start(
    sessionId: string,
    webSocket: WebSocket,
    claimed: {
      executable: string;
      environment: Readonly<Record<string, string>>;
    },
  ): void {
    let child: CodexRuntimeChild;
    try {
      child = this.childFactory(claimed.executable, claimed.environment);
    } catch {
      this.observer.markTransportFailure(sessionId, "codex.spawn_failed");
      this.observer.releaseBridge(sessionId);
      webSocket.close(1011, "Codex runtime unavailable");
      return;
    }

    let finished = false;
    let forceTimer: NodeJS.Timeout | undefined;
    let stdoutBuffer = Buffer.alloc(0);
    const finish = (markFailure: boolean, code: string) => {
      if (finished) {
        return;
      }
      finished = true;
      this.active.delete(sessionId);
      this.observer.releaseBridge(sessionId);
      if (markFailure) {
        this.observer.markTransportFailure(sessionId, code);
      }
      child.stdin.destroy();
      child.stdout.destroy();
      child.stderr.destroy();
      child.kill("SIGTERM");
      forceTimer = setTimeout(() => {
        child.kill("SIGKILL");
      }, 2_000);
      forceTimer.unref();
      if (
        webSocket.readyState === WebSocket.OPEN ||
        webSocket.readyState === WebSocket.CONNECTING
      ) {
        webSocket.close(
          markFailure ? 1011 : 1000,
          markFailure ? "Codex runtime bridge failed" : "Codex runtime closed",
        );
      }
    };
    this.active.set(sessionId, { webSocket, child, finish });
    child.stderr.resume();

    webSocket.on("message", (data, isBinary) => {
      if (isBinary) {
        finish(true, "codex.binary_frame");
        return;
      }
      const bytes = rawDataBuffer(data);
      if (bytes.byteLength > MAX_CODEX_RUNTIME_MESSAGE_BYTES) {
        finish(true, "codex.frame_too_large");
        return;
      }
      if (bytes.includes(10) || bytes.includes(13)) {
        finish(true, "codex.invalid_client_json");
        return;
      }
      try {
        JSON.parse(bytes.toString("utf8"));
      } catch {
        finish(true, "codex.invalid_client_json");
        return;
      }
      if (!child.stdin.write(Buffer.concat([bytes, Buffer.from("\n")]))) {
        webSocket.pause();
        child.stdin.once("drain", () => {
          if (!finished) {
            webSocket.resume();
          }
        });
      }
    });
    webSocket.once("close", (code) => {
      finish(code !== 1000, "codex.bridge_closed");
    });
    webSocket.once("error", () => {
      finish(true, "codex.bridge_error");
    });

    child.stdout.on("data", (chunk: unknown) => {
      if (finished) {
        return;
      }
      if (!Buffer.isBuffer(chunk)) {
        finish(true, "codex.invalid_jsonl");
        return;
      }
      stdoutBuffer = Buffer.concat([stdoutBuffer, chunk]);
      while (!finished) {
        const newline = stdoutBuffer.indexOf(10);
        if (newline < 0) {
          if (stdoutBuffer.byteLength > MAX_CODEX_RUNTIME_MESSAGE_BYTES) {
            finish(true, "codex.jsonl_too_large");
          }
          return;
        }
        let line = stdoutBuffer.subarray(0, newline);
        stdoutBuffer = stdoutBuffer.subarray(newline + 1);
        if (line.at(-1) === 13) {
          line = line.subarray(0, -1);
        }
        if (
          line.byteLength === 0 ||
          line.byteLength > MAX_CODEX_RUNTIME_MESSAGE_BYTES
        ) {
          finish(true, "codex.invalid_jsonl");
          return;
        }
        let message: unknown;
        try {
          message = JSON.parse(line.toString("utf8")) as unknown;
        } catch {
          finish(true, "codex.invalid_jsonl");
          return;
        }
        this.observer.ingestServerMessage(sessionId, message);
        if (
          webSocket.readyState !== WebSocket.OPEN ||
          webSocket.bufferedAmount + line.byteLength >
            MAX_CODEX_RUNTIME_QUEUE_BYTES
        ) {
          finish(true, "codex.bridge_backpressure");
          return;
        }
        webSocket.send(line, { binary: false }, (error) => {
          if (error !== undefined) {
            finish(true, "codex.bridge_send");
          }
        });
      }
    });
    child.stdin.once("error", () => {
      finish(true, "codex.child_stdin");
    });
    child.stdout.once("error", () => {
      finish(true, "codex.child_stdout");
    });
    child.once("error", () => {
      finish(true, "codex.child_error");
    });
    child.once("exit", () => {
      if (forceTimer !== undefined) {
        clearTimeout(forceTimer);
      }
      finish(true, "codex.child_exit");
    });
  }
}

function spawnCodexRuntime(
  executable: string,
  environment: Readonly<Record<string, string>>,
): CodexRuntimeChild {
  return spawn(executable, ["app-server", "--listen", "stdio://"], {
    env: { ...environment },
    shell: false,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function readBearerToken(request: IncomingMessage): string | null {
  const authorization = request.headers.authorization;
  if (
    authorization === undefined ||
    Array.isArray(authorization) ||
    !authorization.startsWith("Bearer ")
  ) {
    return null;
  }
  const token = authorization.slice("Bearer ".length);
  return token.length >= 32 &&
    token.length <= 256 &&
    /^[A-Za-z0-9_-]+$/.test(token)
    ? token
    : null;
}

function rawDataBuffer(data: RawData): Buffer {
  if (Buffer.isBuffer(data)) {
    return data;
  }
  if (Array.isArray(data)) {
    return Buffer.concat(data);
  }
  return Buffer.from(data);
}

function rejectUpgrade(socket: Duplex): void {
  socket.write(
    "HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n",
  );
  socket.destroy();
}
