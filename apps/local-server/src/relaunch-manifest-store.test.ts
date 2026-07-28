import {
  chmod,
  lstat,
  mkdtemp,
  mkdir,
  readFile,
  symlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";
import type { RelaunchManifest } from "@pacium/contracts";

import { RelaunchManifestStore } from "./relaunch-manifest-store.js";
import type { RelaunchManifestStoreError } from "./relaunch-manifest-store.js";

function manifest(
  id = "66bd01dc-a1c3-4341-9c3c-153027b7f098",
  sessionId = "5fe26a52-3f3c-41ef-8dba-6f93062eeec5",
): RelaunchManifest {
  return {
    schemaVersion: 1,
    id,
    sessionId,
    predecessorSessionId: null,
    displayName: "Codex",
    launchPreset: "codex",
    provider: "codex",
    command: { executable: "/opt/bin/codex", args: [] },
    cwd: "/work/pacium",
    repository: { root: "/work/pacium", name: "pacium" },
    environmentKeys: ["HOME", "PATH", "PACIUM_TEST_SECRET"],
    runtime: "pty",
    resumeReference: null,
    createdAt: "2026-07-28T10:00:00.000Z",
    updatedAt: "2026-07-28T10:00:00.000Z",
  };
}

describe("relaunch manifest store", () => {
  it("starts empty without creating the data directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "pacium-manifest-"));
    const dataDirectory = join(root, "data");
    const store = new RelaunchManifestStore(dataDirectory);
    await store.initialize();

    expect(store.list()).toEqual([]);
    await expect(lstat(dataDirectory)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("atomically persists private state and reloads it", async () => {
    const root = await mkdtemp(join(tmpdir(), "pacium-manifest-"));
    const dataDirectory = join(root, "data");
    const store = new RelaunchManifestStore(dataDirectory, null, () => "one");
    await store.initialize();
    await store.upsert(manifest());

    expect((await lstat(dataDirectory)).mode & 0o777).toBe(0o700);
    expect((await lstat(store.statePath)).mode & 0o777).toBe(0o600);
    const bytes = await readFile(store.statePath, "utf8");
    expect(bytes).toContain("PACIUM_TEST_SECRET");
    expect(bytes).not.toContain("secret-value");
    expect(bytes).not.toContain("PACIUM_CODEX_RUNTIME_TOKEN");

    const reloaded = new RelaunchManifestStore(dataDirectory);
    await reloaded.initialize();
    expect(reloaded.list()).toEqual([manifest()]);
  });

  it("updates one session manifest without duplicating it", async () => {
    const root = await mkdtemp(join(tmpdir(), "pacium-manifest-"));
    const store = new RelaunchManifestStore(join(root, "data"));
    await store.initialize();
    await store.upsert(manifest());
    await store.upsert({
      ...manifest(),
      resumeReference: {
        provider: "codex",
        id: "thread-1",
        observedAt: "2026-07-28T10:02:00.000Z",
      },
      updatedAt: "2026-07-28T10:02:00.000Z",
    });

    expect(store.list()).toHaveLength(1);
    expect(store.list()[0]?.resumeReference?.id).toBe("thread-1");
  });

  it("rejects malformed and unsupported files without replacing them", async () => {
    const root = await mkdtemp(join(tmpdir(), "pacium-manifest-"));
    const dataDirectory = join(root, "data");
    await mkdir(dataDirectory, { mode: 0o700 });
    const statePath = join(dataDirectory, "relaunch-manifests.json");
    await writeFile(statePath, '{"schemaVersion":99,"manifests":[]}\n', {
      mode: 0o600,
    });
    const before = await readFile(statePath);

    await expect(
      new RelaunchManifestStore(dataDirectory).initialize(),
    ).rejects.toMatchObject({
      code: "unsupported_version",
    } satisfies Partial<RelaunchManifestStoreError>);
    await expect(readFile(statePath)).resolves.toEqual(before);
  });

  it("rejects public and symlinked state", async () => {
    const root = await mkdtemp(join(tmpdir(), "pacium-manifest-"));
    const dataDirectory = join(root, "data");
    await mkdir(dataDirectory, { mode: 0o700 });
    const outside = join(root, "outside.json");
    await writeFile(outside, '{"schemaVersion":1,"manifests":[]}\n', {
      mode: 0o600,
    });
    const statePath = join(dataDirectory, "relaunch-manifests.json");
    await symlink(outside, statePath);
    await expect(
      new RelaunchManifestStore(dataDirectory).initialize(),
    ).rejects.toMatchObject({ code: "unsafe_permissions" });

    await writeFile(join(dataDirectory, "public.json"), "unused");
    await chmod(dataDirectory, 0o755);
    await expect(
      new RelaunchManifestStore(dataDirectory).initialize(),
    ).rejects.toMatchObject({ code: "unsafe_permissions" });
  });
});
