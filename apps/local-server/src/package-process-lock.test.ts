import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { acquirePackageProcessLock } from "./package-process-lock.js";

const roots: string[] = [];

describe("package process lease", () => {
  afterEach(() => {
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("creates and releases only its exact bounded lease", () => {
    const root = temporaryRoot();
    const lockPath = `/tmp/com.pacium.control.${process.pid}.lock`;
    const packageEntry = join(
      root,
      "Pacium Control.app/Contents/Resources/app/apps/local-server/dist/package-launcher.js",
    );
    const release = acquirePackageProcessLock({
      lockPath,
      packageEntry,
      pid: process.pid,
    });

    expect(readFileSync(lockPath, "utf8")).toBe(
      `${process.pid}\n${packageEntry}\n`,
    );
    expect(() =>
      acquirePackageProcessLock({
        lockPath,
        packageEntry,
        pid: process.pid,
      }),
    ).toThrow("Another Pacium package process");

    release();
    expect(() => readFileSync(lockPath, "utf8")).toThrow();
  });

  it("replaces only an exact stale regular-file lease", () => {
    const root = temporaryRoot();
    const lockPath = `/tmp/com.pacium.control.${process.pid}.lock`;
    const packageEntry = join(
      root,
      "Pacium Control.app/Contents/Resources/app/apps/local-server/dist/package-launcher.js",
    );
    writeFileSync(lockPath, `999999999\n${packageEntry}\n`, { mode: 0o600 });

    const release = acquirePackageProcessLock({
      lockPath,
      packageEntry,
      pid: process.pid,
      processExists: () => false,
    });
    expect(readFileSync(lockPath, "utf8")).toBe(
      `${process.pid}\n${packageEntry}\n`,
    );
    release();
  });

  it("accepts the fixed installed Linux package entry", () => {
    const root = temporaryRoot();
    const lockPath = `/tmp/com.pacium.control.${process.pid}.lock`;
    const release = acquirePackageProcessLock({
      lockPath,
      packageEntry: join(
        root,
        "pacium-control/app/apps/local-server/dist/package-launcher.js",
      ),
    });

    release();
  });

  it.each([
    "relative.lock",
    "/private/tmp/com.pacium.control.1.lock",
    "/tmp/foreign.lock",
  ])("rejects a non-fixed lease path: %s", (lockPath) => {
    expect(() =>
      acquirePackageProcessLock({
        lockPath,
        packageEntry:
          "/Applications/Pacium Control.app/Contents/Resources/app/apps/local-server/dist/package-launcher.js",
      }),
    ).toThrow("fixed package lease");
  });
});

function temporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "pacium-process-lock-"));
  roots.push(root);
  return root;
}
