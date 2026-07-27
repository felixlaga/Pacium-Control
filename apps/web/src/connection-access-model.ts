import type { ConnectionAccess } from "@pacium/contracts";

import type { ConnectionState } from "./transport.js";

export interface ConnectionBadgeModel {
  visiblePrefix: string | null;
  login: string | null;
  state: ConnectionState;
  accessibleLabel: string;
}

export function buildConnectionBadgeModel(
  state: ConnectionState,
  access: ConnectionAccess | null,
): ConnectionBadgeModel {
  if (state !== "connected" || access === null) {
    return {
      visiblePrefix: null,
      login: null,
      state,
      accessibleLabel: `Pacium connection: ${state}.`,
    };
  }
  if (access.kind === "local") {
    return {
      visiblePrefix: "Local",
      login: null,
      state,
      accessibleLabel: "Pacium local connection: connected.",
    };
  }
  return {
    visiblePrefix: "Tailscale",
    login: access.login,
    state,
    accessibleLabel: `Pacium Tailscale connection for ${access.login}: connected.`,
  };
}
