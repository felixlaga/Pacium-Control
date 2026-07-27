import { once } from "node:events";
import {
  lstat,
  mkdtemp,
  readFile,
  realpath,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { FakePty, FakePtyFactory } from "@pacium/test-utils";
import {
  decodeTerminalDataFrame,
  DirectoryListingSchema,
  PROTOCOL_VERSION,
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
      protocolVersion: PROTOCOL_VERSION,
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

  it("reads only the accepted objective and plan over the authenticated socket", async () => {
    const contextDirectory = await mkdtemp(
      join(tmpdir(), "pacium-context-http-"),
    );
    temporaryDirectories.push(contextDirectory);
    const objectivePath = join(contextDirectory, "OBJECTIVE");
    const planPath = join(contextDirectory, "PLAN");
    const objectiveText = "Keep terminal supervision simple.\n";
    const planText = "Inspect evidence before claiming progress.\n";
    await writeFile(objectivePath, objectiveText, { mode: 0o600 });
    await writeFile(planPath, planText, { mode: 0o600 });
    const objectiveCanonicalPath = await realpath(objectivePath);
    const planCanonicalPath = await realpath(planPath);

    const setup = await startTestServer(new FakePtyFactory());
    application = setup.application;
    manager = setup.manager;
    const client = await connect(setup.url, setup.config);
    await nextMessage(client, (message) => message.type === "server.welcome");
    const workspace: PaciumWorkspace = {
      ...paciumWorkspace("Context workspace"),
      context: {
        objective: { path: objectivePath, format: "plain_text" },
        plan: { path: planPath, format: "plain_text" },
      },
    };
    client.socket.send(
      JSON.stringify({
        type: "pacium.config.replace",
        requestId: "bb786ceb-3346-4a6b-b815-c5286a555ba0",
        expectedRevision: 0,
        workspace,
      }),
    );
    await nextMessageWithin(
      client,
      (message) =>
        message.type === "pacium.config" &&
        message.requestId === "bb786ceb-3346-4a6b-b815-c5286a555ba0",
      "context config response",
    );
    const configBefore = await readFile(
      join(setup.config.dataDirectory, "pacium.json"),
    );
    const objectiveBefore = await readFile(objectivePath);
    const planBefore = await readFile(planPath);

    client.socket.send(
      JSON.stringify({
        type: "pacium.context.inspect",
        requestId: "05548142-ef4e-4a41-a3e2-01061cbb3281",
      }),
    );
    const response = await nextMessageWithin(
      client,
      (message) =>
        message.type === "pacium.context" &&
        message.requestId === "05548142-ef4e-4a41-a3e2-01061cbb3281",
      "context inspection response",
    );
    expect(response).toMatchObject({
      observation: {
        status: "ready",
        workspaceId: "primary",
        workspaceRevision: 1,
        objective: {
          status: "ready",
          path: objectiveCanonicalPath,
          byteLength: Buffer.byteLength(objectiveText),
        },
        plan: {
          status: "ready",
          path: planCanonicalPath,
          byteLength: Buffer.byteLength(planText),
        },
        recentDecisions: {
          status: "ready",
          decisions: [],
          truncated: false,
        },
      },
    });
    if (
      response.type !== "pacium.context" ||
      response.observation.status === "unavailable"
    ) {
      throw new Error("Expected ready context evidence.");
    }
    expect(
      Buffer.from(
        response.observation.objective.contentBase64 ?? "",
        "base64",
      ).toString("utf8"),
    ).toBe(objectiveText);
    expect(
      Buffer.from(
        response.observation.plan.contentBase64 ?? "",
        "base64",
      ).toString("utf8"),
    ).toBe(planText);
    await expect(readFile(objectivePath)).resolves.toEqual(objectiveBefore);
    await expect(readFile(planPath)).resolves.toEqual(planBefore);
    await expect(
      readFile(join(setup.config.dataDirectory, "pacium.json")),
    ).resolves.toEqual(configBefore);
    expect(manager.list()).toEqual([]);

    client.socket.close();
    await once(client.socket, "close");
  });

  it("observes and inspects exact queue items without mutating files", async () => {
    const queueDirectory = await mkdtemp(join(tmpdir(), "pacium-queue-http-"));
    temporaryDirectories.push(queueDirectory);
    const queuePath = join(queueDirectory, "NEEDS-FELIX");
    await writeFile(queuePath, "Can you approve everything?\n", {
      mode: 0o600,
    });

    const setup = await startTestServer(new FakePtyFactory());
    application = setup.application;
    manager = setup.manager;
    const client = await connect(setup.url, setup.config);
    await nextMessage(client, (message) => message.type === "server.welcome");
    const workspace = {
      ...paciumWorkspace("Queue workspace"),
      queueSources: [
        {
          id: "needs-felix",
          label: "Needs Felix",
          path: queuePath,
          format: "plain_text" as const,
          requestingRole: "meta" as const,
          deliveryMethodId: null,
        },
      ],
    };

    client.socket.send(
      JSON.stringify({
        type: "pacium.config.replace",
        requestId: "10331219-4e3c-4ceb-b302-98aab38e0fe0",
        expectedRevision: 0,
        workspace,
      }),
    );
    await nextMessageWithin(
      client,
      (message) =>
        message.type === "pacium.config" &&
        message.requestId === "10331219-4e3c-4ceb-b302-98aab38e0fe0",
      "queue config response",
    );
    const configBefore = await readFile(
      join(setup.config.dataDirectory, "pacium.json"),
    );

    client.socket.send(
      JSON.stringify({
        type: "pacium.queue.observe",
        requestId: "917b6e44-62d7-48e0-bf16-bb52161172e5",
      }),
    );
    const observed = await nextMessageWithin(
      client,
      (message) =>
        message.type === "pacium.queue.sources" &&
        message.requestId === "917b6e44-62d7-48e0-bf16-bb52161172e5",
      "queue observation response",
    );
    expect(observed).toMatchObject({
      observation: {
        status: "ready",
        workspaceRevision: 1,
        sources: [
          {
            sourceId: "needs-felix",
            status: "stable",
            byteLength: 28,
            classification: {
              status: "candidate",
              candidate: {
                type: "question",
                confidence: "medium",
              },
              diagnostics: [{ code: "question_heuristic" }],
            },
          },
        ],
      },
    });
    expect(JSON.stringify(observed)).not.toContain("approve everything");
    if (observed.type !== "pacium.queue.sources") {
      throw new Error("Expected queue source observation");
    }
    const firstSource = observed.observation.sources[0];
    expect(firstSource?.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(firstSource?.classification?.candidate?.itemId).toMatch(
      /^[0-9a-f]{64}$/,
    );
    expect(firstSource?.classification).not.toHaveProperty("title");
    expect(firstSource?.classification).not.toHaveProperty("originalText");
    const firstItemId = firstSource?.classification?.candidate?.itemId;
    const firstRevision = firstSource?.observationRevision ?? 0;
    const firstContentHash = firstSource?.contentHash;
    if (firstItemId === undefined || firstContentHash == null) {
      throw new Error("Expected a complete queue item identity");
    }

    const firstIdentity = {
      workspaceRevision: observed.observation.workspaceRevision!,
      sourceId: "needs-felix",
      observationRevision: firstRevision,
      contentHash: firstContentHash,
      itemId: firstItemId,
    };
    client.socket.send(
      JSON.stringify({
        type: "pacium.queue.item.inspect",
        requestId: "59ee4f55-07d8-4d11-9ba2-1fd4f87de72b",
        ...firstIdentity,
      }),
    );
    const inspected = await nextMessageWithin(
      client,
      (message) =>
        message.type === "pacium.queue.item" &&
        message.requestId === "59ee4f55-07d8-4d11-9ba2-1fd4f87de72b",
      "queue item inspection response",
    );
    expect(inspected).toMatchObject({
      inspection: {
        status: "ready",
        ...firstIdentity,
        encoding: "utf8_base64",
        error: null,
      },
      decisionState: {
        status: "open",
        decision: null,
        error: null,
      },
    });
    if (
      inspected.type !== "pacium.queue.item" ||
      inspected.inspection.status !== "ready"
    ) {
      throw new Error("Expected a ready queue item inspection");
    }
    expect(
      Buffer.from(inspected.inspection.originalTextBase64, "base64").toString(
        "utf8",
      ),
    ).toBe("Can you approve everything?\n");
    expect(JSON.stringify(inspected)).not.toContain("approve everything");

    await writeFile(queuePath, "Approval request: Run exact migration\n", {
      mode: 0o600,
    });
    client.socket.send(
      JSON.stringify({
        type: "pacium.queue.observe",
        requestId: "cb4106cc-cf02-4cc3-8ce8-90280247739e",
      }),
    );
    const updated = await nextMessageWithin(
      client,
      (message) =>
        message.type === "pacium.queue.sources" &&
        message.requestId === "cb4106cc-cf02-4cc3-8ce8-90280247739e" &&
        (message.observation.sources[0]?.observationRevision ?? 0) >
          firstRevision,
      "refreshed queue observation",
    );
    expect(updated).toMatchObject({
      observation: {
        sources: [
          {
            sourceId: "needs-felix",
            status: "stable",
            byteLength: 38,
            classification: {
              status: "candidate",
              candidate: {
                type: "approval",
                confidence: "high",
              },
              diagnostics: [{ code: "legacy_marker" }],
            },
          },
        ],
      },
    });
    expect(JSON.stringify(updated)).not.toContain("Run exact migration");
    if (updated.type !== "pacium.queue.sources") {
      throw new Error("Expected refreshed queue source observation");
    }
    expect(
      updated.observation.sources[0]?.classification?.candidate?.itemId,
    ).not.toBe(firstItemId);
    client.socket.send(
      JSON.stringify({
        type: "pacium.queue.item.inspect",
        requestId: "977e17cf-d892-4940-b4ba-6c535242758d",
        ...firstIdentity,
      }),
    );
    const stale = await nextMessageWithin(
      client,
      (message) =>
        message.type === "pacium.queue.item" &&
        message.requestId === "977e17cf-d892-4940-b4ba-6c535242758d",
      "stale queue item response",
    );
    expect(stale).toMatchObject({
      inspection: {
        status: "stale",
        originalTextBase64: null,
        error: { code: "ITEM_STALE" },
      },
      decisionState: null,
    });
    await expect(readFile(queuePath, "utf8")).resolves.toBe(
      "Approval request: Run exact migration\n",
    );
    await expect(
      readFile(join(setup.config.dataDirectory, "pacium.json")),
    ).resolves.toEqual(configBefore);

    client.socket.close();
    await once(client.socket, "close");
  });

  it("requires explicit compatible delivery after an immutable decision", async () => {
    const queueDirectory = await mkdtemp(
      join(tmpdir(), "pacium-decision-http-"),
    );
    temporaryDirectories.push(queueDirectory);
    const queuePath = join(queueDirectory, "NEEDS-FELIX");
    const answerPath = join(queueDirectory, "PACIUM-ANSWERS");
    const questionText = "Question: Choose the implementation boundary\n";
    const answerTargetText = "Existing operator notes\n";
    await writeFile(queuePath, questionText, { mode: 0o600 });
    await writeFile(answerPath, answerTargetText, { mode: 0o600 });

    const factory = new FakePtyFactory();
    const setup = await startTestServer(factory);
    application = setup.application;
    manager = setup.manager;
    const client = await connect(setup.url, setup.config);
    await nextMessage(client, (message) => message.type === "server.welcome");
    const liveSession = await createTestSession(client);
    const workspace = {
      ...paciumWorkspace("Decision workspace"),
      queueSources: [
        {
          id: "needs-felix",
          label: "Needs Felix",
          path: queuePath,
          format: "plain_text" as const,
          requestingRole: "meta" as const,
          deliveryMethodId: "answers",
        },
      ],
      deliveryMethods: [
        {
          id: "answers",
          label: "Pacium answers",
          type: "answer_file" as const,
          path: answerPath,
        },
      ],
    };
    client.socket.send(
      JSON.stringify({
        type: "pacium.config.replace",
        requestId: "2dfebc76-f76c-463a-baca-c867cececf78",
        expectedRevision: 0,
        workspace,
      }),
    );
    await nextMessageWithin(
      client,
      (message) =>
        message.type === "pacium.config" &&
        message.requestId === "2dfebc76-f76c-463a-baca-c867cececf78",
      "decision config response",
    );
    const configBefore = await readFile(
      join(setup.config.dataDirectory, "pacium.json"),
    );

    client.socket.send(
      JSON.stringify({
        type: "pacium.queue.observe",
        requestId: "b9e011fd-ce02-4cf1-b03c-806dc753efdc",
      }),
    );
    const observed = await nextMessageWithin(
      client,
      (message) =>
        message.type === "pacium.queue.sources" &&
        message.requestId === "b9e011fd-ce02-4cf1-b03c-806dc753efdc",
      "decision queue observation",
    );
    if (observed.type !== "pacium.queue.sources") {
      throw new Error("Expected decision queue observation");
    }
    const questionSource = observed.observation.sources[0];
    const questionCandidate = questionSource?.classification?.candidate;
    if (
      observed.observation.workspaceRevision === null ||
      questionSource?.contentHash === null ||
      questionSource === undefined ||
      questionCandidate == null
    ) {
      throw new Error("Expected a complete question identity");
    }
    const questionIdentity = {
      workspaceRevision: observed.observation.workspaceRevision,
      sourceId: questionSource.sourceId,
      observationRevision: questionSource.observationRevision,
      contentHash: questionSource.contentHash,
      itemId: questionCandidate.itemId,
    };

    client.socket.send(
      JSON.stringify({
        type: "pacium.queue.question.answer",
        requestId: "00c9b93f-2d00-4be7-b822-5833f5eb9a83",
        ...questionIdentity,
        payload: {
          answer: "Keep the first slice narrow.",
          note: "Confirmed from exact source evidence.",
        },
      }),
    );
    const recorded = await nextMessageWithin(
      client,
      (message) =>
        message.type === "pacium.queue.decision" &&
        message.requestId === "00c9b93f-2d00-4be7-b822-5833f5eb9a83",
      "recorded question decision",
    );
    expect(recorded).toMatchObject({
      result: {
        status: "recorded",
        ...questionIdentity,
        decision: {
          kind: "question_answer",
          source: {
            workspaceId: "primary",
            itemType: "question",
          },
          payload: {
            answer: "Keep the first slice narrow.",
            note: "Confirmed from exact source evidence.",
          },
          actor: {
            kind: "local_operator",
            label: "Local operator",
          },
        },
        error: null,
      },
    });
    if (
      recorded.type !== "pacium.queue.decision" ||
      recorded.result.status !== "recorded"
    ) {
      throw new Error("Expected a recorded queue decision");
    }
    expect(recorded.result.decision.decisionHash).toMatch(/^[0-9a-f]{64}$/);
    const statePath = join(setup.config.dataDirectory, "queue-state.json");
    const firstState = await readFile(statePath);
    expect((await lstat(statePath)).mode & 0o777).toBe(0o600);
    expect(firstState.toString("utf8")).not.toContain(questionText.trim());

    const writesBeforeContext = [...(factory.processes[0]?.writes ?? [])];
    client.socket.send(
      JSON.stringify({
        type: "pacium.context.inspect",
        requestId: "d5fc630e-88c2-43dd-8911-a5d49c021312",
      }),
    );
    const context = await nextMessageWithin(
      client,
      (message) =>
        message.type === "pacium.context" &&
        message.requestId === "d5fc630e-88c2-43dd-8911-a5d49c021312",
      "recent decision context",
    );
    expect(context).toMatchObject({
      observation: {
        status: "ready",
        objective: { status: "unconfigured" },
        plan: { status: "unconfigured" },
        recentDecisions: {
          status: "ready",
          decisions: [
            {
              decisionId: recorded.result.decision.decisionId,
              decisionHash: recorded.result.decision.decisionHash,
              sourceId: "needs-felix",
              sourceLabel: "Needs Felix",
              sourceCurrent: true,
              response: {
                kind: "question_answer",
                preview: "Keep the first slice narrow.",
                truncated: false,
              },
              delivery: null,
              lifecycle: null,
            },
          ],
          truncated: false,
        },
      },
    });
    const contextPayload = JSON.stringify(context);
    expect(contextPayload).not.toContain(queuePath);
    expect(contextPayload).not.toContain(answerPath);
    expect(contextPayload).not.toContain(questionText.trim());
    expect(contextPayload).not.toContain(
      "Confirmed from exact source evidence.",
    );
    await expect(readFile(queuePath, "utf8")).resolves.toBe(questionText);
    await expect(readFile(answerPath, "utf8")).resolves.toBe(answerTargetText);
    expect(factory.processes[0]?.writes).toEqual(writesBeforeContext);
    expect(manager.hasSession(liveSession.id)).toBe(true);

    client.socket.send(
      JSON.stringify({
        type: "pacium.queue.question.answer",
        requestId: "33477608-02ca-480c-94b3-b56ac33572fb",
        ...questionIdentity,
        payload: {
          answer: "Keep the first slice narrow.",
          note: "Confirmed from exact source evidence.",
        },
      }),
    );
    await expect(
      nextMessageWithin(
        client,
        (message) =>
          message.type === "pacium.queue.decision" &&
          message.requestId === "33477608-02ca-480c-94b3-b56ac33572fb",
        "existing question decision",
      ),
    ).resolves.toMatchObject({
      result: { status: "existing", error: null },
    });
    expect(await readFile(statePath)).toEqual(firstState);

    client.socket.send(
      JSON.stringify({
        type: "pacium.queue.question.answer",
        requestId: "5a175a7f-2bb0-4b7a-a839-ed22daf82ed0",
        ...questionIdentity,
        payload: {
          answer: "Use a competing answer.",
          note: null,
        },
      }),
    );
    await expect(
      nextMessageWithin(
        client,
        (message) =>
          message.type === "pacium.queue.decision" &&
          message.requestId === "5a175a7f-2bb0-4b7a-a839-ed22daf82ed0",
        "competing question decision",
      ),
    ).resolves.toMatchObject({
      result: {
        status: "rejected",
        decision: null,
        error: { code: "ITEM_ALREADY_DECIDED" },
      },
    });
    expect(await readFile(statePath)).toEqual(firstState);

    client.socket.send(
      JSON.stringify({
        type: "pacium.queue.item.inspect",
        requestId: "74201cfb-d98a-4ec6-aedd-81022cfcbb78",
        ...questionIdentity,
      }),
    );
    await expect(
      nextMessageWithin(
        client,
        (message) =>
          message.type === "pacium.queue.item" &&
          message.requestId === "74201cfb-d98a-4ec6-aedd-81022cfcbb78",
        "decided item inspection",
      ),
    ).resolves.toMatchObject({
      inspection: { status: "ready" },
      decisionState: {
        status: "decided",
        decision: {
          kind: "question_answer",
          payload: { answer: "Keep the first slice narrow." },
        },
      },
      deliveryState: {
        status: "unavailable",
        target: { type: "answer_file" },
        error: { code: "DELIVERY_TARGET_OCCUPIED" },
      },
    });

    client.socket.send(
      JSON.stringify({
        type: "pacium.queue.decision.deliver",
        requestId: "bf78ef76-32fd-42f9-af39-0c85ea4043f2",
        decisionId: recorded.result.decision.decisionId,
        decisionHash: recorded.result.decision.decisionHash,
      }),
    );
    await expect(
      nextMessageWithin(
        client,
        (message) =>
          message.type === "pacium.queue.delivery" &&
          message.requestId === "bf78ef76-32fd-42f9-af39-0c85ea4043f2",
        "occupied delivery response",
      ),
    ).resolves.toMatchObject({
      result: {
        status: "rejected",
        state: {
          status: "unavailable",
          error: { code: "DELIVERY_TARGET_OCCUPIED" },
        },
      },
    });

    await expect(readFile(queuePath, "utf8")).resolves.toBe(questionText);
    await expect(readFile(answerPath, "utf8")).resolves.toBe(answerTargetText);
    expect(await readFile(statePath)).toEqual(firstState);

    await unlink(answerPath);
    client.socket.send(
      JSON.stringify({
        type: "pacium.queue.item.inspect",
        requestId: "10224bdf-89ca-4af1-b872-c400b21a090b",
        ...questionIdentity,
      }),
    );
    await expect(
      nextMessageWithin(
        client,
        (message) =>
          message.type === "pacium.queue.item" &&
          message.requestId === "10224bdf-89ca-4af1-b872-c400b21a090b",
        "ready delivery inspection",
      ),
    ).resolves.toMatchObject({
      deliveryState: {
        status: "ready",
        target: { type: "answer_file" },
      },
    });

    client.socket.send(
      JSON.stringify({
        type: "pacium.queue.decision.deliver",
        requestId: "ce84269b-b262-42d3-bce6-b1f026c57a9e",
        decisionId: recorded.result.decision.decisionId,
        decisionHash: recorded.result.decision.decisionHash,
      }),
    );
    const delivered = await nextMessageWithin(
      client,
      (message) =>
        message.type === "pacium.queue.delivery" &&
        message.requestId === "ce84269b-b262-42d3-bce6-b1f026c57a9e",
      "answer-file delivery response",
    );
    expect(delivered).toMatchObject({
      result: {
        status: "delivered",
        state: {
          status: "delivered",
          delivery: {
            outcome: {
              status: "delivered",
              evidence: { kind: "answer_file_created" },
            },
          },
        },
      },
    });
    const answerBytes = await readFile(answerPath, "utf8");
    expect(JSON.parse(answerBytes)).toEqual({
      format: "pacium_decision_v1",
      decision: recorded.result.decision,
    });
    expect((await lstat(answerPath)).mode & 0o777).toBe(0o600);

    client.socket.send(
      JSON.stringify({
        type: "pacium.queue.decision.deliver",
        requestId: "db362e67-99ba-4a1e-92fe-df129a2c1a8f",
        decisionId: recorded.result.decision.decisionId,
        decisionHash: recorded.result.decision.decisionHash,
      }),
    );
    await expect(
      nextMessageWithin(
        client,
        (message) =>
          message.type === "pacium.queue.delivery" &&
          message.requestId === "db362e67-99ba-4a1e-92fe-df129a2c1a8f",
        "existing delivery response",
      ),
    ).resolves.toMatchObject({
      result: {
        status: "existing",
        state: { status: "delivered" },
      },
    });

    if (
      delivered.type !== "pacium.queue.delivery" ||
      delivered.result.state.delivery === null
    ) {
      throw new Error("Expected an immutable answer-file delivery record");
    }
    const deliveryRecord = delivered.result.state.delivery;
    client.socket.send(
      JSON.stringify({
        type: "pacium.queue.item.inspect",
        requestId: "c0703144-566d-43eb-a956-1d2fdd56790d",
        ...questionIdentity,
      }),
    );
    await expect(
      nextMessageWithin(
        client,
        (message) =>
          message.type === "pacium.queue.item" &&
          message.requestId === "c0703144-566d-43eb-a956-1d2fdd56790d",
        "delivered reconciliation inspection",
      ),
    ).resolves.toMatchObject({
      reconciliation: {
        decisionId: recorded.result.decision.decisionId,
        attempts: [{ deliveryId: deliveryRecord.deliveryId }],
        artifact: {
          status: "transport_artifact_present",
          source: "filesystem_observed",
        },
        lifecycle: {
          status: "awaiting_evidence",
          current: null,
          history: [],
        },
        retry: { status: "not_applicable" },
      },
    });

    for (const [requestId, action] of [
      ["3f3918c6-2732-4a65-97d1-3485a6f4d101", "acknowledged"],
      ["e6d4a816-052b-42f1-b8ff-f4a71e44cc4d", "applied"],
    ] as const) {
      client.socket.send(
        JSON.stringify({
          type: "pacium.queue.decision.resolve",
          requestId,
          decisionId: recorded.result.decision.decisionId,
          decisionHash: recorded.result.decision.decisionHash,
          action,
          delivery: {
            deliveryId: deliveryRecord.deliveryId,
            deliveryHash: deliveryRecord.deliveryHash,
          },
          relatedDecision: null,
          note:
            action === "acknowledged"
              ? "Verified acknowledgement outside Pacium."
              : "Verified application outside Pacium.",
        }),
      );
      await expect(
        nextMessageWithin(
          client,
          (message) =>
            message.type === "pacium.queue.resolution" &&
            message.requestId === requestId,
          `${action} lifecycle response`,
        ),
      ).resolves.toMatchObject({
        result: {
          status: "recorded",
          decisionId: recorded.result.decision.decisionId,
          resolution: {
            action,
            actor: {
              kind: "local_operator",
              label: "Local operator",
            },
            source: "human_labelled",
          },
          error: null,
        },
      });
    }

    client.socket.send(
      JSON.stringify({
        type: "pacium.queue.decision.resolve",
        requestId: "cb5df184-d434-4285-996a-aafcc736ba4e",
        decisionId: recorded.result.decision.decisionId,
        decisionHash: recorded.result.decision.decisionHash,
        action: "confirmed_not_delivered",
        delivery: {
          deliveryId: deliveryRecord.deliveryId,
          deliveryHash: deliveryRecord.deliveryHash,
        },
        relatedDecision: null,
        note: null,
      }),
    );
    await expect(
      nextMessageWithin(
        client,
        (message) =>
          message.type === "pacium.queue.resolution" &&
          message.requestId === "cb5df184-d434-4285-996a-aafcc736ba4e",
        "invalid non-delivery lifecycle response",
      ),
    ).resolves.toMatchObject({
      result: {
        status: "rejected",
        resolution: null,
        error: { code: "RESOLUTION_TRANSITION_INVALID" },
      },
    });

    const externalAnswerText = "Externally changed answer target\n";
    await writeFile(answerPath, externalAnswerText, {
      mode: 0o600,
    });
    client.socket.send(
      JSON.stringify({
        type: "pacium.queue.item.inspect",
        requestId: "3a9a29a2-ed0c-455a-b918-567ad4e55106",
        ...questionIdentity,
      }),
    );
    await expect(
      nextMessageWithin(
        client,
        (message) =>
          message.type === "pacium.queue.item" &&
          message.requestId === "3a9a29a2-ed0c-455a-b918-567ad4e55106",
        "changed artifact reconciliation inspection",
      ),
    ).resolves.toMatchObject({
      reconciliation: {
        artifact: {
          status: "target_conflict",
          reason: "answer_file_changed",
        },
        lifecycle: {
          status: "applied",
          history: [{ action: "acknowledged" }, { action: "applied" }],
        },
      },
    });
    await expect(readFile(answerPath, "utf8")).resolves.toBe(
      externalAnswerText,
    );
    await expect(
      readFile(join(setup.config.dataDirectory, "pacium.json")),
    ).resolves.toEqual(configBefore);
    expect(manager.hasSession(liveSession.id)).toBe(true);

    client.socket.close();
    await once(client.socket, "close");

    await setup.application.close();
    setup.manager.shutdown();
    application = undefined;
    manager = undefined;

    const restarted = await startTestServer(
      new FakePtyFactory(),
      undefined,
      undefined,
      setup.config.dataDirectory,
    );
    application = restarted.application;
    manager = restarted.manager;
    const restartedClient = await connect(restarted.url, restarted.config);
    await nextMessage(
      restartedClient,
      (message) => message.type === "server.welcome",
    );
    restartedClient.socket.send(
      JSON.stringify({
        type: "pacium.queue.observe",
        requestId: "af68163e-2ac2-43ee-a26c-6da095733ba6",
      }),
    );
    const restartedInitial = await nextMessageWithin(
      restartedClient,
      (message) =>
        message.type === "pacium.queue.sources" &&
        message.requestId === "af68163e-2ac2-43ee-a26c-6da095733ba6",
      "restarted queue observation",
    );
    if (restartedInitial.type !== "pacium.queue.sources") {
      throw new Error("Expected restarted queue observation");
    }
    let restartedObservation = restartedInitial;
    for (const requestId of [
      "6c12f7bf-b81c-481b-bf6d-917ee1d7ea42",
      "216e87b2-7801-46fb-88ce-ed95d88e622e",
      "d404cdad-bd96-42dd-9dc3-c0032bc36b0a",
    ]) {
      if (
        restartedObservation.observation.sources[0]?.classification
          ?.candidate != null
      ) {
        break;
      }
      restartedClient.socket.send(
        JSON.stringify({
          type: "pacium.queue.observe",
          requestId,
        }),
      );
      const nextObservation = await nextMessageWithin(
        restartedClient,
        (message) =>
          message.type === "pacium.queue.sources" &&
          message.requestId === requestId,
        "settled restarted queue observation",
      );
      if (nextObservation.type !== "pacium.queue.sources") {
        throw new Error("Expected settled restarted queue observation");
      }
      restartedObservation = nextObservation;
    }
    let restartedItem: ServerMessage | null = null;
    let settledRestartedRevision = 0;
    for (const [inspectRequestId, refreshRequestId] of [
      [
        "0154f7ac-e930-492d-b4cb-0570ece2a02e",
        "9cfd2b21-9de9-4029-bd5d-31130bea4526",
      ],
      [
        "6d29bd3b-9b06-42d0-8982-888652f228a1",
        "39529efe-eec5-4e61-8a8a-1d289fc75b1a",
      ],
      [
        "5c0c869a-f32a-45b0-807f-4c15b689058c",
        "8ec35b1d-2e90-4dc8-94e4-79d7c474af94",
      ],
    ] as const) {
      const restartedSource = restartedObservation.observation.sources[0];
      const restartedCandidate =
        restartedSource?.classification?.candidate ?? null;
      if (
        restartedObservation.observation.workspaceRevision === null ||
        restartedSource?.contentHash === null ||
        restartedSource === undefined ||
        restartedCandidate === null
      ) {
        throw new Error("Expected restarted exact queue identity");
      }
      restartedClient.socket.send(
        JSON.stringify({
          type: "pacium.queue.item.inspect",
          requestId: inspectRequestId,
          workspaceRevision: restartedObservation.observation.workspaceRevision,
          sourceId: restartedSource.sourceId,
          observationRevision: restartedSource.observationRevision,
          contentHash: restartedSource.contentHash,
          itemId: restartedCandidate.itemId,
        }),
      );
      const item = await nextMessageWithin(
        restartedClient,
        (message) =>
          message.type === "pacium.queue.item" &&
          message.requestId === inspectRequestId,
        "restarted reconciliation inspection",
      );
      if (
        item.type === "pacium.queue.item" &&
        item.inspection.status === "ready"
      ) {
        restartedItem = item;
        settledRestartedRevision = restartedSource.observationRevision;
        break;
      }
      restartedClient.socket.send(
        JSON.stringify({
          type: "pacium.queue.observe",
          requestId: refreshRequestId,
        }),
      );
      const refreshed = await nextMessageWithin(
        restartedClient,
        (message) =>
          message.type === "pacium.queue.sources" &&
          message.requestId === refreshRequestId,
        "refreshed restart identity",
      );
      if (refreshed.type !== "pacium.queue.sources") {
        throw new Error("Expected refreshed restart identity");
      }
      restartedObservation = refreshed;
    }
    if (restartedItem === null || restartedItem.type !== "pacium.queue.item") {
      throw new Error("Restarted queue identity did not stabilize");
    }
    expect(restartedItem).toMatchObject({
      decisionState: {
        status: "decided",
        decision: {
          decisionId: recorded.result.decision.decisionId,
        },
      },
      deliveryState: {
        status: "delivered",
        delivery: { deliveryId: deliveryRecord.deliveryId },
      },
      reconciliation: {
        artifact: {
          status: "target_conflict",
          reason: "answer_file_changed",
        },
        lifecycle: {
          status: "applied",
          history: [{ action: "acknowledged" }, { action: "applied" }],
        },
      },
    });

    const replacementQueueText = "Approval request: Replace the decision\n";
    await writeFile(queuePath, replacementQueueText, { mode: 0o600 });
    restartedClient.socket.send(
      JSON.stringify({
        type: "pacium.queue.observe",
        requestId: "2f525c11-c46f-45dd-9d26-d7a4b3ae554d",
      }),
    );
    await expect(
      nextMessageWithin(
        restartedClient,
        (message) =>
          ((message.type === "pacium.queue.sources" &&
            message.requestId === "2f525c11-c46f-45dd-9d26-d7a4b3ae554d") ||
            message.type === "pacium.queue.sources.updated") &&
          (message.observation.sources[0]?.observationRevision ?? 0) >
            settledRestartedRevision,
        "source conflict after restart",
      ),
    ).resolves.toMatchObject({
      observation: {
        sources: [
          {
            conflicts: [
              {
                kind: "source_changed_after_decision",
                decisionCount: 1,
              },
            ],
          },
        ],
      },
    });
    await expect(readFile(queuePath, "utf8")).resolves.toBe(
      replacementQueueText,
    );
    restartedClient.socket.close();
    await once(restartedClient.socket, "close");
  });

  it("retries one shell-safe role prompt only after human non-delivery confirmation", async () => {
    const queueDirectory = await mkdtemp(join(tmpdir(), "pacium-role-http-"));
    temporaryDirectories.push(queueDirectory);
    const queuePath = join(queueDirectory, "NEEDS-FELIX");
    const questionText = "Question: Choose the exact worker\n";
    await writeFile(queuePath, questionText, { mode: 0o600 });

    const factory = new FailFirstWritePtyFactory();
    const setup = await startTestServer(factory);
    application = setup.application;
    manager = setup.manager;
    const client = await connect(setup.url, setup.config);
    await nextMessage(client, (message) => message.type === "server.welcome");
    const metaSession = await createTestSession(client);
    const unrelatedSession = await createTestSession(client);
    const workspace = {
      ...paciumWorkspace("Role delivery workspace"),
      roles: {
        meta: {
          type: "session" as const,
          sessionId: metaSession.id,
        },
        orchestrator: null,
      },
      queueSources: [
        {
          id: "needs-felix",
          label: "Needs Felix",
          path: queuePath,
          format: "plain_text" as const,
          requestingRole: "meta" as const,
          deliveryMethodId: "meta-prompt",
        },
      ],
      deliveryMethods: [
        {
          id: "meta-prompt",
          label: "Meta prompt",
          type: "role_prompt" as const,
          role: "meta" as const,
        },
      ],
    };
    client.socket.send(
      JSON.stringify({
        type: "pacium.config.replace",
        requestId: "29249904-528e-4e9e-9db2-42bc58c4bf94",
        expectedRevision: 0,
        workspace,
      }),
    );
    await nextMessageWithin(
      client,
      (message) =>
        message.type === "pacium.config" &&
        message.requestId === "29249904-528e-4e9e-9db2-42bc58c4bf94",
      "role delivery config response",
    );

    client.socket.send(
      JSON.stringify({
        type: "pacium.queue.observe",
        requestId: "ce7ad1bc-bc04-40ca-b203-6060b7e45f5e",
      }),
    );
    const observed = await nextMessageWithin(
      client,
      (message) =>
        message.type === "pacium.queue.sources" &&
        message.requestId === "ce7ad1bc-bc04-40ca-b203-6060b7e45f5e",
      "role delivery queue observation",
    );
    if (observed.type !== "pacium.queue.sources") {
      throw new Error("Expected role delivery queue observation");
    }
    const source = observed.observation.sources[0];
    const candidate = source?.classification?.candidate;
    if (
      observed.observation.workspaceRevision === null ||
      source === undefined ||
      source.contentHash === null ||
      candidate == null
    ) {
      throw new Error("Expected complete role delivery identity");
    }
    const identity = {
      workspaceRevision: observed.observation.workspaceRevision,
      sourceId: source.sourceId,
      observationRevision: source.observationRevision,
      contentHash: source.contentHash,
      itemId: candidate.itemId,
    };
    client.socket.send(
      JSON.stringify({
        type: "pacium.queue.question.answer",
        requestId: "2f3fe63a-c178-4647-b59f-8e32cf90aa85",
        ...identity,
        payload: {
          answer: "Use worker A.\nKeep the scope bounded; $(touch /tmp/no).",
          note: null,
        },
      }),
    );
    const recorded = await nextMessageWithin(
      client,
      (message) =>
        message.type === "pacium.queue.decision" &&
        message.requestId === "2f3fe63a-c178-4647-b59f-8e32cf90aa85",
      "role delivery decision",
    );
    if (
      recorded.type !== "pacium.queue.decision" ||
      recorded.result.status !== "recorded"
    ) {
      throw new Error("Expected recorded role delivery decision");
    }

    client.socket.send(
      JSON.stringify({
        type: "pacium.queue.decision.deliver",
        requestId: "f9cb23d9-4a79-4430-bc05-5b17da0b132f",
        decisionId: recorded.result.decision.decisionId,
        decisionHash: recorded.result.decision.decisionHash,
      }),
    );
    const firstDelivery = await nextMessageWithin(
      client,
      (message) =>
        message.type === "pacium.queue.delivery" &&
        message.requestId === "f9cb23d9-4a79-4430-bc05-5b17da0b132f",
      "failed role delivery response",
    );
    expect(firstDelivery).toMatchObject({
      result: {
        status: "failed",
        state: {
          target: {
            type: "role_prompt",
            role: "meta",
            sessionId: metaSession.id,
            sessionEpoch: metaSession.epoch,
          },
          delivery: {
            outcome: {
              status: "failed",
              evidence: null,
              error: { code: "DELIVERY_TARGET_UNAVAILABLE" },
            },
          },
        },
      },
    });
    if (
      firstDelivery.type !== "pacium.queue.delivery" ||
      firstDelivery.result.state.delivery === null
    ) {
      throw new Error("Expected a durable failed role delivery");
    }
    const firstAttempt = firstDelivery.result.state.delivery;
    expect(factory.processes[0]?.writes).toEqual([]);

    client.socket.send(
      JSON.stringify({
        type: "pacium.queue.item.inspect",
        requestId: "9adebcee-7094-4507-8412-d8d3d13ea353",
        ...identity,
      }),
    );
    await expect(
      nextMessageWithin(
        client,
        (message) =>
          message.type === "pacium.queue.item" &&
          message.requestId === "9adebcee-7094-4507-8412-d8d3d13ea353",
        "locked role retry inspection",
      ),
    ).resolves.toMatchObject({
      deliveryState: {
        status: "failed",
        delivery: { deliveryId: firstAttempt.deliveryId },
      },
      reconciliation: {
        attempts: [{ deliveryId: firstAttempt.deliveryId }],
        artifact: {
          status: "acknowledgement_unavailable",
          source: "provider_unavailable",
          reason: "role_prompt_unobserved",
        },
        lifecycle: { status: "awaiting_evidence" },
        retry: { status: "locked" },
      },
    });

    client.socket.send(
      JSON.stringify({
        type: "pacium.queue.decision.resolve",
        requestId: "285209f2-717a-48f6-aaca-e7c3f3bf957c",
        decisionId: recorded.result.decision.decisionId,
        decisionHash: recorded.result.decision.decisionHash,
        action: "confirmed_not_delivered",
        delivery: {
          deliveryId: firstAttempt.deliveryId,
          deliveryHash: firstAttempt.deliveryHash,
        },
        relatedDecision: null,
        note: "Verified that the first prompt did not reach the role.",
      }),
    );
    await expect(
      nextMessageWithin(
        client,
        (message) =>
          message.type === "pacium.queue.resolution" &&
          message.requestId === "285209f2-717a-48f6-aaca-e7c3f3bf957c",
        "role retry unlock response",
      ),
    ).resolves.toMatchObject({
      result: {
        status: "recorded",
        resolution: {
          action: "confirmed_not_delivered",
          delivery: { deliveryId: firstAttempt.deliveryId },
          source: "human_labelled",
        },
        error: null,
      },
    });

    client.socket.send(
      JSON.stringify({
        type: "pacium.queue.item.inspect",
        requestId: "432ec2a8-e2cc-4f08-a957-f9aefdf2cf17",
        ...identity,
      }),
    );
    await expect(
      nextMessageWithin(
        client,
        (message) =>
          message.type === "pacium.queue.item" &&
          message.requestId === "432ec2a8-e2cc-4f08-a957-f9aefdf2cf17",
        "ready role retry inspection",
      ),
    ).resolves.toMatchObject({
      deliveryState: {
        status: "ready_retry",
        delivery: { deliveryId: firstAttempt.deliveryId },
      },
      reconciliation: {
        lifecycle: { status: "confirmed_not_delivered" },
        retry: { status: "ready" },
      },
    });

    client.socket.send(
      JSON.stringify({
        type: "pacium.queue.decision.deliver",
        requestId: "7dc274c2-6d9e-4261-9335-b79a4478553e",
        decisionId: recorded.result.decision.decisionId,
        decisionHash: recorded.result.decision.decisionHash,
      }),
    );
    const retryDelivery = await nextMessageWithin(
      client,
      (message) =>
        message.type === "pacium.queue.delivery" &&
        message.requestId === "7dc274c2-6d9e-4261-9335-b79a4478553e",
      "successful role retry response",
    );
    expect(retryDelivery).toMatchObject({
      result: {
        status: "delivered",
        state: {
          delivery: {
            outcome: {
              status: "delivered",
              evidence: {
                kind: "terminal_transport_accepted",
                sessionId: metaSession.id,
              },
            },
          },
        },
      },
    });
    if (
      retryDelivery.type !== "pacium.queue.delivery" ||
      retryDelivery.result.state.delivery === null
    ) {
      throw new Error("Expected the durable role retry delivery");
    }
    expect(retryDelivery.result.state.delivery.deliveryId).not.toBe(
      firstAttempt.deliveryId,
    );
    expect(factory.processes[0]?.writes).toHaveLength(1);
    const line = factory.processes[0]?.writes[0];
    expect(line).toMatch(/^# Pacium decision v1 .+\r$/);
    expect(line?.split("\r")).toHaveLength(2);
    expect(line).toContain("\\n");
    expect(line).toContain("$(touch /tmp/no)");
    expect(factory.processes[1]?.writes).toEqual([]);

    client.socket.send(
      JSON.stringify({
        type: "pacium.queue.decision.deliver",
        requestId: "3f75fb1a-7143-46b0-af5e-84396ec500d9",
        decisionId: recorded.result.decision.decisionId,
        decisionHash: recorded.result.decision.decisionHash,
      }),
    );
    await expect(
      nextMessageWithin(
        client,
        (message) =>
          message.type === "pacium.queue.delivery" &&
          message.requestId === "3f75fb1a-7143-46b0-af5e-84396ec500d9",
        "exhausted role retry response",
      ),
    ).resolves.toMatchObject({
      result: {
        status: "existing",
        state: { status: "delivered" },
      },
    });
    expect(factory.processes[0]?.writes).toHaveLength(1);
    expect(manager.hasSession(unrelatedSession.id)).toBe(true);
    await expect(readFile(queuePath, "utf8")).resolves.toBe(questionText);

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
  dataDirectory?: string,
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
    dataDirectory: dataDirectory ?? join(fixtureRoot, "data"),
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

class FailFirstWritePty extends FakePty {
  private failNextWrite = true;

  public override write(data: string): void {
    if (this.failNextWrite) {
      this.failNextWrite = false;
      throw new Error("Synthetic first transport rejection.");
    }
    super.write(data);
  }
}

class FailFirstWritePtyFactory extends FakePtyFactory {
  public override create(
    options: Parameters<FakePtyFactory["create"]>[0],
  ): FakePty {
    this.createCalls.push(options);
    const process = new FailFirstWritePty(41_000 + this.processes.length);
    this.processes.push(process);
    return process;
  }
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

async function createTestSession(
  client: TestClient,
): Promise<{ id: string; epoch: number }> {
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
  return { id: created.session.id, epoch: created.session.epoch };
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

async function nextMessageWithin(
  client: TestClient,
  predicate: (message: ServerMessage) => boolean,
  label: string,
): Promise<ServerMessage> {
  return new Promise<ServerMessage>((resolve, reject) => {
    const deadline = setTimeout(
      () =>
        reject(
          new Error(
            `Timed out waiting for ${label}; buffered messages: ${JSON.stringify(
              client.messages,
            )}`,
          ),
        ),
      2_000,
    );

    void nextMessage(client, predicate).then(
      (message) => {
        clearTimeout(deadline);
        resolve(message);
      },
      (error: unknown) => {
        clearTimeout(deadline);
        reject(error instanceof Error ? error : new Error("Message failed."));
      },
    );
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
