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
  MAX_PACIUM_CONFIG_BYTES,
  type PaciumConfigDocument,
} from "@pacium/contracts";
import { afterEach, describe, expect, it } from "vitest";

import { PaciumConfigStore } from "./pacium-config-store.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe("Pacium config store reads", () => {
  it("returns unconfigured without creating an absent data directory", async () => {
    const parent = await temporaryDirectory();
    const dataDirectory = join(parent, "missing");
    const store = new PaciumConfigStore(dataDirectory);

    await expect(store.inspect()).resolves.toEqual({
      status: "unconfigured",
      revision: null,
      workspace: null,
      error: null,
    });
    await expect(lstat(dataDirectory)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("reads one complete private version-1 document", async () => {
    const fixture = await configFixture();
    const document = configDocument();
    await writeFile(fixture.configPath, JSON.stringify(document), {
      mode: 0o600,
    });

    await expect(fixture.store.inspect()).resolves.toEqual({
      status: "ready",
      revision: 3,
      workspace: document.workspace,
      error: null,
    });
  });

  it("preserves invalid, unsupported, and oversized files", async () => {
    const fixture = await configFixture();
    await writeFile(fixture.configPath, "{invalid", { mode: 0o600 });
    const original = await readFile(fixture.configPath);
    await expect(fixture.store.inspect()).resolves.toMatchObject({
      status: "error",
      error: { code: "invalid_file" },
    });
    await expect(readFile(fixture.configPath)).resolves.toEqual(original);

    await writeFile(
      fixture.configPath,
      JSON.stringify({ ...configDocument(), schemaVersion: 2 }),
      { mode: 0o600 },
    );
    await expect(fixture.store.inspect()).resolves.toMatchObject({
      status: "error",
      error: { code: "unsupported_version" },
    });

    await writeFile(
      fixture.configPath,
      Buffer.alloc(MAX_PACIUM_CONFIG_BYTES + 1),
      { mode: 0o600 },
    );
    await expect(fixture.store.inspect()).resolves.toMatchObject({
      status: "error",
      error: { code: "invalid_file" },
    });
  });

  it("rejects unsafe data and file permissions", async () => {
    const fixture = await configFixture();
    await writeFile(fixture.configPath, JSON.stringify(configDocument()), {
      mode: 0o644,
    });
    await expect(fixture.store.inspect()).resolves.toMatchObject({
      status: "error",
      error: { code: "unsafe_permissions" },
    });

    await chmod(fixture.configPath, 0o600);
    await chmod(fixture.dataDirectory, 0o755);
    await expect(fixture.store.inspect()).resolves.toMatchObject({
      status: "error",
      error: { code: "unsafe_permissions" },
    });
  });

  it("rejects a symlink config without reading its target", async () => {
    const fixture = await configFixture();
    const outside = join(fixture.parent, "outside.json");
    await writeFile(outside, JSON.stringify(configDocument()), { mode: 0o600 });
    await symlink(outside, fixture.configPath);

    await expect(fixture.store.inspect()).resolves.toMatchObject({
      status: "error",
      error: { code: "unsafe_permissions" },
    });
  });
});

async function temporaryDirectory(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "pacium-config-store-"));
  temporaryDirectories.push(path);
  return path;
}

async function configFixture() {
  const parent = await temporaryDirectory();
  const dataDirectory = join(parent, "state");
  await mkdir(dataDirectory, { mode: 0o700 });
  return {
    parent,
    dataDirectory,
    configPath: join(dataDirectory, "pacium.json"),
    store: new PaciumConfigStore(dataDirectory),
  };
}

function configDocument(): PaciumConfigDocument {
  return {
    schemaVersion: 1,
    revision: 3,
    workspace: {
      id: "primary",
      label: "Pacium",
      repositories: [],
      roles: { meta: null, orchestrator: null },
      workers: [],
      queueSources: [],
      deliveryMethods: [],
      context: { objective: null, plan: null },
    },
  };
}
