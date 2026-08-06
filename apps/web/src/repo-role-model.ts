import type { SessionSummary } from "@pacium/contracts";

/**
 * Identifies the per-repository Meta and Orchestrator sessions. Config
 * bindings are session ids and win outright; otherwise the session NAME
 * (display name, then tmux session name) is matched with word boundaries so
 * "metadata" never counts as Meta. Live sessions beat exited ones, the first
 * match wins among equals, and a session holds at most one role — Meta claims
 * first.
 */

export type RepoRole = "meta" | "orchestrator";

export type RepoRoleSource = "config" | "name";

export interface RepoRoleAssignment {
  meta: SessionSummary | null;
  orchestrator: SessionSummary | null;
  others: SessionSummary[];
  metaSource: RepoRoleSource | null;
  orchestratorSource: RepoRoleSource | null;
}

const META_NAME = /(^|[^a-z])meta([^a-z]|$)/i;
const ORCHESTRATOR_NAME = /(^|[^a-z])orch(estrator)?([^a-z]|$)/i;

/**
 * Only repositories of the Pacium org run the Meta/Orchestrator pair. The
 * operator keeps those checkouts inside a directory named "pacium" (e.g.
 * ~/github/pacium/<repo>), so a repo qualifies when any path segment of its
 * root equals "pacium" — "Pacium Control" and other neighbours do not.
 */
export function isPaciumOrgRepository(root: string): boolean {
  return root.split("/").some((segment) => segment.toLowerCase() === "pacium");
}

export function assignRepoRoles(
  sessions: SessionSummary[],
  configBindings: { meta: string | null; orchestrator: string | null },
): RepoRoleAssignment {
  const claimed = new Set<string>();
  const meta = claimRole(sessions, claimed, configBindings.meta, META_NAME);
  const orchestrator = claimRole(
    sessions,
    claimed,
    configBindings.orchestrator,
    ORCHESTRATOR_NAME,
  );
  return {
    meta: meta?.session ?? null,
    metaSource: meta?.source ?? null,
    orchestrator: orchestrator?.session ?? null,
    orchestratorSource: orchestrator?.source ?? null,
    others: sessions.filter((session) => !claimed.has(session.id)),
  };
}

function claimRole(
  sessions: SessionSummary[],
  claimed: Set<string>,
  configId: string | null,
  pattern: RegExp,
): { session: SessionSummary; source: RepoRoleSource } | null {
  const available = sessions.filter((session) => !claimed.has(session.id));
  if (configId !== null) {
    const configured = available.find((session) => session.id === configId);
    if (configured !== undefined) {
      claimed.add(configured.id);
      return { session: configured, source: "config" };
    }
  }
  const named = available.filter((session) =>
    matchesRoleName(session, pattern),
  );
  const chosen =
    named.find((session) => session.processState === "live") ?? named[0];
  if (chosen === undefined) {
    return null;
  }
  claimed.add(chosen.id);
  return { session: chosen, source: "name" };
}

function matchesRoleName(session: SessionSummary, pattern: RegExp): boolean {
  if (pattern.test(session.displayName)) {
    return true;
  }
  const tmuxName = session.tmuxTarget?.sessionName;
  return tmuxName !== undefined && pattern.test(tmuxName);
}
