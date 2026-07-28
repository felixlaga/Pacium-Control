import type { HostSetupSnapshot } from "@pacium/contracts";
import { describe, expect, it } from "vitest";

import { preferredHostSetupTmuxSessionId } from "./host-setup-panel.js";

const snapshot: HostSetupSnapshot = {
  status: "ready",
  tmuxSessions: [
    { id: "$1", name: "torries" },
    { id: "$2", name: "meta" },
  ],
  selectedTmuxSessionId: null,
  tailscale: {
    state: "ready",
    origin: "https://host.example-tailnet.ts.net",
    login: "felix@example.com",
  },
  remoteUrl: null,
  canApply: true,
  detail: "Choose Meta.",
};

describe("host setup Meta preference", () => {
  it("prefers the configured target, then exact Meta, then the first session", () => {
    expect(preferredHostSetupTmuxSessionId(snapshot)).toBe("$2");
    expect(
      preferredHostSetupTmuxSessionId({
        ...snapshot,
        selectedTmuxSessionId: "$1",
      }),
    ).toBe("$1");
    expect(
      preferredHostSetupTmuxSessionId({
        ...snapshot,
        tmuxSessions: [{ id: "$1", name: "torries" }],
      }),
    ).toBe("$1");
  });
});
