import type {
  RepositoryObservation,
  VerificationObservation,
  VerificationPreset,
  VerificationRun,
} from "@pacium/contracts";
import { useEffect, useState, type ReactNode } from "react";

import {
  visibleVerificationObservation,
  type RepositoryVerificationViewState,
} from "./repository-verification-model.js";

export function RepositoryVerificationPanel({
  onCancel,
  onRefresh,
  onRun,
  repository,
  state,
}: {
  onCancel: (runId: string) => void;
  onRefresh: () => void;
  onRun: (presetId: string) => void;
  repository: RepositoryObservation | null;
  state: RepositoryVerificationViewState;
}) {
  const observation = visibleVerificationObservation(state);
  const loading = state.status === "loading";
  const pendingAction = state.status === "loaded" ? state.pendingAction : null;

  return (
    <section
      aria-labelledby="inspector-checks-tab"
      className="repository-verification-panel"
      id="inspector-checks-panel"
      role="tabpanel"
      tabIndex={0}
    >
      <header className="verification-panel-header">
        <span>
          <strong>{repository?.name ?? "Verification checks"}</strong>
          <small>
            {repositoryContext(repository)} ·{" "}
            {loading
              ? "Refreshing configured checks…"
              : verificationSummary(observation)}
          </small>
        </span>
        <button disabled={loading} onClick={onRefresh} type="button">
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {observation === null ? (
        <VerificationMessage>
          {loading
            ? "Pacium is reading the server-owned verification catalog. The terminal remains available."
            : "Refresh to inspect configured checks for this session."}
        </VerificationMessage>
      ) : observation.status === "unconfigured" ? (
        <VerificationMessage>
          Verification is off. Start Pacium with an absolute{" "}
          <code>PACIUM_VERIFICATION_CONFIG</code> file outside the repository to
          add trusted checks.
        </VerificationMessage>
      ) : observation.status === "not_repository" ? (
        <VerificationMessage>
          This terminal is not associated with a Git repository.
        </VerificationMessage>
      ) : observation.status === "no_presets" ? (
        <VerificationMessage>
          The local configuration has no checks for this canonical repository.
        </VerificationMessage>
      ) : observation.status === "error" ? (
        <VerificationMessage tone="error">
          {observation.error?.message ?? "Verification is unavailable."} The
          terminal process is unaffected.
        </VerificationMessage>
      ) : (
        <>
          <p className="verification-privilege-note" role="note">
            Run starts the exact configured process below with your local user
            authority. Pacium does not add a shell or sandbox.
          </p>
          <ul className="verification-preset-list">
            {observation.presets.map((preset) => (
              <VerificationPresetRow
                activeRun={
                  observation.run?.presetId === preset.id
                    ? observation.run
                    : null
                }
                disabled={
                  pendingAction !== null ||
                  observation.run?.status === "running" ||
                  observation.run?.status === "cancelling"
                }
                key={preset.id}
                onCancel={onCancel}
                onRun={onRun}
                pendingAction={pendingAction}
                preset={preset}
              />
            ))}
          </ul>
          {observation.run !== null && (
            <VerificationRunResult run={observation.run} />
          )}
          <time dateTime={observation.observedAt}>
            Observed {new Date(observation.observedAt).toLocaleTimeString()}
          </time>
        </>
      )}
    </section>
  );
}

function VerificationPresetRow({
  activeRun,
  disabled,
  onCancel,
  onRun,
  pendingAction,
  preset,
}: {
  activeRun: VerificationRun | null;
  disabled: boolean;
  onCancel: (runId: string) => void;
  onRun: (presetId: string) => void;
  pendingAction: "run" | "cancel" | null;
  preset: VerificationPreset;
}) {
  const active =
    activeRun?.status === "running" || activeRun?.status === "cancelling";
  return (
    <li>
      <article className="verification-preset-card">
        <header>
          <span>
            <strong>{preset.label}</strong>
            <small>{preset.description}</small>
          </span>
          {active && activeRun !== null ? (
            <button
              disabled={
                activeRun.status === "cancelling" || pendingAction === "cancel"
              }
              onClick={() => onCancel(activeRun.runId)}
              type="button"
            >
              {activeRun.status === "cancelling" || pendingAction === "cancel"
                ? "Cancelling…"
                : "Cancel"}
            </button>
          ) : (
            <button
              disabled={disabled}
              onClick={() => onRun(preset.id)}
              type="button"
            >
              {pendingAction === "run" ? "Starting…" : "Run"}
            </button>
          )}
        </header>
        <dl>
          <div>
            <dt>Exact argv</dt>
            <dd>
              <code>{JSON.stringify([preset.executable, ...preset.args])}</code>
            </dd>
          </div>
          <div>
            <dt>Timeout</dt>
            <dd>{formatDuration(preset.timeoutMs)}</dd>
          </div>
        </dl>
      </article>
    </li>
  );
}

function VerificationRunResult({ run }: { run: VerificationRun }) {
  const active = run.status === "running" || run.status === "cancelling";
  const elapsedMs = useElapsedTime(run.startedAt, active);
  return (
    <article
      aria-live="polite"
      className={`verification-run-result is-${run.status}`}
    >
      <header>
        <span>
          <strong>{runStatusLabel(run.status)}</strong>
          <small>
            {active
              ? `${formatDuration(elapsedMs)} elapsed`
              : `${formatDuration(run.durationMs ?? 0)} total`}
          </small>
        </span>
        <span className="verification-status-label">{run.status}</span>
      </header>
      <dl>
        <Evidence
          label="Started HEAD"
          value={shortHead(run.headCommitAtStart)}
        />
        {!active && (
          <Evidence
            label="Completed HEAD"
            value={shortHead(run.headCommitAtEnd)}
          />
        )}
        {!active && run.exitCode !== null && (
          <Evidence label="Exit code" value={String(run.exitCode)} />
        )}
        {!active && run.signal !== null && (
          <Evidence label="Signal" value={run.signal} />
        )}
        {!active && run.terminationForced && (
          <Evidence label="Termination" value="Forced after grace period" />
        )}
      </dl>
      {!active && run.headComparison === "changed" && (
        <p className="verification-head-warning" role="note">
          HEAD changed while this check ran. The result began at{" "}
          {shortHead(run.headCommitAtStart)} and completed at{" "}
          {shortHead(run.headCommitAtEnd)}.
        </p>
      )}
      {!active && run.headComparison === "unavailable" && (
        <p className="verification-head-warning" role="note">
          Pacium could not compare both HEAD observations. This result is not
          proof of one immutable repository state.
        </p>
      )}
      {run.error !== null && (
        <p className="verification-run-error" role="alert">
          {run.error.message}
        </p>
      )}
      {!active && (
        <div className="verification-output-grid">
          <VerificationOutput
            label="stdout"
            text={run.stdout}
            truncated={run.stdoutTruncated}
          />
          <VerificationOutput
            label="stderr"
            text={run.stderr}
            truncated={run.stderrTruncated}
          />
        </div>
      )}
    </article>
  );
}

function Evidence({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function VerificationOutput({
  label,
  text,
  truncated,
}: {
  label: string;
  text: string;
  truncated: boolean;
}) {
  return (
    <section>
      <header>
        <strong>{label}</strong>
        {truncated && <span>Bounded · output omitted</span>}
      </header>
      <pre>{text.length === 0 ? "No output." : text}</pre>
    </section>
  );
}

function VerificationMessage({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "error";
}) {
  return (
    <p
      className={`repository-verification-message is-${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </p>
  );
}

function useElapsedTime(startedAt: string, active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) {
      return;
    }
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [active]);
  return Math.max(0, now - Date.parse(startedAt));
}

function repositoryContext(repository: RepositoryObservation | null): string {
  if (repository === null) {
    return "Select a terminal";
  }
  if (repository.status === "not_repository") {
    return "No repository";
  }
  if (repository.status === "error") {
    return "Repository unavailable";
  }
  return repository.branch ?? "Detached or unborn HEAD";
}

function verificationSummary(
  observation: VerificationObservation | null,
): string {
  switch (observation?.status) {
    case "ready":
      return `${observation.presets.length} configured ${
        observation.presets.length === 1 ? "check" : "checks"
      }`;
    case "unconfigured":
      return "Not configured";
    case "not_repository":
      return "No repository";
    case "no_presets":
      return "No matching checks";
    case "error":
      return "Checks unavailable";
    case undefined:
      return "Open to inspect checks";
  }
}

function runStatusLabel(status: VerificationRun["status"]): string {
  switch (status) {
    case "running":
      return "Verification running";
    case "cancelling":
      return "Cancellation requested";
    case "passed":
      return "Verification passed";
    case "failed":
      return "Verification failed";
    case "timed_out":
      return "Verification timed out";
    case "cancelled":
      return "Verification cancelled";
    case "error":
      return "Verification could not run";
  }
}

function shortHead(head: string | null): string {
  return head === null ? "Unavailable" : head.slice(0, 8);
}

function formatDuration(milliseconds: number): string {
  if (milliseconds < 1_000) {
    return `${milliseconds} ms`;
  }
  const seconds = Math.round(milliseconds / 1_000);
  if (seconds < 60) {
    return `${seconds} s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder === 0 ? `${minutes} min` : `${minutes} min ${remainder} s`;
}
