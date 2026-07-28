import { describe, expect, it } from "vitest";

import {
  HostSetupApplyRequestSchema,
  HostSetupApplyResultSchema,
  HostSetupSnapshotSchema,
} from "./host-setup.js";

const snapshot = {
  status: "ready",
  tmuxSessions: [{ id: "$7", name: "meta" }],
  selectedTmuxSessionId: null,
  tailscale: {
    state: "ready",
    origin: "https://host.example-tailnet.ts.net",
    login: "owner@example.com",
  },
  remoteUrl: null,
  canApply: true,
  detail: "Choose Meta.",
} as const;

describe("host setup contracts", () => {
  it("accepts identity-only setup and rejects command authority", () => {
    expect(HostSetupApplyRequestSchema.parse({ tmuxSessionId: "$7" })).toEqual({
      tmuxSessionId: "$7",
    });
    expect(
      HostSetupApplyRequestSchema.safeParse({
        tmuxSessionId: "$7",
        command: "ssh root@host",
      }).success,
    ).toBe(false);
  });

  it("keeps ready, configured, and approval evidence relational", () => {
    expect(HostSetupSnapshotSchema.parse(snapshot)).toEqual(snapshot);
    expect(
      HostSetupSnapshotSchema.safeParse({
        ...snapshot,
        tailscale: { state: "ready", origin: null, login: null },
      }).success,
    ).toBe(false);
    expect(
      HostSetupApplyResultSchema.safeParse({
        outcome: "approval_required",
        snapshot,
        approvalUrl: "https://evil.example/approve",
      }).success,
    ).toBe(false);
    expect(
      HostSetupApplyResultSchema.safeParse({
        outcome: "approval_required",
        snapshot,
        approvalUrl: "https://login.tailscale.com/admin/serve?node=abc",
      }).success,
    ).toBe(true);
  });
});
