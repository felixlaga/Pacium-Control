import { describe, expect, it } from "vitest";

import {
  assertMacosBuildRuntime,
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
});
