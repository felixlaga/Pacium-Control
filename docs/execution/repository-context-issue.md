# PC-033: Evidence-backed repository context

## Problem

Pacium groups sessions using a filesystem `.git` marker found at launch, but it
does not show the authoritative Git branch, HEAD commit, linked-worktree state,
inspection time, or bounded Git failure. An operator therefore cannot confirm
which checkout an agent owns without leaving Pacium.

## Outcome

Every session in a Git working tree exposes a read-only, refreshable repository
context derived from fixed Git commands: canonical root, display name, branch
or detached/unborn state, HEAD commit when present, main or linked worktree,
observation time, and a bounded degraded state. Git failure never blocks or
terminates the PTY.

## Scope

- Replace marker-only repository discovery with bounded Git inspection.
- Add strict provider-neutral repository context contracts.
- Distinguish branch, detached HEAD, unborn branch, non-repository, and
  inspection-error states.
- Distinguish a main checkout from a linked Git worktree.
- Add an explicit selected-session refresh action.
- Show repository, branch/HEAD, worktree, freshness, and degraded copy in the
  inspector.
- Add Git fixtures, contract tests, session integration tests, and rendered
  semantic tests.

## Non-scope

- Changed files, dirty/clean status, additions/deletions, or conflicts.
- Diff rendering, commit history, verification commands, or Git mutations.
- Automatic worktree creation, cleanup, ownership enforcement, or branch
  switching.
- Repository registration or persistent Git caches.

## Acceptance criteria

- [x] Canonical repository root is obtained from Git for a session cwd.
- [x] Branch and full HEAD commit match direct Git inspection.
- [x] Detached HEAD and unborn branch are explicit states.
- [x] Main and linked worktrees are distinguished.
- [x] Non-repository folders remain valid terminal working directories.
- [x] Inspection commands use fixed arguments, bounded output, and a timeout.
- [x] Repository strings are schema-bounded and rendered as text.
- [x] Explicit refresh updates context without changing the PTY.
- [x] Git absence, timeout, malformed output, or command failure produces a
      bounded degraded state or no-repository state without breaking terminal
      creation and use.
- [x] Full verification and browser regressions pass.

## User experience

The selected-session inspector shows a compact Repository section. A repository
displays its name, branch or detached/unborn label, abbreviated commit, main or
linked worktree, and observation time. Refresh is a normal button and preserves
terminal focus/lifecycle. A non-repository session says “Not detected.” A Git
inspection error explains that the terminal survived and offers retry.

## Architecture

- Systems and modules touched: contracts, local Git inspector, session manager,
  WebSocket request dispatch, browser transport, inspector UI.
- Systems of record: Git owns repository, branch, commit, and worktree truth;
  Pacium owns only the current bounded observation.
- State transitions: unavailable/non-repository → ready/unborn/error on launch
  or explicit refresh.
- Protocol/schema impact: protocol 5 adds required repository inspection
  evidence and one typed refresh request.
- Relevant ADRs: ADR-0005, ADR-0013, ADR-0014, ADR-0015.

## Security and privacy

- Authorization: the existing local token and Origin checks protect refresh.
- Privilege: Git runs as the Pacium host user with fixed read-only arguments;
  no shell or repository-provided command is executed.
- Secrets/logging: no Git environment, file content, remote URL, or config is
  returned or logged.
- Abuse/failure scenario: hostile paths and Git output are canonicalized,
  bounded, schema-validated, and rendered as plain React text.

## Reliability

- Idempotency: refresh only replaces the current observation.
- Timeouts/retries: each Git command has a short timeout; retries are explicit.
- Restart behavior: live session state remains in memory; a new server has no
  restored direct PTY or stale Git cache.
- Unknown outcome: terminal remains usable and context says inspection failed.
- Migration/rollback: protocol 5 is an atomic local client/server change; no
  durable state migration.

## Test plan

- Unit: branch, detached, unborn, main/linked, non-repository, bounded failure.
- Contract: strict repository context and refresh request parsing.
- Integration: create/refresh session with fake inspector and unchanged PTY.
- Browser: existing keyboard/responsive regression suite.
- Failure/recovery: Git missing, timeout, malformed/bounded output, refresh
  failure.
- Security: fixed executable/arguments, canonical root, no shell interpolation.

## Dependencies

- Blocked by: PC-013 canonical cwd, PC-016 repository grouping.
- Blocks: PC-034 changed files, PC-035 diff, PC-036 history, PC-037 verification.

## Evidence required

- Direct Git fixture comparisons for branch, HEAD, and worktree kind.
- Focused contract, inspector, session, transport, and rendering results.
- `pnpm verify` and `pnpm test:e2e`.
- Synchronized protocol, status, backlog, issue, plan, README, and changelog.

## Open questions

- Dirty/clean worktree status is intentionally assigned to PC-034 so this slice
  can establish the repository identity and refresh boundary first.

## Implementation evidence

- Five inspector tests cover fixed commands, main/linked, branch/detached/unborn,
  ordinary folders, missing Git, timeout, malformed output, bounded output, and
  a root-containment failure.
- Protocol tests enforce cross-field repository invariants and reject a refresh
  payload containing a command.
- Session and WebSocket tests show refresh emits protocol-5 evidence without
  replacing, signalling, or stopping the PTY.
- Rendered tests cover ready, detached, unborn, degraded, and non-repository
  states using textual labels.
- Direct fixed Git commands returned this checkout’s canonical root, branch
  `codex/repository-context`, and exact 40-character HEAD.
- `pnpm verify` passes with 34 test files and 141 tests.
- `pnpm test:e2e` passes all four Chromium regressions.
