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

  it("degrades an externally drifted workspace without changing its file", async () => {
    const fixture = await configFixture();
    const document = configDocument();
    await writeFile(fixture.configPath, JSON.stringify(document), {
      mode: 0o600,
    });
    const original = await readFile(fixture.configPath);
    const store = new PaciumConfigStore(fixture.dataDirectory, {
      validateStoredWorkspace: () => {
        throw new Error("catalog drift");
      },
    });

    await expect(store.inspect()).resolves.toMatchObject({
      status: "error",
      error: { code: "invalid_file" },
    });
    await expect(readFile(fixture.configPath)).resolves.toEqual(original);
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

describe("Pacium config atomic replacement", () => {
  it("creates private state and increments a complete revision", async () => {
    const parent = await temporaryDirectory();
    const dataDirectory = join(parent, "new-state");
    const store = new PaciumConfigStore(dataDirectory, {
      randomId: () => "create",
    });

    await expect(store.replace(0, workspace("First"))).resolves.toMatchObject({
      status: "ready",
      revision: 1,
      workspace: { label: "First" },
    });
    expect((await lstat(dataDirectory)).mode & 0o777).toBe(0o700);
    expect((await lstat(store.configPath)).mode & 0o777).toBe(0o600);
    expect(JSON.parse(await readFile(store.configPath, "utf8"))).toMatchObject({
      schemaVersion: 1,
      revision: 1,
      workspace: { label: "First" },
    });
  });

  it("serializes concurrent writes and rejects stale revisions", async () => {
    const fixture = await configFixture();
    const store = fixture.store;
    const first = store.replace(0, workspace("First"));
    const duplicate = store.replace(0, workspace("Duplicate"));

    await expect(first).resolves.toMatchObject({ revision: 1 });
    await expect(duplicate).rejects.toMatchObject({ code: "conflict" });
    await expect(store.replace(1, workspace("Second"))).resolves.toMatchObject({
      revision: 2,
      workspace: { label: "Second" },
    });
    await expect(store.replace(1, workspace("Stale"))).rejects.toMatchObject({
      code: "conflict",
    });
    await expect(store.inspect()).resolves.toMatchObject({
      revision: 2,
      workspace: { label: "Second" },
    });
  });

  it("validates before creating a data directory", async () => {
    const parent = await temporaryDirectory();
    const dataDirectory = join(parent, "missing");
    const store = new PaciumConfigStore(dataDirectory, {
      normalizeWorkspace: () => {
        throw new Error("invalid references");
      },
    });

    await expect(store.replace(0, workspace("Invalid"))).rejects.toMatchObject({
      code: "invalid_workspace",
    });
    await expect(lstat(dataDirectory)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("keeps the prior file authoritative when rename fails", async () => {
    const fixture = await configFixture();
    await writeFile(fixture.configPath, JSON.stringify(configDocument()), {
      mode: 0o600,
    });
    const store = new PaciumConfigStore(fixture.dataDirectory, {
      io: {
        rename: async () => {
          throw new Error("injected rename failure");
        },
      },
      randomId: () => "rename-failure",
    });

    await expect(
      store.replace(3, workspace("Replacement")),
    ).rejects.toMatchObject({
      code: "write_failed",
    });
    await expect(store.inspect()).resolves.toMatchObject({
      revision: 3,
      workspace: { label: "Pacium" },
    });
    expect(await readdir(fixture.dataDirectory)).toEqual(["pacium.json"]);
  });

  it("reports unknown durability after rename and requires inspection", async () => {
    const fixture = await configFixture();
    const store = new PaciumConfigStore(fixture.dataDirectory, {
      io: {
        syncDirectory: async () => {
          throw new Error("injected directory sync failure");
        },
      },
      randomId: () => "sync-failure",
    });

    await expect(store.replace(0, workspace("Written"))).rejects.toMatchObject({
      code: "durability_unknown",
    });
    await expect(store.inspect()).resolves.toMatchObject({
      revision: 1,
      workspace: { label: "Written" },
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

function workspace(label: string): PaciumConfigDocument["workspace"] {
  return {
    ...configDocument().workspace,
    label,
  };
}
