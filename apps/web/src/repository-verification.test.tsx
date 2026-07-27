import type {
  VerificationObservation,
  VerificationRun,
} from "@pacium/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RepositoryVerificationPanel } from "./repository-verification.js";

const repository = {
  status: "ready" as const,
  root: "/work/pacium",
  name: "pacium",
  branch: "dev",
  headCommit: "a".repeat(40),
  headState: "branch" as const,
  worktreeKind: "main" as const,
  observedAt: "2026-07-27T10:00:00.000Z",
  error: null,
};
const activeRun: VerificationRun = {
  runId: "03c2723f-e87a-4707-86af-d6fdb1e60f47",
  presetId: "verify",
  status: "running",
  startedAt: new Date().toISOString(),
  completedAt: null,
  durationMs: null,
  headCommitAtStart: "a".repeat(40),
  headCommitAtEnd: null,
  headComparison: null,
  exitCode: null,
  signal: null,
  terminationForced: false,
  stdout: "",
  stderr: "",
  stdoutTruncated: false,
  stderrTruncated: false,
  error: null,
};
const observation: VerificationObservation = {
  status: "ready",
  configured: true,
  root: "/work/pacium",
  observedAt: "2026-07-27T10:00:00.000Z",
  presets: [
    {
      id: "verify",
      label: "Project verification",
      description: "Run the bounded local gate",
      executable: "/opt/bin/pnpm",
      args: ["verify", "<script>alert('argv')</script>"],
      timeoutMs: 600_000,
    },
  ],
  run: null,
  error: null,
};

describe("repository verification presentation", () => {
  it("shows exact configured argv and explicit local authority", () => {
    const markup = renderState(observation);

    expect(markup).toContain("Project verification");
    expect(markup).toContain("Exact argv");
    expect(markup).toContain("[&quot;/opt/bin/pnpm&quot;,&quot;verify&quot;");
    expect(markup).toContain("&lt;script&gt;");
    expect(markup).not.toContain("<script>");
    expect(markup).toContain("does not add a shell or sandbox");
    expect(markup).toContain(">Run</button>");
    expect(markup).toContain("10 min");
  });

  it("renders running and cancelling controls without result claims", () => {
    const running = renderState({ ...observation, run: activeRun });
    expect(running).toContain("Verification running");
    expect(running).toContain("elapsed");
    expect(running).toContain(">Cancel</button>");
    expect(running).not.toContain("Exit code");

    const cancelling = renderState({
      ...observation,
      run: { ...activeRun, status: "cancelling" },
    });
    expect(cancelling).toContain("Cancellation requested");
    expect(cancelling).toContain("Cancelling…");
    expect(cancelling).toContain("disabled");
  });

  it("labels changed HEAD, forced termination, truncation, and hostile output", () => {
    const completed: VerificationRun = {
      ...activeRun,
      status: "cancelled",
      completedAt: "2026-07-27T10:00:02.000Z",
      durationMs: 2_000,
      headCommitAtEnd: "b".repeat(40),
      headComparison: "changed",
      exitCode: null,
      signal: "SIGKILL",
      terminationForced: true,
      stdout: "<img src=x onerror=alert('output')>\n",
      stderr: "cancelled\n",
      stdoutTruncated: true,
    };
    const markup = renderState({ ...observation, run: completed });

    expect(markup).toContain("Verification cancelled");
    expect(markup).toContain("HEAD changed while this check ran");
    expect(markup).toContain("aaaaaaaa");
    expect(markup).toContain("bbbbbbbb");
    expect(markup).toContain("SIGKILL");
    expect(markup).toContain("Forced after grace period");
    expect(markup).toContain("Bounded · output omitted");
    expect(markup).toContain("&lt;img");
    expect(markup).not.toContain("<img");
  });

  it("explains unconfigured, unmatched, loading, and degraded states", () => {
    const loading = renderToStaticMarkup(
      <RepositoryVerificationPanel
        onCancel={() => {}}
        onRefresh={() => {}}
        onRun={() => {}}
        repository={repository}
        state={{
          status: "loading",
          requestId: "request",
          sessionId: "session",
          previous: null,
        }}
      />,
    );
    expect(loading).toContain("server-owned verification catalog");
    expect(loading).toContain("terminal remains available");

    const unconfigured = renderState({
      ...observation,
      status: "unconfigured",
      configured: false,
      root: null,
      presets: [],
    });
    expect(unconfigured).toContain("PACIUM_VERIFICATION_CONFIG");
    expect(unconfigured).toContain("outside the repository");

    const noPresets = renderState({
      ...observation,
      status: "no_presets",
      presets: [],
    });
    expect(noPresets).toContain("no checks for this canonical repository");

    const error = renderState({
      ...observation,
      status: "error",
      presets: [],
      error: {
        code: "repository_unavailable",
        message: "Repository evidence is unavailable.",
      },
    });
    expect(error).toContain("Repository evidence is unavailable");
    expect(error).toContain("terminal process is unaffected");
    expect(error).toContain('role="alert"');
  });
});

function renderState(observation: VerificationObservation): string {
  return renderToStaticMarkup(
    <RepositoryVerificationPanel
      onCancel={() => {}}
      onRefresh={() => {}}
      onRun={() => {}}
      repository={repository}
      state={{
        status: "loaded",
        sessionId: "session",
        observation,
        pendingRequestId: null,
        pendingAction: null,
      }}
    />,
  );
}
