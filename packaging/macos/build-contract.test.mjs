import { describe, expect, it } from "vitest";

import {
  assertMacosBuildRuntime,
  assertReproducibleMachOMetadata,
  assertSafeManifestPath,
  octalMode,
} from "./build-contract.mjs";

describe("macOS package build contract", () => {
  it("requires the supported build platform and runtime", () => {
    expect(() =>
      assertMacosBuildRuntime({
        platform: "darwin",
        architecture: "arm64",
        nodeVersion: "24.18.0",
      }),
    ).not.toThrow();
    expect(() =>
      assertMacosBuildRuntime({
        platform: "linux",
        architecture: "arm64",
        nodeVersion: "24.18.0",
      }),
    ).toThrow("darwin");
    expect(() =>
      assertMacosBuildRuntime({
        platform: "darwin",
        architecture: "x64",
        nodeVersion: "24.18.0",
      }),
    ).toThrow("arm64");
    expect(() =>
      assertMacosBuildRuntime({
        platform: "darwin",
        architecture: "arm64",
        nodeVersion: "26.4.0",
      }),
    ).toThrow("24.18.x");
  });

  it.each([
    "/absolute",
    "../escape",
    "nested/../../escape",
    "C:\\foreign",
    "control\u0000byte",
  ])("rejects an unsafe manifest path: %s", (value) => {
    expect(() => assertSafeManifestPath(value)).toThrow("relative POSIX");
  });

  it("formats only permission bits", () => {
    expect(octalMode(0o100755)).toBe("0755");
    expect(octalMode(0o100644)).toBe("0644");
  });

  it("requires loadable native metadata without source path symbols", () => {
    const valid = {
      loadCommands: "cmd LC_UUID\ncmd LC_CODE_SIGNATURE\n",
      symbols: "0000000000001000 T _pty_spawn\n",
      label: "node-pty",
    };
    expect(() => assertReproducibleMachOMetadata(valid)).not.toThrow();
    expect(() =>
      assertReproducibleMachOMetadata({
        ...valid,
        loadCommands: "cmd LC_CODE_SIGNATURE\n",
      }),
    ).toThrow("UUID");
    expect(() =>
      assertReproducibleMachOMetadata({
        ...valid,
        loadCommands: "cmd LC_UUID\n",
      }),
    ).toThrow("signature");
    expect(() =>
      assertReproducibleMachOMetadata({
        ...valid,
        symbols: "0000000000000000 - 00 0001 OSO /private/build/pty.o\n",
      }),
    ).toThrow("source metadata");
  });
});
