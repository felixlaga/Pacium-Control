import { describe, expect, it } from "vitest";

import {
  MAX_RELAUNCH_MANIFESTS,
  RelaunchManifestSchema,
  RelaunchManifestStateSchema,
  type RelaunchManifest,
} from "./relaunch-manifest.js";

const firstSessionId = "5fe26a52-3f3c-41ef-8dba-6f93062eeec5";

function manifest(overrides: Partial<RelaunchManifest> = {}): RelaunchManifest {
  return {
    schemaVersion: 1,
    id: "66bd01dc-a1c3-4341-9c3c-153027b7f098",
    sessionId: firstSessionId,
    predecessorSessionId: null,
    displayName: "Codex — Pacium",
    launchPreset: "codex",
    provider: "codex",
    command: {
      executable: "/opt/homebrew/bin/codex",
      args: [],
    },
    cwd: "/work/pacium",
    repository: {
      root: "/work/pacium",
      name: "pacium",
    },
    environmentKeys: ["HOME", "PATH"],
    runtime: "pty",
    resumeReference: null,
    createdAt: "2026-07-28T10:00:00.000Z",
    updatedAt: "2026-07-28T10:00:00.000Z",
    ...overrides,
  };
}

describe("relaunch manifest contract", () => {
  it("accepts bounded server-owned launch metadata", () => {
    expect(RelaunchManifestSchema.parse(manifest())).toEqual(manifest());
  });

  it("requires provider and resume evidence to match the preset", () => {
    expect(
      RelaunchManifestSchema.safeParse(
        manifest({ launchPreset: "shell", provider: "codex" }),
      ).success,
    ).toBe(false);
    expect(
      RelaunchManifestSchema.safeParse(
        manifest({
          resumeReference: {
            provider: "claude",
            id: "claude-session",
            observedAt: "2026-07-28T10:01:00.000Z",
          },
        }),
      ).success,
    ).toBe(false);
  });

  it("rejects duplicate or unsafe environment key names", () => {
    expect(
      RelaunchManifestSchema.safeParse(
        manifest({ environmentKeys: ["PATH", "PATH"] }),
      ).success,
    ).toBe(false);
    expect(
      RelaunchManifestSchema.safeParse(
        manifest({ environmentKeys: ["PATH=value"] }),
      ).success,
    ).toBe(false);
  });

  it("rejects controls and self-referential lineage", () => {
    expect(
      RelaunchManifestSchema.safeParse(
        manifest({
          resumeReference: {
            provider: "codex",
            id: "thread\nsecret",
            observedAt: "2026-07-28T10:01:00.000Z",
          },
        }),
      ).success,
    ).toBe(false);
    expect(
      RelaunchManifestSchema.safeParse(
        manifest({ predecessorSessionId: firstSessionId }),
      ).success,
    ).toBe(false);
  });

  it("requires a unique newest-first bounded state catalog", () => {
    const newer = manifest({
      id: "d1825955-65c5-4344-9830-d9f158b05c16",
      sessionId: "3beea8bf-3f2d-4ad8-af36-8504189c322b",
      createdAt: "2026-07-28T10:05:00.000Z",
      updatedAt: "2026-07-28T10:05:00.000Z",
    });
    expect(
      RelaunchManifestStateSchema.safeParse({
        schemaVersion: 1,
        manifests: [newer, manifest()],
      }).success,
    ).toBe(true);
    expect(
      RelaunchManifestStateSchema.safeParse({
        schemaVersion: 1,
        manifests: [manifest(), newer],
      }).success,
    ).toBe(false);
    expect(
      RelaunchManifestStateSchema.safeParse({
        schemaVersion: 1,
        manifests: Array.from({ length: MAX_RELAUNCH_MANIFESTS + 1 }, () =>
          manifest(),
        ),
      }).success,
    ).toBe(false);
  });

  it("contains key names but no environment values or observer arguments", () => {
    const serialized = JSON.stringify(
      manifest({ environmentKeys: ["PACIUM_TEST_SECRET"] }),
    );
    expect(serialized).toContain("PACIUM_TEST_SECRET");
    expect(serialized).not.toContain("secret-value");
    expect(serialized).not.toContain("PACIUM_CODEX_RUNTIME_TOKEN");
    expect(serialized).not.toContain("--remote-auth-token-env");
  });
});
