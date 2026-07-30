import type {
  HostSetupApplyResult,
  HostSetupSnapshot,
} from "@pacium/contracts";
import { useEffect, useState } from "react";

interface HostSetupPanelProps {
  local: boolean;
  load: () => Promise<HostSetupSnapshot>;
  apply: (tmuxSessionId: string) => Promise<HostSetupApplyResult>;
}

export function HostSetupPanel({ local, load, apply }: HostSetupPanelProps) {
  const [snapshot, setSnapshot] = useState<HostSetupSnapshot | null>(null);
  const [selected, setSelected] = useState("");
  const [approvalUrl, setApprovalUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "loading" | "applying" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setPhase("loading");
    setError(null);
    try {
      const next = await load();
      setSnapshot(next);
      setSelected(preferredHostSetupTmuxSessionId(next));
      setApprovalUrl(null);
      setPhase("idle");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Host setup could not be loaded.",
      );
      setPhase("error");
    }
  };

  useEffect(() => {
    if (local) {
      void refresh();
    }
  }, [local]);

  const enable = async () => {
    if (selected.length === 0) {
      return;
    }
    setPhase("applying");
    setError(null);
    try {
      const result = await apply(selected);
      setSnapshot(result.snapshot);
      setApprovalUrl(result.approvalUrl);
      setPhase(result.outcome === "configured" ? "idle" : "error");
      if (
        result.outcome !== "configured" &&
        result.outcome !== "approval_required"
      ) {
        setError(result.snapshot.detail);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Host setup could not be applied.",
      );
      setPhase("error");
    }
  };

  if (!local) {
    return (
      <div className="host-setup-panel status-unavailable">
        <strong>Host setup</strong>
        <span>
          Open Pacium on localhost to change host access. To reach tmux sessions
          on another machine, run Pacium on that machine and enable remote
          access there.
        </span>
      </div>
    );
  }

  return (
    <div
      aria-busy={phase === "loading" || phase === "applying"}
      className={`host-setup-panel status-${snapshot?.status ?? "loading"}`}
    >
      <div className="host-setup-title">
        <div>
          <strong>Remote Meta</strong>
          <span>{snapshot?.detail ?? "Checking this host…"}</span>
        </div>
        <button
          disabled={phase === "loading" || phase === "applying"}
          onClick={() => void refresh()}
          type="button"
        >
          Refresh
        </button>
      </div>

      {snapshot !== null && snapshot.status !== "configured" && (
        <label className="host-setup-choice">
          <span>Meta session</span>
          <select
            disabled={
              phase === "applying" || snapshot.tmuxSessions.length === 0
            }
            onChange={(event) => setSelected(event.target.value)}
            value={selected}
          >
            {snapshot.tmuxSessions.length === 0 ? (
              <option value="">No existing tmux session found</option>
            ) : (
              snapshot.tmuxSessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name}
                </option>
              ))
            )}
          </select>
        </label>
      )}

      {snapshot?.tailscale.state === "ready" &&
        snapshot.status !== "configured" && (
          <span className="host-setup-identity">
            Tailscale · {snapshot.tailscale.login}
          </span>
        )}

      {snapshot?.tailscale.state === "signed_out" && (
        <div className="host-setup-help">
          <span>
            This host is not signed in to Tailscale. Run the command below in a
            terminal on this machine, follow the sign-in link it prints, then
            refresh.
          </span>
          <code>tailscale login</code>
        </div>
      )}

      {snapshot?.tailscale.state === "not_installed" && (
        <div className="host-setup-help">
          <span>
            Tailscale is not installed on this host. Install it from{" "}
            <a
              href="https://tailscale.com/download"
              rel="noreferrer"
              target="_blank"
            >
              tailscale.com/download
            </a>
            , sign in, then refresh.
          </span>
        </div>
      )}

      {approvalUrl !== null && (
        <div className="host-setup-consent" role="status">
          <span>Approve private Serve access in Tailscale, then retry.</span>
          <a href={approvalUrl} rel="noreferrer" target="_blank">
            Open Tailscale approval
          </a>
        </div>
      )}

      {error !== null && <span className="host-setup-error">{error}</span>}

      <div className="host-setup-actions">
        {snapshot?.status === "configured" && snapshot.remoteUrl !== null && (
          <a href={snapshot.remoteUrl} rel="noreferrer" target="_blank">
            Open Pacium
          </a>
        )}
        {snapshot !== null && snapshot.status !== "configured" && (
          <button
            className="primary-button"
            disabled={
              !snapshot.canApply ||
              selected.length === 0 ||
              phase === "applying"
            }
            onClick={() => void enable()}
            type="button"
          >
            {phase === "applying"
              ? "Enabling…"
              : approvalUrl === null
                ? "Enable remote Meta"
                : "Approval finished — retry"}
          </button>
        )}
      </div>
    </div>
  );
}

export function preferredHostSetupTmuxSessionId(
  snapshot: HostSetupSnapshot,
): string {
  return (
    snapshot.selectedTmuxSessionId ??
    snapshot.tmuxSessions.find(({ name }) => name === "meta")?.id ??
    snapshot.tmuxSessions[0]?.id ??
    ""
  );
}
