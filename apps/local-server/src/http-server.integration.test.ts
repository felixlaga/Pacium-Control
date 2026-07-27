import { once } from "node:events";
import type { AddressInfo } from "node:net";

import { FakePtyFactory } from "@pacium/test-utils";
import {
  decodeTerminalDataFrame,
  DirectoryListingSchema,
  ServerMessageSchema,
  type ServerMessage,
  type TerminalDataFrame,
} from "@pacium/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocket, type RawData } from "ws";

import type { ServerConfig } from "./config.js";
import type { HostActions } from "./host-actions.js";
import {
  createPaciumHttpServer,
  type PaciumHttpServer,
} from "./http-server.js";
import { SessionManager } from "./session-manager.js";

interface PendingMessage {
  predicate: (message: ServerMessage) => boolean;
  resolve: (message: ServerMessage) => void;
}

interface PendingFrame {
  predicate: (frame: TerminalDataFrame) => boolean;
  resolve: (frame: TerminalDataFrame) => void;
}

interface TestClient {
  socket: WebSocket;
  messages: ServerMessage[];
  pending: PendingMessage[];
  frames: TerminalDataFrame[];
  pendingFrames: PendingFrame[];
}

describe("localhost HTTP and WebSocket boundary", () => {
  let application: PaciumHttpServer | undefined;
  let manager: SessionManager | undefined;

  afterEach(async () => {
    manager?.shutdown();
    if (application !== undefined) {
      await application.close();
    }
  });

  it("keeps a PTY alive across browser transport reconnection", async () => {
    const factory = new FakePtyFactory();
    const setup = await startTestServer(factory);
    application = setup.application;
    manager = setup.manager;

    const first = await connect(setup.url, setup.config);
    const welcome = await nextMessage(
      first,
      (message) => message.type === "server.welcome",
    );
    expect(welcome).toMatchObject({
      type: "server.welcome",
      protocolVersion: 6,
      capabilities: {
        launchPresets: [
          { id: "shell", available: true },
          { id: "codex", available: false },
          { id: "claude", available: false },
        ],
      },
    });
    first.socket.send(
      JSON.stringify({
        type: "session.create",
        requestId: "57c47714-3fed-4cb8-8897-4b8e3d2f9137",
        payload: {
          cwd: process.cwd(),
          launchPreset: "shell",
          cols: 90,
          rows: 28,
        },
      }),
    );
    const created = await nextMessage(
      first,
      (message) => message.type === "session.created",
    );
    if (created.type !== "session.created") {
      throw new Error("Expected a created session");
    }
    expect(created.session).toMatchObject({
      launchPreset: "shell",
      commandLabel: "Shell",
      agentClassification: {
        type: "shell",
        label: "Shell",
        source: "launch_preset",
        confidence: "confirmed",
      },
      repository: {
        status: "ready",
        name: "Pacium Control",
        branch: "dev",
      },
    });
    expect(created.session.agentClassification.observedAt).toBe(
      created.session.createdAt,
    );

    factory.processes[0]?.emitData("survives browser refresh\r\n");
    first.socket.close();
    await once(first.socket, "close");
    expect(manager.list()).toHaveLength(1);

    const second = await connect(setup.url, setup.config);
    await nextMessage(second, (message) => message.type === "server.welcome");
    second.socket.send(
      JSON.stringify({
        type: "terminal.attach",
        requestId: "fe1c40f9-d676-4774-b78f-5a08baa744d8",
        sessionId: created.session.id,
      }),
    );
    const snapshot = await nextMessage(
      second,
      (message) => message.type === "terminal.snapshot",
    );

    expect(snapshot).toMatchObject({
      type: "terminal.snapshot",
      sessionId: created.session.id,
      sequence: 1,
    });
    if (snapshot.type !== "terminal.snapshot") {
      throw new Error("Expected a terminal snapshot");
    }
    expect(snapshot.data).toContain("survives browser refresh");

    second.socket.close();
    await once(second.socket, "close");
  });

  it("subscribes one browser transport to multiple terminal streams", async () => {
    const factory = new FakePtyFactory();
    const setup = await startTestServer(factory);
    application = setup.application;
    manager = setup.manager;

    const creator = await connect(setup.url, setup.config);
    await nextMessage(creator, (message) => message.type === "server.welcome");
    const first = await createTestSession(creator);
    const second = await createTestSession(creator);
    creator.socket.close();
    await once(creator.socket, "close");

    const observer = await connect(setup.url, setup.config);
    await nextMessage(observer, (message) => message.type === "server.welcome");
    for (const [requestId, sessionId] of [
      ["a4e62720-6b66-497d-a3db-37ad2ea6267a", first.id],
      ["9c0a628c-6861-4059-99c5-24dd9ed2beeb", second.id],
    ]) {
      observer.socket.send(
        JSON.stringify({
          type: "terminal.attach",
          requestId,
          sessionId,
        }),
      );
    }

    const firstSnapshot = await nextMessage(
      observer,
      (message) =>
        message.type === "terminal.snapshot" && message.sessionId === first.id,
    );
    const secondSnapshot = await nextMessage(
      observer,
      (message) =>
        message.type === "terminal.snapshot" && message.sessionId === second.id,
    );
    expect(firstSnapshot).toMatchObject({
      type: "terminal.snapshot",
      sessionId: first.id,
    });
    expect(secondSnapshot).toMatchObject({
      type: "terminal.snapshot",
      sessionId: second.id,
    });

    factory.processes[0]?.emitData("first pane\r\n");
    factory.processes[1]?.emitData("second pane\r\n");
    const firstFrame = await nextFrame(
      observer,
      (frame) => frame.sessionId === first.id,
    );
    const secondFrame = await nextFrame(
      observer,
      (frame) => frame.sessionId === second.id,
    );
    expect(firstFrame.data).toContain("first pane");
    expect(secondFrame.data).toContain("second pane");

    observer.socket.close();
    await once(observer.socket, "close");
  });

  it("renames a session and reveals only its detected repository", async () => {
    const revealPath = vi.fn().mockResolvedValue(undefined);
    const setup = await startTestServer(new FakePtyFactory(), { revealPath });
    application = setup.application;
    manager = setup.manager;

    const client = await connect(setup.url, setup.config);
    await nextMessage(client, (message) => message.type === "server.welcome");
    const session = await createTestSession(client);

    client.socket.send(
      JSON.stringify({
        type: "session.rename",
        requestId: "64f1634b-68cb-4102-a754-7c9fb27a99b6",
        sessionId: session.id,
        displayName: "Meta",
      }),
    );
    const renamed = await nextMessage(
      client,
      (message) =>
        message.type === "session.updated" && message.session.id === session.id,
    );
    expect(renamed).toMatchObject({
      type: "session.updated",
      session: { displayName: "Meta" },
    });
    await nextMessage(
      client,
      (message) =>
        message.type === "command.result" &&
        message.requestId === "64f1634b-68cb-4102-a754-7c9fb27a99b6",
    );

    client.socket.send(
      JSON.stringify({
        type: "session.revealRepository",
        requestId: "7e96b977-e4f4-4c42-8ebd-a1ddc464695e",
        sessionId: session.id,
      }),
    );
    await nextMessage(
      client,
      (message) =>
        message.type === "command.result" &&
        message.requestId === "7e96b977-e4f4-4c42-8ebd-a1ddc464695e",
    );
    expect(revealPath).toHaveBeenCalledWith(manager.list()[0]?.repository.root);

    client.socket.close();
    await once(client.socket, "close");
  });

  it("refreshes repository evidence through a typed WebSocket request", async () => {
    const factory = new FakePtyFactory();
    const setup = await startTestServer(factory);
    application = setup.application;
    manager = setup.manager;
    const client = await connect(setup.url, setup.config);
    await nextMessage(client, (message) => message.type === "server.welcome");
    const session = await createTestSession(client);
    const requestId = "2f5f99c6-54b3-4ecf-9b90-6e90b7326ef9";

    client.socket.send(
      JSON.stringify({
        type: "session.refreshRepository",
        requestId,
        sessionId: session.id,
      }),
    );
    const updated = await nextMessage(
      client,
      (message) =>
        message.type === "session.updated" && message.session.id === session.id,
    );
    expect(updated).toMatchObject({
      type: "session.updated",
      session: {
        id: session.id,
        processState: "live",
        repository: {
          status: "ready",
          branch: "dev",
        },
      },
    });
    expect(factory.processes[0]?.signals).toEqual([]);
    await expect(
      nextMessage(
        client,
        (message) =>
          message.type === "command.result" && message.requestId === requestId,
      ),
    ).resolves.toMatchObject({ ok: true });
    client.socket.close();
    await once(client.socket, "close");
  });

  it("returns changed files from the session-owned repository without touching the PTY", async () => {
    const factory = new FakePtyFactory();
    const setup = await startTestServer(factory);
    application = setup.application;
    manager = setup.manager;
    const client = await connect(setup.url, setup.config);
    await nextMessage(client, (message) => message.type === "server.welcome");
    const session = await createTestSession(client);
    const requestId = "dc19c583-bbc9-4374-bd97-32b62ad5349e";

    client.socket.send(
      JSON.stringify({
        type: "repository.changes",
        requestId,
        sessionId: session.id,
      }),
    );
    await expect(
      nextMessage(
        client,
        (message) =>
          message.type === "repository.changes" &&
          message.requestId === requestId,
      ),
    ).resolves.toMatchObject({
      type: "repository.changes",
      sessionId: session.id,
      observation: {
        status: "ready",
        files: [{ path: "README.md", unstaged: true }],
        totals: { fileCount: 1, additions: 2, deletions: 1 },
      },
    });
    expect(factory.processes[0]?.signals).toEqual([]);
    client.socket.close();
    await once(client.socket, "close");
  });

  it("rejects an invalid local access token", async () => {
    const setup = await startTestServer(new FakePtyFactory());
    application = setup.application;
    manager = setup.manager;

    const socket = new WebSocket(
      `${setup.url}/ws`,
      ["pacium.v1", "pacium.token.invalid"],
      { origin: [...setup.config.allowedOrigins][0] },
    );
    socket.on("error", () => {
      // A rejected upgrade is the expected outcome for this test.
    });
    const [, response] = (await once(socket, "unexpected-response")) as [
      unknown,
      { statusCode: number },
    ];
    expect(response.statusCode).toBe(403);
  });

  it("lists host directories only with the local token and allowed Origin", async () => {
    const setup = await startTestServer(new FakePtyFactory());
    application = setup.application;
    manager = setup.manager;
    const httpUrl = setup.url.replace("ws://", "http://");
    const allowedOrigin = [...setup.config.allowedOrigins][0] ?? "";

    const allowed = await fetch(
      `${httpUrl}/api/directories?path=${encodeURIComponent(process.cwd())}`,
      {
        headers: {
          authorization: `Bearer ${setup.config.accessToken}`,
          origin: allowedOrigin,
        },
      },
    );
    expect(allowed.status).toBe(200);
    const listing = DirectoryListingSchema.parse(await allowed.json());
    expect(listing.currentPath).toBe(process.cwd());
    expect(listing.entries.some(({ name }) => name === "apps")).toBe(true);

    const deniedToken = await fetch(
      `${httpUrl}/api/directories?path=${encodeURIComponent(process.cwd())}`,
      {
        headers: {
          authorization: "Bearer wrong-token",
          origin: allowedOrigin,
        },
      },
    );
    expect(deniedToken.status).toBe(403);

    const deniedOrigin = await fetch(
      `${httpUrl}/api/directories?path=${encodeURIComponent("/missing")}`,
      {
        headers: {
          authorization: `Bearer ${setup.config.accessToken}`,
          origin: "https://hostile.example",
        },
      },
    );
    expect(deniedOrigin.status).toBe(403);
  });
});

async function startTestServer(
  factory: FakePtyFactory,
  hostActions?: HostActions,
): Promise<{
  application: PaciumHttpServer;
  manager: SessionManager;
  config: ServerConfig;
  url: string;
}> {
  const config: ServerConfig = {
    host: "127.0.0.1",
    port: 4174,
    allowedOrigins: new Set(["http://127.0.0.1:4173"]),
    accessToken: "test-access-token",
    serverId: "d5805287-d2b0-41f4-b80f-56c77d892cbc",
    defaultCwd: process.cwd(),
    homeDirectory: process.env.HOME ?? process.cwd(),
    shell: "/bin/zsh",
    environmentKeys: [],
    launchPresets: [
      {
        id: "shell",
        label: "Shell",
        available: true,
        unavailableReason: null,
        executable: "/bin/zsh",
        args: ["-l"],
        classification: {
          type: "shell",
          label: "Shell",
          source: "launch_preset",
          confidence: "confirmed",
        },
      },
      {
        id: "codex",
        label: "Codex",
        available: false,
        unavailableReason: "Codex is not installed or not on PATH.",
        executable: null,
        args: [],
        classification: {
          type: "codex",
          label: "Codex CLI",
          source: "launch_preset",
          confidence: "confirmed",
        },
      },
      {
        id: "claude",
        label: "Claude Code",
        available: false,
        unavailableReason: "Claude Code is not installed or not on PATH.",
        executable: null,
        args: [],
        classification: {
          type: "claude",
          label: "Claude Code CLI",
          source: "launch_preset",
          confidence: "confirmed",
        },
      },
    ],
  };
  const manager = new SessionManager(
    factory,
    config.launchPresets,
    hostActions,
    (cwd, observedAt) =>
      Promise.resolve({
        status: "ready",
        root: cwd,
        name: cwd.split("/").at(-1) ?? cwd,
        branch: "dev",
        headCommit: "a".repeat(40),
        headState: "branch",
        worktreeKind: "main",
        observedAt: observedAt ?? "2026-07-27T10:00:00.000Z",
        error: null,
      }),
    (repository, observedAt) =>
      Promise.resolve({
        status: "ready",
        root: repository.root,
        headCommit: repository.headCommit,
        observedAt: observedAt ?? "2026-07-27T10:00:00.000Z",
        files: [
          {
            path: "README.md",
            previousPath: null,
            kind: "modified",
            staged: false,
            unstaged: true,
            untracked: false,
            conflicted: false,
            additions: 2,
            deletions: 1,
            binary: false,
            large: false,
            sizeBytes: 2_000,
          },
        ],
        totals: {
          fileCount: 1,
          additions: 2,
          deletions: 1,
          unavailableLineCount: 0,
          conflictCount: 0,
        },
        truncated: false,
        error: null,
      }),
  );
  const application = createPaciumHttpServer(config, manager);
  application.server.listen(0, config.host);
  await once(application.server, "listening");
  const address = application.server.address() as AddressInfo;

  return {
    application,
    manager,
    config,
    url: `ws://${config.host}:${address.port}`,
  };
}

async function connect(
  baseUrl: string,
  config: ServerConfig,
): Promise<TestClient> {
  const socket = new WebSocket(
    `${baseUrl}/ws`,
    ["pacium.v1", `pacium.token.${config.accessToken}`],
    { origin: [...config.allowedOrigins][0] },
  );
  const client: TestClient = {
    socket,
    messages: [],
    pending: [],
    frames: [],
    pendingFrames: [],
  };
  socket.on("message", (data, isBinary) => {
    if (isBinary) {
      const frame = decodeTerminalDataFrame(toArrayBuffer(data));
      const pendingIndex = client.pendingFrames.findIndex(({ predicate }) =>
        predicate(frame),
      );
      if (pendingIndex === -1) {
        client.frames.push(frame);
        return;
      }
      const pending = client.pendingFrames.splice(pendingIndex, 1)[0];
      pending?.resolve(frame);
      return;
    }
    const message = ServerMessageSchema.parse(JSON.parse(toUtf8(data)));
    const pendingIndex = client.pending.findIndex(({ predicate }) =>
      predicate(message),
    );
    if (pendingIndex === -1) {
      client.messages.push(message);
      return;
    }
    const pending = client.pending.splice(pendingIndex, 1)[0];
    pending?.resolve(message);
  });
  await once(socket, "open");
  return client;
}

async function createTestSession(client: TestClient): Promise<{ id: string }> {
  client.socket.send(
    JSON.stringify({
      type: "session.create",
      requestId: crypto.randomUUID(),
      payload: {
        cwd: process.cwd(),
        launchPreset: "shell",
        cols: 80,
        rows: 24,
      },
    }),
  );
  const created = await nextMessage(
    client,
    (message) => message.type === "session.created",
  );
  if (created.type !== "session.created") {
    throw new Error("Expected a created session");
  }
  return { id: created.session.id };
}

async function nextMessage(
  client: TestClient,
  predicate: (message: ServerMessage) => boolean,
): Promise<ServerMessage> {
  const index = client.messages.findIndex(predicate);
  if (index !== -1) {
    const message = client.messages.splice(index, 1)[0];
    if (message !== undefined) {
      return message;
    }
  }
  return new Promise<ServerMessage>((resolve) => {
    client.pending.push({ predicate, resolve });
  });
}

async function nextFrame(
  client: TestClient,
  predicate: (frame: TerminalDataFrame) => boolean,
): Promise<TerminalDataFrame> {
  const index = client.frames.findIndex(predicate);
  if (index !== -1) {
    const frame = client.frames.splice(index, 1)[0];
    if (frame !== undefined) {
      return frame;
    }
  }
  return new Promise<TerminalDataFrame>((resolve) => {
    client.pendingFrames.push({ predicate, resolve });
  });
}

function toArrayBuffer(data: RawData): ArrayBuffer {
  const buffer = Array.isArray(data)
    ? Buffer.concat(data)
    : data instanceof ArrayBuffer
      ? Buffer.from(data)
      : Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}

function toUtf8(data: RawData): string {
  if (Array.isArray(data)) {
    return Buffer.concat(data).toString("utf8");
  }
  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString("utf8");
  }
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString(
    "utf8",
  );
}
