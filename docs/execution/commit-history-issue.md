# PC-036: Bounded recent commit history

## Problem

Pacium now shows a selected terminal’s repository, changed files, and one-file
patches, but the operator still has to leave the workspace to answer a basic
oversight question: what work has recently landed on this checkout’s current
HEAD? Trusting terminal narration is insufficient, while exposing arbitrary
revisions or generic Git arguments through the browser would create an
unnecessary command and data surface.

## Outcome

The operator can open a compact History inspector for the selected terminal and
read a fresh, bounded list of commits reachable from its current HEAD. Each row
shows exact local Git evidence—commit ID, subject, author name, authored time,
and parent shape—without changing the repository, contacting a remote, reading
patches, or affecting the PTY.

## Scope

- Protocol-8 request/response contracts for selected-session recent history.
- Session-owned canonical repository root and fixed `HEAD` history reads.
- At most 50 commits plus an explicit truncation indicator.
- Bounded full commit IDs, subjects, author names, timestamps, parent lists,
  errors, command output, and final serialized messages.
- Ready, unborn/empty, non-repository, and degraded states.
- A lazy History inspector tab with refresh, compact rows, merge labels,
  freshness, loading, empty, error, keyboard navigation, and narrow layouts.
- Disposable per-session browser state with request identity, reconnect
  interruption, and stale-response rejection.

## Non-scope

- Commit creation, amend, reset, revert, cherry-pick, rebase, checkout, branch
  changes, fetch, pull, push, or any other Git mutation.
- Browser-supplied revisions, ranges, paths, format strings, flags, counts, or
  generic Git commands.
- Remote or pull-request metadata, network access, ahead/behind calculations,
  or fetching missing references.
- Commit patch/detail views, file lists, signatures, blame, tags, graph lanes,
  search, pagination, or multi-repository aggregation.
- Configured-base comparison until a server-owned workspace/base configuration
  exists.
- Persisting or polling commit history.

## Acceptance criteria

- [ ] History is derived from the selected session’s canonical repository root
      and fixed current `HEAD`, with no browser-selected revision or command
      arguments.
- [ ] Git runs read-only without a shell, pager, signature display, prompts,
      optional locks, or network access.
- [ ] At most 50 commits are returned in deterministic newest-first reachability
      order, with honest truncation and unborn/empty behavior.
- [ ] Commit IDs, parent IDs, author names, subjects, timestamps, errors, raw
      output, record counts, and final serialized responses are strictly
      bounded and validated.
- [ ] Subjects and author names render only as untrusted text; control
      characters cannot alter layout, inject markup, or become terminal input.
- [ ] History loads lazily, refreshes explicitly, rejects stale responses, and
      interrupts pending state honestly across disconnects.
- [ ] Opening, refreshing, navigating, or failing History preserves terminal
      selection, focus model, process state, and PTY lifecycle.
- [ ] Ready, truncated, unborn/empty, non-repository, timeout, invalid-output,
      and unavailable-Git states explain freshness and the next useful action.
- [ ] Parser, contract, real-Git, session/WebSocket, rendering/state, full
      verification, and browser regression evidence pass.

## User experience

History becomes a third compact inspector tab beside Overview and Changes. It
loads only when selected and shows the repository name, branch or detached
context, observed time, and Refresh. Commit rows lead with a short display hash
and subject, then author and relative/local time; merge commits carry a textual
“Merge” label so parent shape is not encoded by color alone.

The list is read-only and keyboard-scrollable. Loading retains prior evidence
when available. Unborn repositories teach that no commits exist yet.
Non-repository and degraded states keep the terminal visible and state exactly
what survived. A 50-commit ceiling is called out with “Showing newest 50”
rather than implying complete history.

## Architecture

- Systems and modules touched: contracts, bounded Git history reader, session
  manager, WebSocket hub, browser transport/state, inspector tabs/history UI.
- Systems of record: Git owns commit truth; Pacium holds only the current
  bounded browser observation.
- State transitions: idle → loading → ready/empty/error; disconnect restores
  prior evidence or returns to idle; Refresh repeats the same fixed read.
- Protocol/schema impact: protocol 8 adds strict `repository.history`
  request/response messages.
- Relevant ADRs: ADR-0005, ADR-0013, ADR-0014, ADR-0015.

## Security and privacy

- Authorization: existing exact Origin, ephemeral token, and strict WebSocket
  schema checks apply.
- Privilege: fixed local Git history inspection runs as the Pacium host user.
- Secrets/logging: commit subjects and authors are not logged or persisted;
  emails, bodies, patches, environment values, and remote URLs are not read.
- Abuse/failure scenario: repository commit data is untrusted and can be
  malformed or excessive, so parsing and field normalization fail closed
  within command and message bounds before React text rendering.

## Reliability

- Idempotency: history reads are read-only and safe to repeat.
- Timeouts/retries: one bounded fixed-command timeout; retry is explicit.
- Restart behavior: history observations do not survive server or browser
  restart.
- Unknown outcome: the terminal and previously loaded repository/changes/diff
  evidence remain usable if history cannot be read.
- Migration/rollback: protocol 8 is an atomic local client/server change with
  no durable state.

## Test plan

- Unit: record framing, field/control-character normalization, IDs, parents,
  timestamps, limits, truncation, empty/unborn, and degraded errors.
- Contract: valid and invalid observation variants, counts, bounds,
  cross-field invariants, extra keys, and command-free request.
- Integration: real linear/merge history, unusual subject/author text, 51+
  commits, detached HEAD, unborn repository, missing Git, timeout, malformed
  output, session ownership, and unchanged PTY.
- Browser: lazy History load, row evidence, truncation, Refresh, inspector-tab
  keyboard navigation, narrow layout, and unchanged terminal selection.
- Failure/recovery: disconnect, stale response, selected-session change,
  repository loss, timeout, and malformed/excess output.
- Security: no browser revision/args, no shell/pager/network, bounded hostile
  commit text, React text-only rendering, and final payload bound.

## Dependencies

- Blocked by: PC-033 repository context and the existing authenticated
  session-owned Git inspection boundary.
- Blocks: PC-038 recent activity and richer later review surfaces.

## Evidence required

- Direct real-Git comparisons for linear, merge, detached, truncated, unusual
  text, and unborn histories.
- Focused parser, contract, session, WebSocket, browser-state, and semantic
  rendering tests.
- Browser workflow proving lazy history and unchanged terminal selection.
- `pnpm verify` and `pnpm test:e2e`.
- Synchronized protocol, status, backlog, issue, plan, README, and changelog.

## Open questions

- Configured-base relationships remain intentionally deferred until Pacium has
  a server-owned workspace/base configuration; guessing `main`, `master`, or
  an upstream would be inaccurate.
