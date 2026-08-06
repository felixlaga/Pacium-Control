import { describe, expect, it } from "vitest";
import type { SessionSummary } from "@pacium/contracts";

import { assignRepoRoles, isPaciumOrgRepository } from "./repo-role-model.js";

const baseSession: SessionSummary = {
  id: "53cfec56-181c-4e9c-b187-8f323780c175",
  epoch: 1,
  displayName: "Shell",
  cwd: "/work/alpha",
  shell: "/bin/zsh",
  launchPreset: "shell",
  commandLabel: "Shell",
  agentClassification: {
    type: "shell",
    label: "Shell",
    source: "launch_preset",
    confidence: "confirmed",
    observedAt: "2026-08-05T10:00:00.000Z",
  },
  providerObservation: null,
  repository: {
    status: "ready",
    root: "/work/alpha",
    name: "alpha",
    branch: "dev",
    headCommit: "a".repeat(40),
    headState: "branch",
    worktreeKind: "main",
    observedAt: "2026-08-05T10:00:00.000Z",
    error: null,
  },
  runtime: "pty",
  processState: "live",
  pid: 42,
  cols: 80,
  rows: 24,
  createdAt: "2026-08-05T10:00:00.000Z",
  exitedAt: null,
  exitCode: null,
  exitSignal: null,
};

let sequence = 0;

function session(overrides: Partial<SessionSummary>): SessionSummary {
  sequence += 1;
  return {
    ...baseSession,
    id: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    ...overrides,
  };
}

const noBindings = { meta: null, orchestrator: null };

describe("assignRepoRoles name matching", () => {
  it.each(["meta-0", "pacium meta", "Meta", "[meta]"])(
    "recognizes %s as the Meta session",
    (displayName) => {
      const candidate = session({ displayName });
      const assignment = assignRepoRoles([candidate], noBindings);

      expect(assignment.meta?.id).toBe(candidate.id);
      expect(assignment.metaSource).toBe("name");
      expect(assignment.others).toHaveLength(0);
    },
  );

  it.each(["orchestrator", "orch-1", "Pacium Orchestrator", "ORCH"])(
    "recognizes %s as the Orchestrator session",
    (displayName) => {
      const candidate = session({ displayName });
      const assignment = assignRepoRoles([candidate], noBindings);

      expect(assignment.orchestrator?.id).toBe(candidate.id);
      expect(assignment.orchestratorSource).toBe("name");
    },
  );

  it.each(["metadata", "metadata-sync", "Metabase"])(
    "does not treat %s as Meta",
    (displayName) => {
      const assignment = assignRepoRoles(
        [session({ displayName })],
        noBindings,
      );

      expect(assignment.meta).toBeNull();
      expect(assignment.metaSource).toBeNull();
      expect(assignment.others).toHaveLength(1);
    },
  );

  it.each(["orchid", "torch runner"])(
    "does not treat %s as Orchestrator",
    (displayName) => {
      const assignment = assignRepoRoles(
        [session({ displayName })],
        noBindings,
      );

      expect(assignment.orchestrator).toBeNull();
    },
  );

  it("matches the tmux session name when the display name is generic", () => {
    const candidate = session({
      displayName: "Terminal 4",
      tmuxTarget: {
        serverId: "configured",
        sessionId: "$7",
        sessionName: "pacium-meta",
        observedAt: "2026-08-05T10:00:00.000Z",
      },
    });
    const assignment = assignRepoRoles([candidate], noBindings);

    expect(assignment.meta?.id).toBe(candidate.id);
    expect(assignment.metaSource).toBe("name");
  });
});

describe("assignRepoRoles priorities", () => {
  it("prefers the config binding over a name match", () => {
    const bound = session({ displayName: "worker-3" });
    const named = session({ displayName: "meta" });
    const assignment = assignRepoRoles([named, bound], {
      meta: bound.id,
      orchestrator: null,
    });

    expect(assignment.meta?.id).toBe(bound.id);
    expect(assignment.metaSource).toBe("config");
    expect(assignment.others.map(({ id }) => id)).toEqual([named.id]);
  });

  it("falls back to name matching when the config binding is absent", () => {
    const named = session({ displayName: "orchestrator" });
    const assignment = assignRepoRoles([named], {
      meta: null,
      orchestrator: "not-present",
    });

    expect(assignment.orchestrator?.id).toBe(named.id);
    expect(assignment.orchestratorSource).toBe("name");
  });

  it("prefers a live session over an exited one", () => {
    const exited = session({ displayName: "meta-0", processState: "exited" });
    const live = session({ displayName: "meta-1" });
    const assignment = assignRepoRoles([exited, live], noBindings);

    expect(assignment.meta?.id).toBe(live.id);
    expect(assignment.others.map(({ id }) => id)).toEqual([exited.id]);
  });

  it("keeps the first match among equally live candidates", () => {
    const first = session({ displayName: "meta-0" });
    const second = session({ displayName: "meta-1" });
    const assignment = assignRepoRoles([first, second], noBindings);

    expect(assignment.meta?.id).toBe(first.id);
    expect(assignment.others.map(({ id }) => id)).toEqual([second.id]);
  });

  it("uses an exited config-bound session over a live name match", () => {
    const bound = session({ displayName: "old meta", processState: "exited" });
    const live = session({ displayName: "meta" });
    const assignment = assignRepoRoles([live, bound], {
      meta: bound.id,
      orchestrator: null,
    });

    expect(assignment.meta?.id).toBe(bound.id);
    expect(assignment.metaSource).toBe("config");
  });
});

describe("assignRepoRoles exclusivity", () => {
  it("lets Meta claim first when one name matches both roles", () => {
    const both = session({ displayName: "meta orchestrator" });
    const assignment = assignRepoRoles([both], noBindings);

    expect(assignment.meta?.id).toBe(both.id);
    expect(assignment.orchestrator).toBeNull();
    expect(assignment.others).toHaveLength(0);
  });

  it("assigns both roles and preserves input order for the rest", () => {
    const worker = session({ displayName: "worker-1" });
    const orchestrator = session({ displayName: "orch-0" });
    const meta = session({ displayName: "meta-0" });
    const scratch = session({ displayName: "scratch" });
    const assignment = assignRepoRoles(
      [worker, orchestrator, meta, scratch],
      noBindings,
    );

    expect(assignment.meta?.id).toBe(meta.id);
    expect(assignment.orchestrator?.id).toBe(orchestrator.id);
    expect(assignment.others.map(({ id }) => id)).toEqual([
      worker.id,
      scratch.id,
    ]);
  });

  it("returns an empty assignment for no sessions", () => {
    expect(assignRepoRoles([], noBindings)).toEqual({
      meta: null,
      metaSource: null,
      orchestrator: null,
      orchestratorSource: null,
      others: [],
    });
  });
});

describe("isPaciumOrgRepository", () => {
  it("matches only roots with an exact pacium path segment", () => {
    expect(isPaciumOrgRepository("/root/github/pacium/autibench")).toBe(true);
    expect(isPaciumOrgRepository("/Users/felix/GitHub/Pacium/gweb")).toBe(true);
    expect(
      isPaciumOrgRepository("/Users/felix/Documents/GitHub/Pacium Control"),
    ).toBe(false);
    expect(isPaciumOrgRepository("/srv/paciumish/repo")).toBe(false);
    expect(isPaciumOrgRepository("/srv/repo")).toBe(false);
  });
});
