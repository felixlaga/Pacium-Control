# PC-034: Bounded changed-files inspector

## Problem

Pacium identifies each session’s repository, branch, commit, and worktree, but
the operator still has to leave the workspace or read agent narration to know
what changed. A naive status view could become noisy, read unbounded repository
data, mishandle hostile filenames, or block terminal use when Git fails.

## Outcome

The selected session can load a compact, read-only Changes view derived directly
from Git. It summarizes changed-file count and known additions/deletions, then
shows bounded files with staged/unstaged/untracked/conflicted evidence plus
added, modified, deleted, renamed, copied, type-changed, binary, and large-file
states. Refresh never mutates Git or affects the PTY.

## Scope

- Strict protocol contracts for a changed-files request and observation.
- Fixed bounded Git status and numstat commands scoped to the session’s
  canonical repository root.
- Porcelain-v2 `-z` parsing so unusual filenames remain data.
- At most 500 changed files and bounded command output.
- Known additions/deletions with explicit unknown values for binary content.
- Binary, large, renamed, copied, deleted, untracked, conflicted, staged,
  unstaged, and mixed-index/worktree evidence.
- A selected-session Overview/Changes inspector switch with lazy loading,
  refresh, loading, empty, ready, truncated, and degraded states.
- Focused parser, fault, protocol, session-boundary, transport, rendering, and
  browser-regression tests.

## Non-scope

- Diff text or file-content reads; PC-035 owns the diff viewer.
- Commit history; PC-036 owns history.
- Running verification; PC-037 owns explicit presets.
- Git mutations, staging, discarding, committing, branch switching, or push.
- Filesystem watching; this slice uses explicit and selection-triggered refresh.
- Persisting Git status or adding a repository cache/database.

## Acceptance criteria

- [ ] Status matches direct Git inspection for staged, unstaged, mixed,
      untracked, deleted, renamed, copied, type-changed, and conflicted files.
- [ ] Known text additions/deletions are shown; binary counts remain unknown.
- [ ] Large and binary files are labelled without reading file content.
- [ ] Paths, previous paths, counts, errors, file count, and total payload are
      strictly bounded.
- [ ] NUL-delimited status parsing handles whitespace/newline filenames as
      untrusted text.
- [ ] The server accepts only a session ID, resolves the repository root from
      server-owned session evidence, and exposes no generic Git command.
- [ ] A non-repository or degraded repository produces an honest empty/error
      observation without affecting the PTY.
- [ ] The Changes view loads lazily, preserves terminal selection, and exposes
      textual status rather than color alone.
- [ ] Empty, loading, ready, truncated, and error states explain the next useful
      action.
- [ ] Refresh is read-only, duplicate-safe, and leaves the terminal process
      unchanged.
- [ ] Full verification and browser regressions pass.

## User experience

The inspector gains stable Overview and Changes tabs. Overview retains session,
repository, agent, and attention evidence. Changes loads only for the selected
session and displays a compact header with repository, branch/HEAD, file count,
known `+/-` totals, freshness, and Refresh. Files are ordered for oversight:
conflicts first, then mixed/staged/unstaged tracked changes, then untracked
files. Each row shows path, previous path where relevant, status text, index and
worktree badges, known line counts, and binary/large labels. The view does not
offer stage, discard, or commit actions.

## Architecture

- Systems and modules touched: contracts, bounded Git reader/parser, session
  manager repository lookup, WebSocket dispatch, browser transport/state,
  inspector rendering.
- Systems of record: Git owns status; Pacium keeps only current browser memory.
- State transitions: idle → loading → ready/empty/truncated/error; refresh
  repeats from the selected session identity.
- Protocol/schema impact: protocol 6 adds request/response messages and strict
  changed-file observations.
- Relevant ADRs: ADR-0005, ADR-0013, ADR-0014, ADR-0015.

## Security and privacy

- Authorization: existing token and exact Origin checks apply.
- Privilege: fixed `git status`/`git diff --numstat` commands run as the host
  user with prompts and optional locks disabled.
- Secrets/logging: no file content, diff text, remote URLs, environment dumps,
  or command stderr are returned or logged.
- Abuse/failure scenario: repository-controlled paths and Git output are
  NUL-parsed, length/count bounded, schema-validated, and rendered as React
  text; malformed/excess output becomes a bounded error.

## Reliability

- Idempotency: a request returns a fresh observation and mutates no Git state.
- Timeouts/retries: bounded per-command timeout; retry is explicit.
- Restart behavior: no status cache survives server restart.
- Unknown outcome: UI labels unavailable counts and keeps terminal controls.
- Migration/rollback: protocol 6 is atomic local client/server; no durable data.

## Test plan

- Unit: porcelain-v2 records, renames, unmerged, unusual paths, numstat,
  binary, ordering, totals, and truncation.
- Contract: strict request/response and cross-field observation invariants.
- Integration: session-owned root, no-repository/error, refresh, PTY unchanged.
- Browser: tab switching, lazy loading, empty/error/ready semantics, responsive
  regression.
- Failure/recovery: timeout, missing Git, excessive/malformed output, deleted
  path stat, selection change during request.
- Security: fixed arguments, no shell, no command payload, untrusted text only.

## Dependencies

- Blocked by: PC-033 repository context and typed refresh boundary.
- Blocks: PC-035 diff viewer and PC-038 activity summary.

## Evidence required

- Direct Git-fixture comparisons for representative status states.
- Focused contract/parser/session/transport/rendering tests.
- `pnpm verify` and `pnpm test:e2e`.
- Synchronized protocol, status, backlog, issue, plan, README, and changelog.

## Open questions

- Automatic debounced refresh remains with the later watcher/activity slice;
  explicit refresh keeps this first read path simpler and easier to recover.
