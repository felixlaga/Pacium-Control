import { describe, expect, it } from "vitest";
import type { SessionSummary } from "@pacium/contracts";

import { initialMetaSessionId } from "./meta-session-focus-model.js";

const session = {
  id: "5fe26a52-3f3c-41ef-8dba-6f93062eeec5",
  displayName: "Not inferred as Meta",
  processState: "live",
} as SessionSummary;

describe("Meta startup focus", () => {
  it("uses only the exact ready capability session ID", () => {
    expect(
      initialMetaSessionId({
        applied: false,
        capability: {
          state: "ready",
          sessionId: session.id,
          detail: "Meta attached.",
        },
        sessions: [session],
      }),
    ).toBe(session.id);
    expect(
      initialMetaSessionId({
        applied: false,
        capability: {
          state: "ready",
          sessionId: "10000000-0000-4000-8000-000000000001",
          detail: "Stale Meta capability.",
        },
        sessions: [session],
      }),
    ).toBeNull();
  });

  it("does not override an applied focus or select ended evidence", () => {
    expect(
      initialMetaSessionId({
        applied: true,
        capability: {
          state: "ready",
          sessionId: session.id,
          detail: "Meta attached.",
        },
        sessions: [session],
      }),
    ).toBeNull();
    expect(
      initialMetaSessionId({
        applied: false,
        capability: {
          state: "ready",
          sessionId: session.id,
          detail: "Meta attached.",
        },
        sessions: [{ ...session, processState: "exited" }],
      }),
    ).toBeNull();
  });
});
