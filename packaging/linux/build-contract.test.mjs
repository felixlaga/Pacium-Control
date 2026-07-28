import { describe, expect, it } from "vitest";

import {
  assertLinuxBuildRuntime,
  assertSafeManifestPath,
  octalMode,
} from "./build-contract.mjs";

describe("Linux package build contract", () => {
  it("requires the exact Ubuntu runner architecture and runtime", () => {
    expect(() =>
      assertLinuxBuildRuntime({
        platform: "linux",
        architecture: "x64",
        nodeVersion: "24.18.0",
      }),
    ).not.toThrow();
    expect(() =>
      assertLinuxBuildRuntime({
        platform: "darwin",
        architecture: "x64",
        nodeVersion: "24.18.0",
      }),
    ).toThrow("linux");
    expect(() =>
      assertLinuxBuildRuntime({
        platform: "linux",
        architecture: "arm64",
        nodeVersion: "24.18.0",
      }),
    ).toThrow("x64");
    expect(() =>
      assertLinuxBuildRuntime({
        platform: "linux",
        architecture: "x64",
        nodeVersion: "24.19.0",
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
