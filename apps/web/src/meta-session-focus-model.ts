import type { MetaSessionCapability, SessionSummary } from "@pacium/contracts";

export function initialMetaSessionId(input: {
  applied: boolean;
  capability: MetaSessionCapability;
  sessions: readonly SessionSummary[];
}): string | null {
  if (
    input.applied ||
    input.capability.state !== "ready" ||
    input.capability.sessionId === null
  ) {
    return null;
  }
  const session = input.sessions.find(
    ({ id }) => id === input.capability.sessionId,
  );
  if (
    session === undefined ||
    (session.processState !== "creating" && session.processState !== "live")
  ) {
    return null;
  }
  return session.id;
}
