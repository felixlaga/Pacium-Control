import { describe, expect, it } from "vitest";

import {
  assertReleasePackageContract,
  assertReleaseRuntime,
  inspectArchivePaths,
  inspectTrackedPaths,
  isForbiddenReleasePath,
  validateReleaseManifest,
} from "./release-preflight-contract.mjs";

describe("release preflight contract", () => {
  it("accepts only the exact supported host/runtime matrix", () => {
    expect(
      assertReleaseRuntime({
        platform: "darwin",
        architecture: "arm64",
        nodeVersion: "24.18.0",
        osName: "macOS",
        osVersion: "26.5.1",
      }),
    ).toBe("darwin-arm64");
    expect(
      assertReleaseRuntime({
        platform: "linux",
        architecture: "x64",
        nodeVersion: "24.18.3",
        osName: "Ubuntu",
        osVersion: "24.04",
      }),
    ).toBe("ubuntu-24.04-linux-x64");

    for (const candidate of [
      {
        platform: "darwin",
        architecture: "x64",
        nodeVersion: "24.18.0",
        osName: "macOS",
        osVersion: "26.5.1",
      },
      {
        platform: "linux",
        architecture: "arm64",
        nodeVersion: "24.18.0",
        osName: "Ubuntu",
        osVersion: "24.04",
      },
      {
        platform: "linux",
        architecture: "x64",
        nodeVersion: "24.18.0",
        osName: "Debian",
        osVersion: "12",
      },
      {
        platform: "linux",
        architecture: "x64",
        nodeVersion: "26.4.0",
        osName: "Ubuntu",
        osVersion: "24.04",
      },
    ]) {
      expect(() => assertReleaseRuntime(candidate)).toThrow();
    }
  });

  it("requires the exact root runtime contract", () => {
    expect(() =>
      assertReleasePackageContract({
        private: true,
        packageManager: "pnpm@11.17.0",
        engines: { node: ">=24.18.0 <25" },
      }),
    ).not.toThrow();
    expect(() =>
      assertReleasePackageContract({
        private: true,
        packageManager: "pnpm@latest",
        engines: { node: ">=24" },
      }),
    ).toThrow("package-manager pins");
  });

  it("rejects tracked runtime, state, environment, and key material paths", () => {
    for (const path of [
      "node_modules/example/index.js",
      "apps/web/dist/index.js",
      "test-results/trace.zip",
      ".env",
      ".env.local",
      "state/pacium.json",
      "certificates/release.p12",
    ]) {
      expect(isForbiddenReleasePath(path)).toBe(true);
      expect(() => inspectTrackedPaths(["README.md", path])).toThrow(
        "forbidden release path",
      );
    }
    expect(
      inspectTrackedPaths(["README.md", ".env.example", "src/index.ts"]),
    ).toEqual({ trackedFiles: 3 });
  });

  it("rejects unsafe and forbidden archive paths", () => {
    expect(
      inspectArchivePaths(["pacium-control/", "pacium-control/bin/pacium"]),
    ).toMatchObject({ archiveEntries: 2 });
    for (const path of [
      "../outside",
      "/absolute",
      "pacium-control\\hidden",
      "pacium-control/.env",
      "pacium-control/queue-state.json",
    ]) {
      expect(() => inspectArchivePaths(["pacium-control/", path])).toThrow();
    }
  });

  it("validates explicit unsigned macOS development manifests", () => {
    expect(
      validateReleaseManifest(
        manifest({
          target: { platform: "darwin", architecture: "arm64" },
          distribution: {
            developerIdSigned: false,
            notarized: false,
            releaseEligible: false,
          },
        }),
        "darwin-arm64",
      ),
    ).toEqual({ manifestFiles: 1 });
  });

  it("validates explicit non-distro-native Linux development manifests", () => {
    expect(
      validateReleaseManifest(
        manifest({
          target: {
            platform: "linux",
            architecture: "x64",
            distribution: "ubuntu",
            distributionVersion: "24.04",
          },
          distribution: {
            artifactSigned: false,
            distroNative: false,
            releaseEligible: false,
          },
        }),
        "ubuntu-24.04-linux-x64",
      ),
    ).toEqual({ manifestFiles: 1 });
  });

  it("rejects mismatched, release-eligible, duplicate, and hostile manifests", () => {
    const linux = {
      target: {
        platform: "linux",
        architecture: "x64",
        distribution: "ubuntu",
        distributionVersion: "24.04",
      },
      distribution: {
        artifactSigned: false,
        distroNative: false,
        releaseEligible: false,
      },
    };
    expect(() =>
      validateReleaseManifest(manifest(linux), "darwin-arm64"),
    ).toThrow("target");
    expect(() =>
      validateReleaseManifest(
        manifest({
          ...linux,
          distribution: { ...linux.distribution, releaseEligible: true },
        }),
        "ubuntu-24.04-linux-x64",
      ),
    ).toThrow("bounded release contract");
    expect(() =>
      validateReleaseManifest(
        {
          ...manifest(linux),
          files: [file("bin/pacium"), file("bin/pacium")],
        },
        "ubuntu-24.04-linux-x64",
      ),
    ).toThrow("unique");
    expect(() =>
      validateReleaseManifest(
        { ...manifest(linux), files: [file("app/.env")] },
        "ubuntu-24.04-linux-x64",
      ),
    ).toThrow("forbidden");
  });
});

function manifest({ target, distribution }) {
  return {
    schemaVersion: 1,
    packageVersion: "0.0.0",
    protocolVersion: 24,
    target,
    runtime: { nodeRequirement: "24.18.x", nodeBundled: false },
    distribution,
    stateOwnership: "external-preserved",
    files: [file("bin/pacium")],
  };
}

function file(path) {
  return {
    path,
    bytes: 10,
    sha256: "a".repeat(64),
    mode: "0755",
  };
}
