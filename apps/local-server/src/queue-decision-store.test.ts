import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  QUEUE_STATE_SCHEMA_VERSION,
  type QueueDeliveryRecord,
  type QueueDecisionRecord,
} from "@pacium/contracts";
import { afterEach, describe, expect, it } from "vitest";

import { computeQueueDecisionHash } from "./queue-decision-hash.js";
import { computeQueueDeliveryHash } from "./queue-delivery-hash.js";
import { QueueDecisionStore } from "./queue-decision-store.js";
import type { QueueDecisionStoreWriteError } from "./queue-decision-store.js";

const cleanup = new Set<string>();

afterEach(async () => {
  await Promise.all(
    [...cleanup].map((path) => rm(path, { recursive: true, force: true })),
  );
  cleanup.clear();
});

describe("queue decision store inspection", () => {
  it("returns empty without creating an absent data directory", async () => {
    const root = await temporaryRoot();
    const dataDirectory = join(root, "data");
    const store = new QueueDecisionStore(dataDirectory);

    await expect(store.inspect()).resolves.toEqual({
      status: "empty",
      revision: 0,
      decisions: [],
      deliveries: [],
      error: null,
    });
    await expect(lstat(dataDirectory)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("loads a private valid hash-verified document", async () => {
    const fixture = await stateFixture();
    const decision = sampleDecision();
    await writeState(fixture.statePath, {
      schemaVersion: QUEUE_STATE_SCHEMA_VERSION,
      revision: 1,
      decisions: [decision],
      deliveries: [],
    });

    await expect(fixture.store.inspect()).resolves.toEqual({
      status: "ready",
      revision: 1,
      decisions: [decision],
      deliveries: [],
      error: null,
    });
    expect((await lstat(fixture.statePath)).mode & 0o777).toBe(0o600);
  });

  it("preserves and reports malformed, unsupported, and tampered state", async () => {
    const malformed = await stateFixture();
    await writeFile(malformed.statePath, "{not-json", { mode: 0o600 });
    await expect(malformed.store.inspect()).resolves.toMatchObject({
      status: "error",
      error: { code: "invalid_file" },
    });
    expect(await readFile(malformed.statePath, "utf8")).toBe("{not-json");

    const unsupported = await stateFixture();
    await writeState(unsupported.statePath, {
      schemaVersion: 3,
      revision: 1,
      decisions: [],
    });
    await expect(unsupported.store.inspect()).resolves.toMatchObject({
      status: "error",
      error: { code: "unsupported_version" },
    });

    const tampered = await stateFixture();
    const decision = sampleDecision();
    await writeState(tampered.statePath, {
      schemaVersion: QUEUE_STATE_SCHEMA_VERSION,
      revision: 1,
      decisions: [
        {
          ...decision,
          payload: {
            answer: "Changed without recomputing the hash.",
            note: null,
          },
        },
      ],
      deliveries: [],
    });
    await expect(tampered.store.inspect()).resolves.toMatchObject({
      status: "error",
      error: { code: "invalid_file" },
    });
  });

  it("rejects public or symlinked state without following it", async () => {
    const publicState = await stateFixture();
    await writeState(publicState.statePath, {
      schemaVersion: QUEUE_STATE_SCHEMA_VERSION,
      revision: 1,
      decisions: [sampleDecision()],
      deliveries: [],
    });
    await chmod(publicState.statePath, 0o644);
    await expect(publicState.store.inspect()).resolves.toMatchObject({
      status: "error",
      error: { code: "unsafe_permissions" },
    });

    const symlinked = await stateFixture();
    const outside = join(symlinked.root, "outside.json");
    await writeState(outside, {
      schemaVersion: QUEUE_STATE_SCHEMA_VERSION,
      revision: 1,
      decisions: [sampleDecision()],
      deliveries: [],
    });
    await symlink(outside, symlinked.statePath);
    await expect(symlinked.store.inspect()).resolves.toMatchObject({
      status: "error",
      error: { code: "unsafe_permissions" },
    });
  });
});

describe("queue decision store append", () => {
  it("reads version-1 state and migrates only on a later mutation", async () => {
    const fixture = await stateFixture();
    const first = sampleDecision();
    await writeState(fixture.statePath, {
      schemaVersion: 1,
      revision: 1,
      decisions: [first],
    });
    const before = await readFile(fixture.statePath);

    await expect(fixture.store.inspect()).resolves.toMatchObject({
      status: "ready",
      revision: 1,
      decisions: [first],
      deliveries: [],
    });
    expect(await readFile(fixture.statePath)).toEqual(before);

    const second = sampleDecision({
      sourceId: "orchestrator-queue",
      itemId: "d".repeat(64),
      contentHash: "e".repeat(64),
      decisionId: "4699b11f-94d3-430a-960e-1c574a03db41",
    });
    await fixture.store.append(second);
    const migrated = JSON.parse(
      await readFile(fixture.statePath, "utf8"),
    ) as Record<string, unknown>;
    expect(migrated).toMatchObject({
      schemaVersion: 2,
      revision: 2,
      decisions: [first, second],
      deliveries: [],
    });
  });

  it("creates private state and appends one validated immutable record", async () => {
    const root = await temporaryRoot();
    const dataDirectory = join(root, "data");
    const decision = sampleDecision();
    const store = new QueueDecisionStore(dataDirectory, {
      randomId: () => "first",
    });

    await expect(store.append(decision)).resolves.toEqual({
      status: "recorded",
      revision: 1,
      decision,
    });
    expect((await lstat(dataDirectory)).mode & 0o777).toBe(0o700);
    expect((await lstat(store.statePath)).mode & 0o777).toBe(0o600);
    await expect(store.inspect()).resolves.toMatchObject({
      status: "ready",
      revision: 1,
      decisions: [decision],
    });
    const restartedStore = new QueueDecisionStore(dataDirectory);
    await expect(restartedStore.inspect()).resolves.toMatchObject({
      status: "ready",
      revision: 1,
      decisions: [decision],
    });
    expect(await readdir(dataDirectory)).toEqual(["queue-state.json"]);
  });

  it("returns an identical replay and rejects a differing decision", async () => {
    const fixture = await stateFixture();
    const decision = sampleDecision();
    await expect(fixture.store.append(decision)).resolves.toMatchObject({
      status: "recorded",
      revision: 1,
    });

    const replay = sampleDecision({
      decisionId: "4699b11f-94d3-430a-960e-1c574a03db41",
      decidedAt: "2026-07-27T14:05:00.000Z",
    });
    await expect(fixture.store.append(replay)).resolves.toEqual({
      status: "existing",
      revision: 1,
      decision,
    });

    const competing = sampleDecision({
      answer: "Use a different slice.",
      decisionId: "a52403c4-d2a1-407d-a6d0-bf8043b866f0",
      decidedAt: "2026-07-27T14:06:00.000Z",
    });
    await expect(fixture.store.append(competing)).rejects.toMatchObject({
      code: "already_decided",
    });
    await expect(fixture.store.inspect()).resolves.toMatchObject({
      status: "ready",
      revision: 1,
      decisions: [decision],
    });
  });

  it("serializes concurrent records without losing either decision", async () => {
    const fixture = await stateFixture();
    const first = sampleDecision();
    const second = sampleDecision({
      sourceId: "orchestrator-queue",
      itemId: "d".repeat(64),
      contentHash: "e".repeat(64),
      decisionId: "4699b11f-94d3-430a-960e-1c574a03db41",
      decidedAt: "2026-07-27T14:05:00.000Z",
    });

    const [firstResult, secondResult] = await Promise.all([
      fixture.store.append(first),
      fixture.store.append(second),
    ]);
    expect(firstResult).toMatchObject({ status: "recorded", revision: 1 });
    expect(secondResult).toMatchObject({ status: "recorded", revision: 2 });
    await expect(fixture.store.inspect()).resolves.toMatchObject({
      status: "ready",
      revision: 2,
      decisions: [first, second],
    });
  });

  it("keeps prior state authoritative when rename fails", async () => {
    const fixture = await stateFixture();
    const original = sampleDecision();
    await fixture.store.append(original);
    const before = await readFile(fixture.statePath);
    const failing = new QueueDecisionStore(fixture.dataDirectory, {
      io: {
        rename: () => Promise.reject(new Error("injected rename failure")),
      },
      randomId: () => "rename-failure",
    });
    const next = sampleDecision({
      sourceId: "orchestrator-queue",
      itemId: "d".repeat(64),
      contentHash: "e".repeat(64),
      decisionId: "4699b11f-94d3-430a-960e-1c574a03db41",
    });

    await expect(failing.append(next)).rejects.toMatchObject({
      code: "write_failed",
    });
    expect(await readFile(fixture.statePath)).toEqual(before);
    expect(await readdir(fixture.dataDirectory)).toEqual(["queue-state.json"]);
  });

  it("reports unknown durability after rename and requires inspection", async () => {
    const fixture = await stateFixture();
    const decision = sampleDecision();
    const store = new QueueDecisionStore(fixture.dataDirectory, {
      io: {
        syncDirectory: () =>
          Promise.reject(new Error("injected directory sync failure")),
      },
      randomId: () => "sync-failure",
    });

    await expect(store.append(decision)).rejects.toMatchObject({
      code: "durability_unknown",
    });
    await expect(fixture.store.inspect()).resolves.toMatchObject({
      status: "ready",
      revision: 1,
      decisions: [decision],
    });
  });

  it("never overwrites invalid existing state", async () => {
    const fixture = await stateFixture();
    await writeFile(fixture.statePath, "{invalid", { mode: 0o600 });

    await expect(fixture.store.append(sampleDecision())).rejects.toEqual(
      expect.objectContaining<Partial<QueueDecisionStoreWriteError>>({
        code: "invalid_state",
      }),
    );
    expect(await readFile(fixture.statePath, "utf8")).toBe("{invalid");
  });
});

describe("queue delivery store mutations", () => {
  it("records one intent, one immutable outcome, and recovers both", async () => {
    const fixture = await stateFixture();
    const decision = sampleDecision();
    const delivery = sampleDelivery(decision);
    await fixture.store.append(decision);

    await expect(fixture.store.beginDelivery(delivery)).resolves.toEqual({
      status: "recorded",
      revision: 2,
      delivery,
    });
    await expect(fixture.store.beginDelivery(delivery)).resolves.toEqual({
      status: "existing",
      revision: 2,
      delivery,
    });

    const outcome = {
      status: "delivered" as const,
      recordedAt: "2026-07-27T15:00:01.000Z",
      evidence: {
        kind: "answer_file_created" as const,
        byteLength: delivery.payloadByteLength,
        contentHash: delivery.payloadHash,
      },
      error: null,
    };
    const finished = await fixture.store.finishDelivery(
      delivery.deliveryId,
      outcome,
    );
    expect(finished).toMatchObject({
      status: "recorded",
      revision: 3,
      delivery: {
        deliveryId: delivery.deliveryId,
        decisionId: delivery.decisionId,
        outcome,
      },
    });
    await expect(
      fixture.store.finishDelivery(delivery.deliveryId, outcome),
    ).resolves.toMatchObject({
      status: "existing",
      revision: 3,
    });

    const restarted = new QueueDecisionStore(fixture.dataDirectory);
    await expect(restarted.inspect()).resolves.toMatchObject({
      status: "ready",
      revision: 3,
      decisions: [decision],
      deliveries: [finished.delivery],
    });
  });

  it("serializes concurrent duplicate intents without duplicate delivery", async () => {
    const fixture = await stateFixture();
    const decision = sampleDecision();
    const delivery = sampleDelivery(decision);
    await fixture.store.append(decision);

    const [first, second] = await Promise.all([
      fixture.store.beginDelivery(delivery),
      fixture.store.beginDelivery(delivery),
    ]);
    expect(first).toMatchObject({ status: "recorded", revision: 2 });
    expect(second).toMatchObject({ status: "existing", revision: 2 });
    await expect(fixture.store.inspect()).resolves.toMatchObject({
      status: "ready",
      deliveries: [delivery],
    });
  });

  it("rejects unknown decisions and a different second outcome", async () => {
    const fixture = await stateFixture();
    const decision = sampleDecision();
    const delivery = sampleDelivery(decision);
    await expect(fixture.store.beginDelivery(delivery)).rejects.toMatchObject({
      code: "invalid_state",
    });

    await fixture.store.append(decision);
    await fixture.store.beginDelivery(delivery);
    await fixture.store.finishDelivery(delivery.deliveryId, {
      status: "failed",
      recordedAt: "2026-07-27T15:00:01.000Z",
      evidence: null,
      error: {
        code: "DELIVERY_WRITE_FAILED",
        message:
          "The configured transport failed before delivery could be confirmed.",
      },
    });
    await expect(
      fixture.store.finishDelivery(delivery.deliveryId, {
        status: "unknown",
        recordedAt: "2026-07-27T15:00:02.000Z",
        evidence: null,
        error: {
          code: "DELIVERY_OUTCOME_UNKNOWN",
          message:
            "The delivery side effect may have occurred, but its durable outcome is unknown. Pacium will not retry it.",
        },
      }),
    ).rejects.toMatchObject({
      code: "invalid_state",
    });
  });
});

function sampleDecision(
  overrides: {
    answer?: string;
    contentHash?: string;
    decidedAt?: string;
    decisionId?: string;
    itemId?: string;
    sourceId?: string;
  } = {},
): QueueDecisionRecord {
  const unhashed = {
    decisionId: overrides.decisionId ?? "28c9142a-8986-43c7-9451-445fd8c13c3e",
    kind: "question_answer" as const,
    source: {
      workspaceId: "pacium",
      workspaceRevision: 4,
      sourceId: overrides.sourceId ?? "needs-felix",
      observationRevision: 7,
      boundary: "whole_source_v1" as const,
      contentHash: overrides.contentHash ?? "a".repeat(64),
      itemId: overrides.itemId ?? "b".repeat(64),
      itemType: "question" as const,
    },
    payload: {
      answer: overrides.answer ?? "Use the smaller verified slice.",
      note: null,
    },
    actor: {
      kind: "local_operator" as const,
      label: "Local operator" as const,
    },
    decidedAt: overrides.decidedAt ?? "2026-07-27T14:00:00.000Z",
  };
  return {
    ...unhashed,
    decisionHash: computeQueueDecisionHash(unhashed),
  };
}

function sampleDelivery(decision: QueueDecisionRecord): QueueDeliveryRecord {
  const unhashed = {
    deliveryId: "4699b11f-94d3-430a-960e-1c574a03db41",
    decisionId: decision.decisionId,
    decisionHash: decision.decisionHash,
    target: {
      type: "answer_file" as const,
      methodId: "answers",
      methodLabel: "Pacium answers",
      path: "/private/tmp/PACIUM-ANSWERS",
    },
    payloadHash: "d".repeat(64),
    payloadByteLength: 512,
    requestedAt: "2026-07-27T15:00:00.000Z",
    outcome: null,
  };
  return {
    ...unhashed,
    deliveryHash: computeQueueDeliveryHash(unhashed),
  };
}

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "pacium-queue-state-"));
  cleanup.add(root);
  return root;
}

async function stateFixture(): Promise<{
  root: string;
  dataDirectory: string;
  statePath: string;
  store: QueueDecisionStore;
}> {
  const root = await temporaryRoot();
  const dataDirectory = join(root, "data");
  await mkdir(dataDirectory, { mode: 0o700 });
  return {
    root,
    dataDirectory,
    statePath: join(dataDirectory, "queue-state.json"),
    store: new QueueDecisionStore(dataDirectory),
  };
}

async function writeState(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}
