import type { ConnectionAccess } from "@pacium/contracts";

import { buildConnectionBadgeModel } from "./connection-access-model.js";
import type { ConnectionState } from "./transport.js";

export function ConnectionBadge({
  access,
  state,
}: {
  access: ConnectionAccess | null;
  state: ConnectionState;
}) {
  const model = buildConnectionBadgeModel(state, access);
  return (
    <span
      aria-label={model.accessibleLabel}
      className={`connection-badge connection-${state}`}
    >
      <span
        aria-hidden="true"
        className={`status-dot state-${
          state === "connected" ? "live" : "waiting"
        }`}
      />
      {model.visiblePrefix !== null && (
        <>
          <span className="connection-kind">{model.visiblePrefix}</span>
          <span aria-hidden="true">·</span>
        </>
      )}
      {model.login !== null && (
        <>
          <span className="connection-login" title={model.login}>
            {model.login}
          </span>
          <span aria-hidden="true">·</span>
        </>
      )}
      <span className="connection-state">{model.state}</span>
    </span>
  );
}
