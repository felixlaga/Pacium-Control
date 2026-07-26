import { once } from "node:events";
import type { AddressInfo } from "node:net";

import { FakePtyFactory } from "@pacium/test-utils";
import { ServerMessageSchema, type ServerMessage } from "@pacium/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocket, type RawData } from "ws";

import type { ServerConfig } from "./config.js";
import {
  createPaciumHttpServer,
  type PaciumHttpServer,
} from "./http-server.js";
import { SessionManager } from "./session-manager.js";

interface PendingMessage {
  predicate: (message: ServerMessage) => boolean;
  resolve: (message: ServerMessage) => void;
}

interface TestClient {
  socket: WebSocket;
  messages: ServerMessage[];
  pending: PendingMessage[];
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
      protocolVersion: 2,
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
      repositoryName: "Pacium Control",
    });

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
});

async function startTestServer(factory: FakePtyFactory): Promise<{
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
      },
      {
        id: "codex",
        label: "Codex",
        available: false,
        unavailableReason: "Codex is not installed or not on PATH.",
        executable: null,
        args: [],
      },
      {
        id: "claude",
        label: "Claude Code",
        available: false,
        unavailableReason: "Claude Code is not installed or not on PATH.",
        executable: null,
        args: [],
      },
    ],
  };
  const manager = new SessionManager(factory, config.launchPresets);
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
  };
  socket.on("message", (data, isBinary) => {
    if (isBinary) {
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
