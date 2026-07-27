import { realpathSync } from "node:fs";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { PaciumWorkspace } from "@pacium/contracts";
import { afterEach, describe, expect, it } from "vitest";

import {
  canonicalPotentialDirectory,
  normalizePaciumWorkspace,
  normalizePaciumWorkspacePaths,
  PaciumConfigValidationError,
  validatePersistedPaciumWorkspace,
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

describe("Pacium workspace server-owned references", () => {
  it("allows unresolved persisted sessions but rejects noncanonical persisted paths", async () => {
    const fixture = await createFixture();
    const candidate = workspace(fixture);
    candidate.roles.meta = {
      type: "session",
      sessionId: "03c2723f-e87a-4707-86af-d6fdb1e60f47",
    };
    const context = {
      dataDirectory: join(fixture.dataParent, "pacium-data"),
      launchPresetExists: () => true,
      verificationCatalog: {
        configured: false as const,
        repositories: [],
      },
    };

    expect(() =>
      validatePersistedPaciumWorkspace(candidate, context),
    ).not.toThrow();

    candidate.repositories[0]!.root = `${fixture.repository}/../repository`;
    expect(() => validatePersistedPaciumWorkspace(candidate, context)).toThrow(
      "not canonical",
    );
  });

  it("accepts live sessions, fixed launch presets, and exact-root checks", async () => {
    const fixture = await createFixture();
    const candidate = workspace(fixture);
    candidate.roles.meta = {
      type: "session",
      sessionId: "03c2723f-e87a-4707-86af-d6fdb1e60f47",
    };
    candidate.roles.orchestrator = {
      type: "launch_preset",
      launchPreset: "codex",
      repositoryId: "pacium",
    };
    candidate.repositories[0]!.verificationPresetIds = ["verify"];

    expect(
      normalizePaciumWorkspace(candidate, {
        dataDirectory: join(fixture.dataParent, "pacium-data"),
        sessionExists: (sessionId) =>
          sessionId === "03c2723f-e87a-4707-86af-d6fdb1e60f47",
        launchPresetExists: (preset) => preset === "codex",
        verificationCatalog: {
          configured: true,
          repositories: [
            {
              root: fixture.repository,
              presets: [
                {
                  id: "verify",
                  label: "Verify",
                  description: "Run checks",
                  executable: "/bin/zsh",
                  args: [],
                  timeoutMs: 10_000,
                },
              ],
            },
          ],
        },
      }),
    ).toMatchObject({
      roles: {
        meta: { type: "session" },
        orchestrator: { type: "launch_preset" },
      },
      repositories: [{ verificationPresetIds: ["verify"] }],
    });
  });

  it("rejects missing live sessions, launch presets, and verification IDs", async () => {
    const fixture = await createFixture();
    const baseContext = {
      dataDirectory: join(fixture.dataParent, "pacium-data"),
      sessionExists: () => false,
      launchPresetExists: () => true,
      verificationCatalog: {
        configured: false,
        repositories: [],
      },
    };
    const missingSession = workspace(fixture);
    missingSession.roles.meta = {
      type: "session",
      sessionId: "03c2723f-e87a-4707-86af-d6fdb1e60f47",
    };
    expect(() => normalizePaciumWorkspace(missingSession, baseContext)).toThrow(
      "not live",
    );

    const missingLaunch = workspace(fixture);
    missingLaunch.roles.meta = {
      type: "launch_preset",
      launchPreset: "codex",
      repositoryId: null,
    };
    expect(() =>
      normalizePaciumWorkspace(missingLaunch, {
        ...baseContext,
        launchPresetExists: () => false,
      }),
    ).toThrow("unknown launch preset");

    const missingCheck = workspace(fixture);
    missingCheck.repositories[0]!.verificationPresetIds = ["verify"];
    expect(() => normalizePaciumWorkspace(missingCheck, baseContext)).toThrow(
      "unknown verification preset",
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
