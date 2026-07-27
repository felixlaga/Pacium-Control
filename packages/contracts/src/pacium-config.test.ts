import { describe, expect, it } from "vitest";

import {
  MAX_PACIUM_IDENTIFIER_CHARS,
  MAX_PACIUM_LABEL_CHARS,
  MAX_PACIUM_PATH_CHARS,
  PaciumAbsolutePathSchema,
  PaciumBindingSchema,
  PaciumIdentifierSchema,
  PaciumLabelSchema,
  PaciumRepositorySchema,
  PaciumRolesSchema,
  PaciumWorkerSchema,
} from "./pacium-config.js";

describe("Pacium config scalar contracts", () => {
  it("accepts bounded identifiers, labels, and absolute paths", () => {
    expect(
      PaciumIdentifierSchema.safeParse("orchestrator.worker-1").success,
    ).toBe(true);
    expect(PaciumLabelSchema.safeParse("Orchestrator worker").success).toBe(
      true,
    );
    expect(
      PaciumAbsolutePathSchema.safeParse("/work/pacium/NEEDS-FELIX").success,
    ).toBe(true);
  });

  it("rejects controls, relative paths, and excessive values", () => {
    expect(PaciumIdentifierSchema.safeParse("Meta Worker").success).toBe(false);
    expect(
      PaciumIdentifierSchema.safeParse(
        "a".repeat(MAX_PACIUM_IDENTIFIER_CHARS + 1),
      ).success,
    ).toBe(false);
    expect(PaciumLabelSchema.safeParse("Meta\nhidden").success).toBe(false);
    expect(
      PaciumLabelSchema.safeParse("a".repeat(MAX_PACIUM_LABEL_CHARS + 1))
        .success,
    ).toBe(false);
    expect(PaciumAbsolutePathSchema.safeParse("relative/queue").success).toBe(
      false,
    );
    expect(
      PaciumAbsolutePathSchema.safeParse("/queue\u0000hidden").success,
    ).toBe(false);
    expect(
      PaciumAbsolutePathSchema.safeParse(
        `/${"a".repeat(MAX_PACIUM_PATH_CHARS)}`,
      ).success,
    ).toBe(false);
  });
});

describe("Pacium config binding contracts", () => {
  it("accepts only an explicit session or launch-preset binding", () => {
    expect(
      PaciumBindingSchema.safeParse({
        type: "session",
        sessionId: "03c2723f-e87a-4707-86af-d6fdb1e60f47",
      }).success,
    ).toBe(true);
    expect(
      PaciumBindingSchema.safeParse({
        type: "launch_preset",
        launchPreset: "codex",
        repositoryId: "pacium",
      }).success,
    ).toBe(true);
    expect(
      PaciumBindingSchema.safeParse({
        type: "launch_preset",
        launchPreset: "shell",
        repositoryId: null,
      }).success,
    ).toBe(true);
  });

  it("rejects implicit matching and authority-bearing extras", () => {
    expect(
      PaciumBindingSchema.safeParse({
        type: "session",
        sessionId: "03c2723f-e87a-4707-86af-d6fdb1e60f47",
        command: "codex --dangerously-auto-approve-everything",
      }).success,
    ).toBe(false);
    expect(
      PaciumBindingSchema.safeParse({
        type: "launch_preset",
        launchPreset: "custom",
        repositoryId: null,
      }).success,
    ).toBe(false);
    expect(
      PaciumBindingSchema.safeParse({
        type: "name_match",
        name: "Meta",
      }).success,
    ).toBe(false);
  });
});

describe("Pacium role, worker, and repository contracts", () => {
  const sessionBinding = {
    type: "session" as const,
    sessionId: "03c2723f-e87a-4707-86af-d6fdb1e60f47",
  };

  it("allows explicit missing roles and bounded worker slots", () => {
    expect(
      PaciumRolesSchema.safeParse({
        meta: null,
        orchestrator: sessionBinding,
      }).success,
    ).toBe(true);
    expect(
      PaciumWorkerSchema.safeParse({
        id: "worker-api",
        label: "API worker",
        binding: sessionBinding,
      }).success,
    ).toBe(true);
  });

  it("requires repository references rather than verification commands", () => {
    expect(
      PaciumRepositorySchema.safeParse({
        id: "pacium",
        label: "Pacium Control",
        root: "/work/pacium",
        verificationPresetIds: ["verify", "lint"],
      }).success,
    ).toBe(true);
    expect(
      PaciumRepositorySchema.safeParse({
        id: "pacium",
        label: "Pacium Control",
        root: "/work/pacium",
        verificationPresetIds: ["verify", "verify"],
      }).success,
    ).toBe(false);
    expect(
      PaciumRepositorySchema.safeParse({
        id: "pacium",
        label: "Pacium Control",
        root: "/work/pacium",
        verificationPresetIds: [],
        executable: "/bin/zsh",
      }).success,
    ).toBe(false);
  });
});
