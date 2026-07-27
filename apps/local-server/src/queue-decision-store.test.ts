import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  QUEUE_STATE_SCHEMA_VERSION,
  type QueueDecisionRecord,
} from "@pacium/contracts";
import { afterEach, describe, expect, it } from "vitest";

import { computeQueueDecisionHash } from "./queue-decision-hash.js";
import { QueueDecisionStore } from "./queue-decision-store.js";

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
      error: null,
    });
    await expect(lstat(dataDirectory)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("loads a private valid hash-verified document", async () => {
    const fixture = await stateFixture();
    const decision = sampleDecision();
    await writeState(fixture.statePath, {
      schemaVersion: QUEUE_STATE_SCHEMA_VERSION,
      revision: 1,
      decisions: [decision],
    });

    await expect(fixture.store.inspect()).resolves.toEqual({
      status: "ready",
      revision: 1,
      decisions: [decision],
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
      schemaVersion: 2,
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
    });
    await symlink(outside, symlinked.statePath);
    await expect(symlinked.store.inspect()).resolves.toMatchObject({
      status: "error",
      error: { code: "unsafe_permissions" },
    });
  });
});

function sampleDecision(): QueueDecisionRecord {
  const unhashed = {
    decisionId: "28c9142a-8986-43c7-9451-445fd8c13c3e",
    kind: "question_answer" as const,
    source: {
      workspaceId: "pacium",
      workspaceRevision: 4,
      sourceId: "needs-felix",
      observationRevision: 7,
      boundary: "whole_source_v1" as const,
      contentHash: "a".repeat(64),
      itemId: "b".repeat(64),
      itemType: "question" as const,
    },
    payload: {
      answer: "Use the smaller verified slice.",
      note: null,
    },
    actor: {
      kind: "local_operator" as const,
      label: "Local operator" as const,
    },
    decidedAt: "2026-07-27T14:00:00.000Z",
  };
  return {
    ...unhashed,
    decisionHash: computeQueueDecisionHash(unhashed),
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
