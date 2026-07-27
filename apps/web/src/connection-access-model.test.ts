import { describe, expect, it } from "vitest";

import { buildConnectionBadgeModel } from "./connection-access-model.js";

describe("connection badge model", () => {
  it("labels current local and Tailscale authority without inventing identity", () => {
    expect(buildConnectionBadgeModel("connected", { kind: "local" })).toEqual({
      visiblePrefix: "Local",
      login: null,
      state: "connected",
      accessibleLabel: "Pacium local connection: connected.",
    });
    expect(
      buildConnectionBadgeModel("connected", {
        kind: "tailscale",
        login: "owner@example.com",
      }),
    ).toEqual({
      visiblePrefix: "Tailscale",
      login: "owner@example.com",
      state: "connected",
      accessibleLabel:
        "Pacium Tailscale connection for owner@example.com: connected.",
    });
  });

  it("does not present stale identity outside the connected state", () => {
    for (const state of [
      "connecting",
      "reconnecting",
      "disconnected",
    ] as const) {
      expect(
        buildConnectionBadgeModel(state, {
          kind: "tailscale",
          login: "former@example.com",
        }),
      ).toEqual({
        visiblePrefix: null,
        login: null,
        state,
        accessibleLabel: `Pacium connection: ${state}.`,
      });
    }
  });
});
