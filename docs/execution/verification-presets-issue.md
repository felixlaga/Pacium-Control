# PC-037: Explicit verification presets

## Problem

Pacium shows fresh repository, changed-file, diff, and commit evidence beside a
terminal, but the operator still has to leave the workspace to run the
repository checks that establish whether the observed work passes. A generic
browser-to-shell command field would be an unacceptable expansion of the local
shell boundary, while commands inferred from repository or queue text would let
untrusted content choose host processes.

## Outcome

The operator can inspect and run explicitly configured verification presets for
the selected terminal's canonical repository, watch an honest running state,
cancel a run, and inspect a bounded result associated with freshly observed
start and completion HEAD commits. The browser chooses only a server-owned
preset ID; Pacium never parses a command from browser, repository, terminal, or
queue text.

## Scope

- A versioned, bounded, operator-selected local JSON configuration file for
  repository-specific verification presets.
- Canonical repository-root matching and typed executable/argument definitions.
- Protocol-9 inspect, run, cancel, response, and update contracts.
- At most one active verification run per selected session and two across the
  local server.
- Shell-free process-group execution with a configured bounded timeout,
  graceful cancellation, forced termination fallback, and bounded output.
- Fresh start/completion HEAD observations and explicit changed-HEAD evidence.
- Disposable server-memory latest results and reconnect inspection.
- A lazy Checks inspector with unavailable, idle, running, cancelling,
  passed, failed, timed-out, cancelled, and execution-error states.

## Non-scope

- Arbitrary browser-supplied commands, executables, arguments, environment,
  working directories, shell fragments, timeouts, or signals.
- Discovering or executing `package.json` scripts, Make targets, repository
  instructions, terminal output, provider suggestions, or queue content.
- Editing configuration in the browser or storing it inside a configured
  repository.
- Automatic verification, filesystem-triggered runs, schedules, retries,
  pipelines, dependencies between presets, or approval policies.
- Claiming configured commands are read-only or sandboxed; they run with the
  invoking operating-system user's authority.
- Durable run history, complete transcripts, artifacts, annotations, test-case
  parsing, CI/provider integration, or multi-host execution.
- Pacium-mode-specific verification grouping; PC-040 owns that configuration.

## Acceptance criteria

- [x] Verification is unavailable unless the operator explicitly supplies an
      absolute `PACIUM_VERIFICATION_CONFIG` path to a valid version-1 JSON
      configuration outside every configured repository root.
- [x] Configuration is strict and bounded; repository roots are canonical,
      executables are absolute existing files, IDs are unique per repository,
      and invalid configuration fails startup without partial acceptance.
- [x] The browser can send only request, session, preset, and run identities;
      it cannot supply process, path, environment, timeout, or signal data.
- [x] A run resolves the selected live session's canonical repository and
      matching preset again immediately before execution.
- [x] The server starts the configured executable and typed arguments without a
      shell, with a bounded allowlisted environment and repository root as cwd.
- [x] Active concurrency, output bytes, field sizes, runtime, cancellation
      grace, retained result count, and every WebSocket message are bounded.
- [x] Cancel targets only the matching server-owned run process group, first
      requests graceful termination, and visibly records forced termination if
      the grace period expires.
- [x] Passed, failed, timed-out, cancelled, and spawn/error outcomes are
      distinct; restart loss is documented and no outcome is inferred from
      terminal narration or missing memory.
- [x] Results show the exact configured executable/arguments, exit/signal
      evidence, truncation, duration, and fresh start/completion HEAD commits;
      concurrent HEAD change is labelled rather than hidden.
- [x] Refresh/reconnect can recover a still-running server-owned run and the
      latest bounded result without replaying or restarting the command.
- [x] Opening, running, cancelling, refreshing, or failing Checks does not send
      terminal input or change PTY selection/lifecycle.
- [x] Configuration, contracts, process lifecycle, cancellation, bounds,
      session/WebSocket ownership, UI states, browser workflow, and complete
      verification gates pass.

## User experience

Checks is a fourth compact inspector tab. It loads lazily and explains how to
configure presets when none match the selected repository. Each configured
preset shows its label, description, exact executable and arguments, timeout,
and a Run button. Copy states clearly that this starts a local process with the
operator's authority.

Running replaces Run with Cancel, shows elapsed time and the HEAD observed at
start, and survives browser refresh while the local server remains alive.
Completion shows a textual status, duration, exit or signal evidence, start and
completion HEADs, a warning if HEAD changed, and separately labelled stdout and
stderr rendered as untrusted plain text. Truncation is explicit. Errors say
which PTYs survived and the next useful action.

Keyboard tab navigation extends to Checks. Controls remain reachable without
stealing keystrokes while the terminal owns focus, and the narrow inspector
wraps command/result metadata without horizontal page overflow.

## Architecture

- Systems and modules touched: local configuration, shared contracts,
  verification catalog/runner, session manager, WebSocket hub, browser
  transport/state, inspector UI.
- Systems of record: the explicit operator configuration owns allowed commands;
  the OS process owns live execution; Git owns HEAD truth; Pacium retains only
  the active run and latest bounded result in server memory.
- State transitions: unavailable/idle -> running -> cancelling -> completed;
  timeout and cancellation share process termination machinery but preserve
  distinct outcomes.
- Protocol/schema impact: protocol 9 adds strict verification inspect, run,
  cancel, response, and server update messages.
- Relevant ADRs: ADR-0001, ADR-0005, ADR-0013, ADR-0014, ADR-0015.

## Security and privacy

- Authorization: existing exact Origin, ephemeral token, strict schema, and
  final-message bounds apply.
- Privilege: configured commands run as the Pacium host user with no elevation
  or sandbox claim.
- Secrets/logging: only the existing bounded environment allowlist crosses;
  commands, output, environment, and results are not logged or persisted.
- Abuse/failure scenario: hostile browser or repository content cannot select a
  process. Hostile command output is byte-bounded, control-normalized, treated
  only as text, and never sent to a terminal or interpreted as markup.

## Reliability

- Idempotency: run requests use unique request identities but intentionally
  start a new process only after the server accepts the preset; duplicate
  active runs for one session are rejected.
- Timeouts/retries: every preset timeout is required and capped; there are no
  automatic retries.
- Restart behavior: browser refresh is recoverable; server restart loses
  in-memory results and may leave an unexpectedly orphaned process after a hard
  crash, which is reported as unknown rather than reconstructed.
- Unknown outcome: disconnect never implies cancellation; a hard server crash
  cannot prove the prior process outcome.
- Migration/rollback: protocol 9 is atomic and adds no durable application
  state; removing the optional config disables Checks execution.

## Test plan

- Unit: configuration schema/path/executable validation, catalog matching,
  bounds, output normalization, result classification, HEAD comparison, and
  process state reducer.
- Contract: every request/result state, cross-field invariants, identities,
  output/command bounds, extra keys, and absence of browser command fields.
- Integration: pass/fail/stdout/stderr, timeout, cancellation, forced kill,
  spawn failure, concurrency, fresh HEAD association, changed HEAD, session
  ownership, reconnect inspection, and unchanged PTY.
- Browser: lazy Checks load, empty/configured states, run, cancel, completion,
  truncation, HEAD warning, keyboard navigation, refresh, and narrow layout.
- Failure/recovery: stale messages, disconnect during run, repository removal,
  config mismatch, process already exited, and server restart limitation.
- Security: config outside repository, no shell, absolute executable, bounded
  allowlisted environment/output/messages, hostile ANSI/OSC/control output,
  and no terminal-input path.

## Dependencies

- Blocked by: PC-033 canonical repository context and the authenticated
  selected-session WebSocket boundary.
- Blocks: PC-038 recent activity and PC-040 Pacium workspace configuration.

## Evidence required

- Configuration fixtures proving fail-closed bounds and repository separation.
- Real child-process fixtures for every terminal result and cancellation state.
- Session/WebSocket tests proving exact ownership and PTY survival.
- Semantic UI and browser workflows for run, cancel, reconnect, and narrow
  layouts.
- `pnpm verify` and `pnpm test:e2e`.
- Synchronized protocol, status, backlog, issue, plan, README, and changelog.

## Open questions

- Hard server crashes cannot reliably identify or recover an untracked detached
  verification process without durable process identity or a supervisor. This
  slice handles graceful shutdown and reports the hard-crash boundary honestly;
  a stronger recovery contract requires a dedicated follow-up design.

## Completion evidence

Completed on 2026-07-27.

- `pnpm verify` passed formatting, lint, strict typing, 58 test files and 278
  tests, and both production builds.
- `pnpm test:e2e` passed seven Chromium workflows. The PC-037 workflow proved
  exact configured argv presentation, pass evidence, browser reload during a
  live run, recovered cancellation, final signal evidence, four-tab keyboard
  movement, unchanged terminal selection, and the 320 CSS px inspector.
- Real child-process tests passed for exact argv/cwd, allowlisted environment,
  pass/fail/stdout/stderr, timeout, graceful/forced process-group cancellation,
  two-run concurrency, output truncation, spawn error, and changed HEAD.
- Configuration, protocol, session, WebSocket, response-bound, reducer,
  hostile-text semantic, and PTY-survival tests passed.
- The connected in-app browser backend remained unavailable, so independent
  manual visual and screen-reader review remains a release-level evidence gap.
