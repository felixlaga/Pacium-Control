import { EventEmitter, once } from "node:events";
import { createServer, type Server } from "node:http";
import { PassThrough } from "node:stream";

import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";

import { CodexObserver } from "./codex-observer.js";
import { CodexRuntimeBridge } from "./codex-runtime-bridge.js";

const sessionId = "53cfec56-181c-4e9c-b187-8f323780c175";
const token = "t".repeat(43);
const now = "2026-07-28T10:00:00.000Z";

class FakeChild extends EventEmitter {
  public readonly stdin = new PassThrough();
  public readonly stdout = new PassThrough();
  public readonly stderr = new PassThrough();
  public readonly kill = vi.fn(() => true);
}

describe("Codex runtime bridge", () => {
  let server: Server | undefined;
  let bridge: CodexRuntimeBridge | undefined;

  afterEach(async () => {
    bridge?.dispose();
    if (server?.listening) {
      await new Promise<void>((resolve) => server?.close(() => resolve()));
    }
  });

  it("forwards exact JSON messages and observes only bounded server metadata", async () => {
    const observer = createObserver();
    observer.prepare(sessionId, now);
    const child = new FakeChild();
    bridge = new CodexRuntimeBridge(observer, () => child);
    const setup = await startServer(bridge);
    server = setup.server;
    const webSocket = new WebSocket(
      `${setup.url}/api/provider/codex/${sessionId}/runtime`,
      {
        headers: {
          host: "127.0.0.1:4174",
          authorization: `Bearer ${token}`,
        },
      },
    );
    await once(webSocket, "open");

    const clientMessage = JSON.stringify({
      method: "turn/start",
      id: 1,
      params: { input: [{ type: "text", text: "private prompt" }] },
    });
    const childInput = nextChunk(child.stdin);
    webSocket.send(clientMessage);
    expect((await childInput).toString("utf8")).toBe(`${clientMessage}\n`);

    const update = new Promise<string>((resolve) => {
      observer.onUpdate((_id, observation) => {
        resolve(JSON.stringify(observation));
      });
    });
    const serverMessage = JSON.stringify({
      method: "turn/started",
      params: {
        threadId: "thread-1",
        turn: {
          id: "turn-1",
          status: "inProgress",
          items: [{ type: "userMessage", text: "private prompt" }],
        },
      },
    });
    const clientOutput = nextTextMessage(webSocket);
    child.stdout.write(`${serverMessage}\n`);
    expect(await clientOutput).toBe(serverMessage);
    const snapshot = await update;
    expect(snapshot).toContain("turn_started");
    expect(snapshot).not.toContain("private prompt");

    webSocket.close(1000);
    await once(webSocket, "close");
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
  });

  it("rejects wrong authority, origins, tokens, paths, and a second client", async () => {
    const observer = createObserver();
    observer.prepare(sessionId, now);
    const firstChild = new FakeChild();
    bridge = new CodexRuntimeBridge(observer, () => firstChild);
    const setup = await startServer(bridge);
    server = setup.server;
    const path = `/api/provider/codex/${sessionId}/runtime`;
    const first = await connect(setup.url + path, {
      host: "127.0.0.1:4174",
      authorization: `Bearer ${token}`,
    });
    expect(first.readyState).toBe(WebSocket.OPEN);

    for (const candidate of [
      connect(setup.url + path, {
        host: "pacium.tailnet.ts.net",
        authorization: `Bearer ${token}`,
      }),
      connect(setup.url + path, {
        host: "127.0.0.1:4174",
        origin: "http://127.0.0.1:4173",
        authorization: `Bearer ${token}`,
      }),
      connect(setup.url + path, {
        host: "127.0.0.1:4174",
        authorization: `Bearer ${"x".repeat(43)}`,
      }),
      connect(`${setup.url}/api/provider/codex/not-a-session/runtime`, {
        host: "127.0.0.1:4174",
        authorization: `Bearer ${token}`,
      }),
      connect(setup.url + path, {
        host: "127.0.0.1:4174",
        authorization: `Bearer ${token}`,
      }),
    ]) {
      await expect(candidate).rejects.toThrow();
    }

    first.close(1000);
    await once(first, "close");
  });

  it("fails closed on binary, invalid JSON, and malformed child JSONL", async () => {
    for (const failure of ["binary", "client-json", "child-json"] as const) {
      const observer = createObserver();
      observer.prepare(sessionId, now);
      const child = new FakeChild();
      const localBridge = new CodexRuntimeBridge(observer, () => child);
      const setup = await startServer(localBridge);
      const webSocket = await connect(
        `${setup.url}/api/provider/codex/${sessionId}/runtime`,
        {
          host: "127.0.0.1:4174",
          authorization: `Bearer ${token}`,
        },
      );
      const closed = once(webSocket, "close");
      if (failure === "binary") {
        webSocket.send(Buffer.from([0, 1]), { binary: true });
      } else if (failure === "client-json") {
        webSocket.send("{not-json");
      } else {
        child.stdout.write("{not-json\n");
      }
      await closed;
      expect(child.kill).toHaveBeenCalledWith("SIGTERM");
      localBridge.dispose();
      await new Promise<void>((resolve) => setup.server.close(() => resolve()));
    }
  });
});

function createObserver(): CodexObserver {
  return new CodexObserver({
    baseUrl: "http://127.0.0.1:4174",
    executable: "/opt/test/bin/codex",
    environment: { PATH: "/opt/test/bin" },
    capability: { available: true, version: "0.145.0" },
    now: () => now,
    tokenFactory: () => token,
  });
}

async function startServer(bridge: CodexRuntimeBridge): Promise<{
  server: Server;
  url: string;
}> {
  const server = createServer();
  server.on("upgrade", (request, socket, head) => {
    if (!bridge.handleUpgrade(request, socket, head, 4174)) {
      socket.destroy();
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected TCP test server.");
  }
  return { server, url: `ws://127.0.0.1:${address.port}` };
}

async function connect(
  url: string,
  headers: Record<string, string>,
): Promise<WebSocket> {
  const webSocket = new WebSocket(url, { headers });
  await new Promise<void>((resolve, reject) => {
    webSocket.once("open", resolve);
    webSocket.once("error", reject);
  });
  return webSocket;
}

function nextChunk(stream: PassThrough): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    stream.once("data", (chunk: unknown) => {
      if (Buffer.isBuffer(chunk)) {
        resolve(chunk);
      } else {
        reject(new Error("Expected one Buffer chunk."));
      }
    });
  });
}

function nextTextMessage(webSocket: WebSocket): Promise<string> {
  return new Promise((resolve, reject) => {
    webSocket.once("message", (data, isBinary) => {
      if (isBinary) {
        reject(new Error("Expected one text frame."));
      } else {
        resolve(
          Buffer.isBuffer(data)
            ? data.toString("utf8")
            : Array.isArray(data)
              ? Buffer.concat(data).toString("utf8")
              : Buffer.from(data).toString("utf8"),
        );
      }
    });
  });
}
