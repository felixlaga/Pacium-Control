import { realpathSync } from "node:fs";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { PaciumWorkspace } from "@pacium/contracts";
import { afterEach, describe, expect, it } from "vitest";

import {
  canonicalPotentialDirectory,
  normalizePaciumWorkspacePaths,
  PaciumConfigValidationError,
} from "./pacium-config-normalizer.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe("Pacium workspace path normalization", () => {
  it("canonicalizes repositories and existing or missing metadata leaves", async () => {
    const fixture = await createFixture();
    const repositoryAlias = join(fixture.root, "repository-alias");
    await symlink(fixture.repository, repositoryAlias);
    await writeFile(join(fixture.queue, "NEEDS-FELIX"), "untrusted content");
    const candidate = workspace(fixture);
    candidate.repositories[0]!.root = repositoryAlias;

    const normalized = normalizePaciumWorkspacePaths(
      candidate,
      join(fixture.dataParent, "pacium-data"),
    );

    expect(normalized.repositories[0]!.root).toBe(fixture.repository);
    expect(normalized.queueSources[0]!.path).toBe(
      join(fixture.queue, "NEEDS-FELIX"),
    );
    expect(normalized.deliveryMethods[0]).toMatchObject({
      type: "answer_file",
      path: join(fixture.queue, "PACIUM-ANSWERS"),
    });
    expect(normalized.context.objective?.path).toBe(
      join(fixture.context, "OBJECTIVE"),
    );
  });

  it("rejects symlink and non-file metadata leaves", async () => {
    const fixture = await createFixture();
    const outside = join(fixture.root, "outside.txt");
    await writeFile(outside, "outside");
    await symlink(outside, join(fixture.queue, "NEEDS-FELIX"));
    const linked = workspace(fixture);
    expect(() =>
      normalizePaciumWorkspacePaths(
        linked,
        join(fixture.dataParent, "pacium-data"),
      ),
    ).toThrow("regular non-symlink");

    await rm(join(fixture.queue, "NEEDS-FELIX"));
    await mkdir(join(fixture.queue, "NEEDS-FELIX"));
    expect(() =>
      normalizePaciumWorkspacePaths(
        workspace(fixture),
        join(fixture.dataParent, "pacium-data"),
      ),
    ).toThrow("regular non-symlink");
  });

  it("detects canonical source-answer aliases through parent symlinks", async () => {
    const fixture = await createFixture();
    const queueAlias = join(fixture.root, "queue-alias");
    await symlink(fixture.queue, queueAlias);
    const candidate = workspace(fixture);
    const delivery = candidate.deliveryMethods[0]!;
    if (delivery.type === "answer_file") {
      delivery.path = join(queueAlias, "NEEDS-FELIX");
    }

    expect(() =>
      normalizePaciumWorkspacePaths(
        candidate,
        join(fixture.dataParent, "pacium-data"),
      ),
    ).toThrow("duplicate or conflicting");
  });

  it("rejects data directories inside configured repositories", async () => {
    const fixture = await createFixture();
    expect(() =>
      normalizePaciumWorkspacePaths(
        workspace(fixture),
        join(fixture.repository, ".pacium"),
      ),
    ).toThrow("outside configured repositories");
  });

  it("resolves potential data paths through their nearest existing ancestor", async () => {
    const fixture = await createFixture();
    expect(
      canonicalPotentialDirectory(
        join(fixture.dataParent, "missing", "pacium-data"),
      ),
    ).toBe(join(fixture.dataParent, "missing", "pacium-data"));
    expect(() => canonicalPotentialDirectory("relative")).toThrow(
      PaciumConfigValidationError,
    );
  });
});

async function createFixture() {
  const created = await mkdtemp(join(tmpdir(), "pacium-config-paths-"));
  temporaryDirectories.push(created);
  const root = realpathSync(created);
  const repository = join(root, "repository");
  const queue = join(root, "queue");
  const context = join(root, "context");
  const dataParent = join(root, "state");
  await Promise.all([
    mkdir(repository),
    mkdir(queue),
    mkdir(context),
    mkdir(dataParent),
  ]);
  return { root, repository, queue, context, dataParent };
}

function workspace(fixture: {
  repository: string;
  queue: string;
  context: string;
}): PaciumWorkspace {
  return {
    id: "primary",
    label: "Pacium",
    repositories: [
      {
        id: "pacium",
        label: "Pacium Control",
        root: fixture.repository,
        verificationPresetIds: [],
      },
    ],
    roles: {
      meta: null,
      orchestrator: null,
    },
    workers: [],
    queueSources: [
      {
        id: "needs-felix",
        label: "Needs Felix",
        path: join(fixture.queue, "NEEDS-FELIX"),
        format: "plain_text",
        requestingRole: "unknown",
        deliveryMethodId: "answers",
      },
    ],
    deliveryMethods: [
      {
        id: "answers",
        label: "Answers",
        type: "answer_file",
        path: join(fixture.queue, "PACIUM-ANSWERS"),
      },
    ],
    context: {
      objective: {
        format: "plain_text",
        path: join(fixture.context, "OBJECTIVE"),
      },
      plan: null,
    },
  };
}
