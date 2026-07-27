import { once } from "node:events";
import { lstat, mkdtemp, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { FakePtyFactory } from "@pacium/test-utils";
import {
  decodeTerminalDataFrame,
  DirectoryListingSchema,
  ServerMessageSchema,
  type PaciumWorkspace,
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
import { createPaciumConfigStore } from "./pacium-config-service.js";
import { SessionManager } from "./session-manager.js";
import type { VerificationCatalog } from "./verification-config.js";
import { VerificationRunner } from "./verification-runner.js";

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

const TEST_DIFF_PATCH = "@@ -1 +1 @@\n-old\n+new\n";
const TEST_DIFF_BYTES = Buffer.byteLength(TEST_DIFF_PATCH);
const temporaryDirectories: string[] = [];

describe("localhost HTTP and WebSocket boundary", () => {
  let application: PaciumHttpServer | undefined;
  let manager: SessionManager | undefined;

  afterEach(async () => {
    manager?.shutdown();
    if (application !== undefined) {
      await application.close();
    }
    await Promise.all(
      temporaryDirectories
        .splice(0)
        .map((path) => rm(path, { force: true, recursive: true })),
    );
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
      protocolVersion: 11,
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

  it("gets, replaces, conflicts, and preserves Pacium config over the socket", async () => {
    const setup = await startTestServer(new FakePtyFactory());
    application = setup.application;
    manager = setup.manager;

    const client = await connect(setup.url, setup.config);
    await nextMessage(client, (message) => message.type === "server.welcome");

    client.socket.send(
      JSON.stringify({
        type: "pacium.config.get",
        requestId: "277c794b-df60-43ed-a5c5-b7329a7b4f13",
      }),
    );
    await expect(
      nextMessage(
        client,
        (message) =>
          message.type === "pacium.config" &&
          message.requestId === "277c794b-df60-43ed-a5c5-b7329a7b4f13",
      ),
    ).resolves.toMatchObject({
      observation: {
        status: "unconfigured",
        revision: null,
        workspace: null,
      },
    });

    const initial = paciumWorkspace("Pacium");
    client.socket.send(
      JSON.stringify({
        type: "pacium.config.replace",
        requestId: "80d267b6-2c5e-477c-afd6-51b28af9eaa5",
        expectedRevision: 0,
        workspace: initial,
      }),
    );
    await expect(
      nextMessage(
        client,
        (message) =>
          message.type === "pacium.config" &&
          message.requestId === "80d267b6-2c5e-477c-afd6-51b28af9eaa5",
      ),
    ).resolves.toMatchObject({
      observation: {
        status: "ready",
        revision: 1,
        workspace: {
          label: "Pacium",
          repositories: [{ root: process.cwd() }],
        },
      },
    });

    client.socket.send(
      JSON.stringify({
        type: "pacium.config.replace",
        requestId: "51d4b195-705e-4f07-a36a-90260e991692",
        expectedRevision: 1,
        workspace: { ...initial, label: "Agent workspace" },
      }),
    );
    await expect(
      nextMessage(
        client,
        (message) =>
          message.type === "pacium.config" &&
          message.requestId === "51d4b195-705e-4f07-a36a-90260e991692",
      ),
    ).resolves.toMatchObject({
      observation: {
        status: "ready",
        revision: 2,
        workspace: { label: "Agent workspace" },
      },
    });

    client.socket.send(
      JSON.stringify({
        type: "pacium.config.replace",
        requestId: "6434062c-a6f3-4de5-a36f-60f94b6af106",
        expectedRevision: 1,
        workspace: initial,
      }),
    );
    await expect(
      nextMessage(
        client,
        (message) =>
          message.type === "error" &&
          message.requestId === "6434062c-a6f3-4de5-a36f-60f94b6af106",
      ),
    ).resolves.toMatchObject({
      code: "PACIUM_CONFIG_CONFLICT",
      retryable: true,
    });

    client.socket.send(
      JSON.stringify({
        type: "pacium.config.get",
        requestId: "f612a94f-8de5-4c41-8f26-ee3dcfa0410f",
      }),
    );
    await expect(
      nextMessage(
        client,
        (message) =>
          message.type === "pacium.config" &&
          message.requestId === "f612a94f-8de5-4c41-8f26-ee3dcfa0410f",
      ),
    ).resolves.toMatchObject({
      observation: {
        status: "ready",
        revision: 2,
        workspace: { label: "Agent workspace" },
      },
    });

    client.socket.close();
    await once(client.socket, "close");
  });

  it("rejects a missing live-session binding before touching disk or PTYs", async () => {
    const setup = await startTestServer(new FakePtyFactory());
    application = setup.application;
    manager = setup.manager;

    const client = await connect(setup.url, setup.config);
    await nextMessage(client, (message) => message.type === "server.welcome");
    const liveSession = await createTestSession(client);
    const invalid: PaciumWorkspace = {
      ...paciumWorkspace("Pacium"),
      roles: {
        meta: null,
        orchestrator: {
          type: "session",
          sessionId: "87931f36-a38b-44d7-b096-ce5ba4e76482",
        },
      },
    };

    client.socket.send(
      JSON.stringify({
        type: "pacium.config.replace",
        requestId: "0534556c-60ee-4ccb-bc84-254ff08fbbac",
        expectedRevision: 0,
        workspace: invalid,
      }),
    );
    await expect(
      nextMessage(
        client,
        (message) =>
          message.type === "error" &&
          message.requestId === "0534556c-60ee-4ccb-bc84-254ff08fbbac",
      ),
    ).resolves.toMatchObject({
      code: "PACIUM_CONFIG_INVALID_WORKSPACE",
      retryable: false,
    });
    expect(manager.hasSession(liveSession.id)).toBe(true);
    await expect(lstat(setup.config.dataDirectory)).rejects.toMatchObject({
      code: "ENOENT",
    });

    client.socket.close();
    await once(client.socket, "close");
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

  it("returns one bounded session-owned diff and rejects unsafe selectors", async () => {
    const factory = new FakePtyFactory();
    const setup = await startTestServer(factory);
    application = setup.application;
    manager = setup.manager;
    const client = await connect(setup.url, setup.config);
    await nextMessage(client, (message) => message.type === "server.welcome");
    const session = await createTestSession(client);
    const requestId = "053a6ddc-aa22-48f4-a882-c2668db9dc42";

    client.socket.send(
      JSON.stringify({
        type: "repository.diff",
        requestId,
        sessionId: session.id,
        path: "README.md",
      }),
    );
    const response = await nextMessage(
      client,
      (message) =>
        message.type === "repository.diff" && message.requestId === requestId,
    );
    if (response.type !== "repository.diff") {
      throw new Error("Expected a repository diff response.");
    }
    expect(response.sessionId).toBe(session.id);
    expect(response.observation.status).toBe("ready");
    expect(response.observation.path).toBe("README.md");
    expect(response.observation.sections[0]?.patch).toBe(TEST_DIFF_PATCH);

    const invalidRequestId = "9e9ab3f8-a6ab-41b7-8010-b9fe76d62cdf";
    client.socket.send(
      JSON.stringify({
        type: "repository.diff",
        requestId: invalidRequestId,
        sessionId: session.id,
        path: "../../escape",
      }),
    );
    await expect(
      nextMessage(
        client,
        (message) =>
          message.type === "error" && message.requestId === invalidRequestId,
      ),
    ).resolves.toMatchObject({
      type: "error",
      code: "INVALID_MESSAGE",
    });
    expect(factory.processes[0]?.signals).toEqual([]);
    client.socket.close();
    await once(client.socket, "close");
  });

  it("returns bounded session-owned history and rejects browser revisions", async () => {
    const factory = new FakePtyFactory();
    const setup = await startTestServer(factory);
    application = setup.application;
    manager = setup.manager;
    const client = await connect(setup.url, setup.config);
    await nextMessage(client, (message) => message.type === "server.welcome");
    const session = await createTestSession(client);
    const requestId = "5e7a4d80-e316-4f4b-9dda-11b92f5da776";

    client.socket.send(
      JSON.stringify({
        type: "repository.history",
        requestId,
        sessionId: session.id,
      }),
    );
    await expect(
      nextMessage(
        client,
        (message) =>
          message.type === "repository.history" &&
          message.requestId === requestId,
      ),
    ).resolves.toMatchObject({
      type: "repository.history",
      sessionId: session.id,
      observation: {
        status: "ready",
        headCommit: "a".repeat(40),
        commits: [{ subject: "Bounded history fixture" }],
        truncated: false,
        error: null,
      },
    });

    const invalidRequestId = "7f3b4313-9ba8-478f-8478-0d60515d8b2d";
    client.socket.send(
      JSON.stringify({
        type: "repository.history",
        requestId: invalidRequestId,
        sessionId: session.id,
        revision: "origin/main..HEAD",
      }),
    );
    await expect(
      nextMessage(
        client,
        (message) =>
          message.type === "error" && message.requestId === invalidRequestId,
      ),
    ).resolves.toMatchObject({
      type: "error",
      code: "INVALID_MESSAGE",
    });
    expect(factory.processes[0]?.signals).toEqual([]);
    client.socket.close();
    await once(client.socket, "close");
  });

  it("inspects explicit verification state and rejects browser commands", async () => {
    const factory = new FakePtyFactory();
    const setup = await startTestServer(factory);
    application = setup.application;
    manager = setup.manager;
    const client = await connect(setup.url, setup.config);
    await nextMessage(client, (message) => message.type === "server.welcome");
    const session = await createTestSession(client);
    const requestId = "7869825c-8a29-45b8-b953-ea670d6557a1";

    client.socket.send(
      JSON.stringify({
        type: "repository.verification.inspect",
        requestId,
        sessionId: session.id,
      }),
    );
    await expect(
      nextMessage(
        client,
        (message) =>
          message.type === "repository.verification" &&
          message.requestId === requestId,
      ),
    ).resolves.toMatchObject({
      type: "repository.verification",
      sessionId: session.id,
      observation: {
        status: "unconfigured",
        configured: false,
        presets: [],
        run: null,
      },
    });

    const invalidRequestId = "34e30bba-a9e4-4387-aede-05ac7b89a27b";
    client.socket.send(
      JSON.stringify({
        type: "repository.verification.run",
        requestId: invalidRequestId,
        sessionId: session.id,
        presetId: "verify",
        executable: "/bin/zsh",
        args: ["-lc", "dangerous"],
      }),
    );
    await expect(
      nextMessage(
        client,
        (message) =>
          message.type === "error" && message.requestId === invalidRequestId,
      ),
    ).resolves.toMatchObject({
      type: "error",
      code: "INVALID_MESSAGE",
    });
    expect(factory.processes[0]?.signals).toEqual([]);
    client.socket.close();
    await once(client.socket, "close");
  });

  it("runs and cancels configured verification without touching the PTY", async () => {
    const factory = new FakePtyFactory();
    const runner = new VerificationRunner({
      environment: {},
      observeHead: () => Promise.resolve("a".repeat(40)),
      terminationGraceMs: 50,
    });
    const catalog: VerificationCatalog = {
      configured: true,
      repositories: [
        {
          root: process.cwd(),
          presets: [
            {
              id: "pass",
              label: "Pass",
              description: "Return deterministic evidence",
              executable: process.execPath,
              args: ["-e", "process.stdout.write('verified\\n')"],
              timeoutMs: 2_000,
            },
            {
              id: "wait",
              label: "Wait",
              description: "Wait for explicit cancellation",
              executable: process.execPath,
              args: ["-e", "setInterval(() => {}, 1000)"],
              timeoutMs: 2_000,
            },
          ],
        },
      ],
    };
    const setup = await startTestServer(factory, undefined, {
      catalog,
      runner,
    });
    application = setup.application;
    manager = setup.manager;
    const client = await connect(setup.url, setup.config);
    await nextMessage(client, (message) => message.type === "server.welcome");
    const session = await createTestSession(client);

    const passRequestId = "e110b9e7-dcdd-4054-8f7b-7f5549b9cb38";
    client.socket.send(
      JSON.stringify({
        type: "repository.verification.run",
        requestId: passRequestId,
        sessionId: session.id,
        presetId: "pass",
      }),
    );
    await expect(
      nextMessage(
        client,
        (message) =>
          message.type === "repository.verification" &&
          message.requestId === passRequestId,
      ),
    ).resolves.toMatchObject({
      observation: {
        status: "ready",
        presets: [{ id: "pass" }, { id: "wait" }],
        run: { presetId: "pass", status: "running" },
      },
    });
    await expect(
      nextMessage(
        client,
        (message) =>
          message.type === "repository.verification.updated" &&
          message.observation.run?.presetId === "pass" &&
          message.observation.run.status === "passed",
      ),
    ).resolves.toMatchObject({
      observation: {
        run: { status: "passed", stdout: "verified\n", exitCode: 0 },
      },
    });

    const waitRequestId = "0b3b1f46-f209-44a3-8767-16c9de181156";
    client.socket.send(
      JSON.stringify({
        type: "repository.verification.run",
        requestId: waitRequestId,
        sessionId: session.id,
        presetId: "wait",
      }),
    );
    const waiting = await nextMessage(
      client,
      (message) =>
        message.type === "repository.verification" &&
        message.requestId === waitRequestId,
    );
    if (
      waiting.type !== "repository.verification" ||
      waiting.observation.run === null
    ) {
      throw new Error("Expected an active verification response.");
    }

    const cancelRequestId = "9e72ea62-e8f8-49bb-a729-9c3730250f06";
    client.socket.send(
      JSON.stringify({
        type: "repository.verification.cancel",
        requestId: cancelRequestId,
        sessionId: session.id,
        runId: waiting.observation.run.runId,
      }),
    );
    await expect(
      nextMessage(
        client,
        (message) =>
          message.type === "repository.verification" &&
          message.requestId === cancelRequestId,
      ),
    ).resolves.toMatchObject({
      observation: { run: { presetId: "wait", status: "cancelling" } },
    });
    await expect(
      nextMessage(
        client,
        (message) =>
          message.type === "repository.verification.updated" &&
          message.observation.run?.presetId === "wait" &&
          message.observation.run.status === "cancelled",
      ),
    ).resolves.toMatchObject({
      observation: {
        run: { status: "cancelled", signal: "SIGTERM" },
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
  verification?: {
    catalog: VerificationCatalog;
    runner: VerificationRunner;
  },
): Promise<{
  application: PaciumHttpServer;
  manager: SessionManager;
  config: ServerConfig;
  url: string;
}> {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "pacium-http-"));
  temporaryDirectories.push(fixtureRoot);
  const config: ServerConfig = {
    host: "127.0.0.1",
    port: 4174,
    allowedOrigins: new Set(["http://127.0.0.1:4173"]),
    accessToken: "test-access-token",
    serverId: "d5805287-d2b0-41f4-b80f-56c77d892cbc",
    defaultCwd: process.cwd(),
    homeDirectory: process.env.HOME ?? process.cwd(),
    dataDirectory: join(fixtureRoot, "data"),
    shell: "/bin/zsh",
    environmentKeys: [],
    verificationCatalog: verification?.catalog ?? {
      configured: false,
      repositories: [],
    },
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
    (repository, path, observedAt) =>
      Promise.resolve({
        status: "ready",
        root: repository.root,
        headCommit: repository.headCommit,
        path,
        previousPath: null,
        observedAt: observedAt ?? "2026-07-27T10:00:00.000Z",
        sections: [
          {
            source: "combined",
            patch: TEST_DIFF_PATCH,
            byteCount: TEST_DIFF_BYTES,
            lineCount: 3,
          },
        ],
        patchBytes: TEST_DIFF_BYTES,
        patchLines: 3,
        error: null,
      }),
    (repository, observedAt) =>
      Promise.resolve({
        status: "ready",
        root: repository.root,
        headCommit: "a".repeat(40),
        observedAt: observedAt ?? "2026-07-27T11:00:00.000Z",
        commits: [
          {
            id: "a".repeat(40),
            parents: ["b".repeat(40)],
            authorName: "Pacium Agent",
            authoredAt: "2026-07-27T11:00:00+02:00",
            subject: "Bounded history fixture",
          },
        ],
        truncated: false,
        error: null,
      }),
    config.verificationCatalog,
    verification?.runner,
  );
  const application = createPaciumHttpServer(
    config,
    manager,
    createPaciumConfigStore(config, manager),
  );
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

function paciumWorkspace(label: string): PaciumWorkspace {
  return {
    id: "primary",
    label,
    repositories: [
      {
        id: "pacium",
        label: "Pacium Control",
        root: process.cwd(),
        verificationPresetIds: [],
      },
    ],
    roles: {
      meta: {
        type: "launch_preset",
        launchPreset: "shell",
        repositoryId: "pacium",
      },
      orchestrator: null,
    },
    workers: [],
    queueSources: [],
    deliveryMethods: [],
    context: { objective: null, plan: null },
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
