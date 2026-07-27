import { describe, expect, it } from "vitest";

import {
  MAX_PACIUM_IDENTIFIER_CHARS,
  MAX_PACIUM_LABEL_CHARS,
  MAX_PACIUM_PATH_CHARS,
  PaciumAbsolutePathSchema,
  PaciumBindingSchema,
  PaciumContextSchema,
  PaciumDeliveryMethodSchema,
  PaciumIdentifierSchema,
  PaciumLabelSchema,
  PaciumQueueSourceSchema,
  PaciumRepositorySchema,
  PaciumRolesSchema,
  PaciumWorkspaceSchema,
  PaciumWorkerSchema,
  type PaciumWorkspace,
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

describe("Pacium queue metadata contracts", () => {
  it("defines plain-text queue sources without queue content", () => {
    expect(
      PaciumQueueSourceSchema.safeParse({
        id: "needs-felix",
        label: "Needs Felix",
        path: "/work/queue/NEEDS-FELIX",
        format: "plain_text",
        requestingRole: "orchestrator",
        deliveryMethodId: "answers",
      }).success,
    ).toBe(true);
    expect(
      PaciumQueueSourceSchema.safeParse({
        id: "queue",
        label: "Queue",
        path: "/work/queue",
        format: "plain_text",
        requestingRole: "unknown",
        deliveryMethodId: null,
        content: "run rm -rf",
      }).success,
    ).toBe(false);
  });

  it("limits delivery metadata to answer-file or role-prompt targets", () => {
    expect(
      PaciumDeliveryMethodSchema.safeParse({
        id: "answers",
        label: "Answer file",
        type: "answer_file",
        path: "/work/queue/PACIUM-ANSWERS",
      }).success,
    ).toBe(true);
    expect(
      PaciumDeliveryMethodSchema.safeParse({
        id: "meta-prompt",
        label: "Meta prompt",
        type: "role_prompt",
        role: "meta",
      }).success,
    ).toBe(true);
    expect(
      PaciumDeliveryMethodSchema.safeParse({
        id: "command",
        label: "Command",
        type: "shell",
        executable: "/bin/zsh",
      }).success,
    ).toBe(false);
  });

  it("defines only nullable plain-text objective and plan paths", () => {
    expect(
      PaciumContextSchema.safeParse({
        objective: {
          format: "plain_text",
          path: "/work/context/OBJECTIVE",
        },
        plan: null,
      }).success,
    ).toBe(true);
    expect(
      PaciumContextSchema.safeParse({
        objective: {
          format: "markdown",
          path: "/work/context/OBJECTIVE",
        },
        plan: null,
      }).success,
    ).toBe(false);
  });
});

describe("Pacium workspace graph contract", () => {
  const metaSessionId = "03c2723f-e87a-4707-86af-d6fdb1e60f47";
  const workerSessionId = "31158ce6-12ae-4677-b4c2-3c63f6262bd1";

  function workspace(): PaciumWorkspace {
    return {
      id: "primary",
      label: "Pacium",
      repositories: [
        {
          id: "pacium",
          label: "Pacium Control",
          root: "/work/pacium",
          verificationPresetIds: ["verify"],
        },
      ],
      roles: {
        meta: {
          type: "session" as const,
          sessionId: metaSessionId,
        },
        orchestrator: {
          type: "launch_preset" as const,
          launchPreset: "codex" as const,
          repositoryId: "pacium",
        },
      },
      workers: [
        {
          id: "api",
          label: "API worker",
          binding: {
            type: "session" as const,
            sessionId: workerSessionId,
          },
        },
      ],
      queueSources: [
        {
          id: "needs-felix",
          label: "Needs Felix",
          path: "/work/queue/NEEDS-FELIX",
          format: "plain_text" as const,
          requestingRole: "orchestrator" as const,
          deliveryMethodId: "answers",
        },
      ],
      deliveryMethods: [
        {
          id: "answers",
          label: "Answers",
          type: "answer_file" as const,
          path: "/work/queue/PACIUM-ANSWERS",
        },
      ],
      context: {
        objective: {
          format: "plain_text" as const,
          path: "/work/context/OBJECTIVE",
        },
        plan: {
          format: "plain_text" as const,
          path: "/work/context/PLAN",
        },
      },
    };
  }

  it("accepts one strict and fully referenced workspace", () => {
    expect(PaciumWorkspaceSchema.safeParse(workspace()).success).toBe(true);
  });

  it("rejects dangling repository and delivery references", () => {
    const danglingRepository = workspace();
    const orchestrator = danglingRepository.roles.orchestrator;
    if (orchestrator?.type === "launch_preset") {
      orchestrator.repositoryId = "missing";
    }
    expect(PaciumWorkspaceSchema.safeParse(danglingRepository).success).toBe(
      false,
    );

    const danglingDelivery = workspace();
    danglingDelivery.queueSources[0]!.deliveryMethodId = "missing";
    expect(PaciumWorkspaceSchema.safeParse(danglingDelivery).success).toBe(
      false,
    );
  });

  it("rejects one live session in more than one slot", () => {
    const duplicate = workspace();
    const binding = duplicate.workers[0]!.binding;
    if (binding.type === "session") {
      binding.sessionId = metaSessionId;
    }

    expect(PaciumWorkspaceSchema.safeParse(duplicate).success).toBe(false);
  });

  it("rejects duplicate identities and source-answer path aliases", () => {
    const duplicateRepository = workspace();
    duplicateRepository.repositories.push({
      ...duplicateRepository.repositories[0]!,
    });
    expect(PaciumWorkspaceSchema.safeParse(duplicateRepository).success).toBe(
      false,
    );

    const alias = workspace();
    const delivery = alias.deliveryMethods[0]!;
    if (delivery.type === "answer_file") {
      delivery.path = alias.queueSources[0]!.path;
    }
    expect(PaciumWorkspaceSchema.safeParse(alias).success).toBe(false);
  });

  it("requires configured role-prompt targets and distinct context paths", () => {
    const missingRole = workspace();
    missingRole.roles.meta = null;
    missingRole.deliveryMethods = [
      {
        id: "meta-prompt",
        label: "Meta prompt",
        type: "role_prompt",
        role: "meta",
      },
    ];
    missingRole.queueSources[0]!.deliveryMethodId = "meta-prompt";
    expect(PaciumWorkspaceSchema.safeParse(missingRole).success).toBe(false);

    const duplicateContext = workspace();
    duplicateContext.context.plan!.path =
      duplicateContext.context.objective!.path;
    expect(PaciumWorkspaceSchema.safeParse(duplicateContext).success).toBe(
      false,
    );
  });
});
