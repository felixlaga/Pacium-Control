# Implementation plan: Evidence-backed repository context

- Issue: [PC-033](repository-context-issue.md)
- Owner: Felix
- Agent/session: Codex `/root`
- Branch: `codex/repository-context`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `9eff80a`
- Target milestone: Milestone 2
- Status: Complete

## Objective

Give every terminal an honest, refreshable Git identity in the existing
inspector without starting changed-file, diff, history, mutation, or generalized
repository-service work.

## Existing behavior

`repository-context.ts` walks parent directories for a `.git` directory or
file. `SessionManager.create` stores only root and basename in protocol-4
session summaries. The values are sufficient for grouping and Finder reveal
but have no branch, commit, worktree kind, freshness, or error evidence and
cannot refresh after launch.

## Proposed behavior

Protocol 5 replaces the two nullable repository strings with one strict
repository observation. Its status is ready, not-repository, or error. Ready
and error observations carry canonical root/name where available; head state is
branch, detached, unborn, or unknown; worktree kind is main, linked, or unknown;
branch and object-format-compatible full HEAD commit are nullable; every result
has an observation time and only errors have bounded code/copy.

The local inspector runs the Git executable directly with fixed arguments,
disabled prompts, bounded output, and short timeouts. Session creation records
the first observation. A typed refresh request reinspects the session cwd,
updates the summary, and emits the normal session-updated event. The inspector
shows the current evidence and a refresh button.

## Architecture and boundaries

### Modules touched

- `packages/contracts`: repository observation and protocol-5 refresh request.
- `apps/local-server/repository-context`: fixed-command Git inspector.
- `apps/local-server/session-manager`: creation and refresh ownership.
- Local WebSocket dispatch and browser transport: typed refresh routing.
- Browser repository card, session grouping/action consumers, styles, tests.

### Data/state changes

- Entity/schema changes: required `repository` observation replaces
  `repositoryRoot` and `repositoryName` on session summaries.
- Commands/events: add `session.refreshRepository`; reuse `session.updated`.
- Idempotency: repeated refresh replaces one in-memory observation.
- Migration: none; browser and local server move atomically to protocol 5.

### Protocol changes

- Increment `PROTOCOL_VERSION` from 4 to 5.
- Reject extra/malformed repository fields and browser attempts to inject
  repository evidence during session creation.
- Bound root, name, branch, commit, error code/copy, and timestamp.

### Authorization and privilege

- Existing token and Origin checks apply to the refresh message.
- Use `execFile`, never a shell, generic command payload, or repository text as
  executable input.
- Git inherits host-user filesystem access but receives no terminal
  environment dump or credentials from the browser.

## Sequence

1. Commit issue and implementation plan.
2. Add strict protocol-5 repository evidence and contract tests.
3. Replace marker walking with a bounded injectable Git inspector and fixtures.
4. Integrate initial and refreshed observations into session lifecycle.
5. Route the typed refresh request through server and browser transport.
6. Add the compact repository evidence card and migrate existing consumers.
7. Synchronize docs and run complete gates.
8. Merge and push the small commit series to `dev`.

## Failure model

| Failure point              | Expected state                                  | Recovery                  |
| -------------------------- | ----------------------------------------------- | ------------------------- |
| Not a Git working tree     | `not_repository`; terminal starts               | Choose another cwd        |
| Git executable missing     | Bounded `error`; terminal starts                | Install Git, then refresh |
| Git command timeout        | Bounded `error`; no child left running          | Retry explicitly          |
| Malformed/oversized output | Bounded `error`; output is not forwarded        | Inspect repository/Git    |
| Detached HEAD              | Ready/detached with commit and no branch        | Informational only        |
| Unborn branch              | Ready/unborn with branch and no commit          | Informational only        |
| Refresh fails              | New bounded error observation; PTY is unchanged | Retry explicitly          |
| Browser reconnect          | Current in-memory observation is listed         | Refresh if desired        |

## Compatibility

- Supported versions: pinned Git on supported macOS/Linux host environments;
  object IDs of 40–64 lowercase hexadecimal characters.
- Fallback behavior: Git evidence degrades independently from terminal use.
- Rollback: revert protocol/client/server together; no repository files or
  durable Pacium state are changed.

## Test plan

- Unit: command parsing, branch/detached/unborn/main/linked/error/none.
- Property/fault: bounded output, timeout, malformed root/commit, stderr
  redaction.
- Contract: strict observation invariants and refresh request.
- Integration: session launch/refresh event with fake inspector; PTY identity
  and lifecycle unchanged.
- Browser: rendered repository evidence states and existing Chromium suite.
- Security: fixed executable and arguments; canonical path; no shell.
- Performance: each command timeout and total create-delay boundary recorded.

## Documentation changes

- Protocol/status/README/backlog/issue/plan/changelog.
- Record that changed-file status begins in PC-034.

## Rollout

- Development: real branch, detached checkout, linked worktree, empty repo, and
  ordinary folder fixtures.
- Integration: full protocol/session/WebSocket/web suite.
- Canary: local `dev` only.
- Production: none; project remains pre-release.

## Open questions

- Event-informed/debounced filesystem refresh belongs with PC-034 changed-file
  observation; PC-033 supplies explicit refresh and a reusable inspector.

## Approval

- Product: makes agent checkout ownership visible without adding Git-client
  complexity.
- Architecture: Git remains authoritative; Pacium keeps one current bounded
  observation.
- Security: fixed read-only commands, no shell, no Git mutations.

## Result

Protocol 5 now carries one strict repository observation on every session.
Fixed, prompt-disabled Git commands derive canonical root, branch or
detached/unborn HEAD, full commit, main/linked worktree kind, and observation
time with a 750 ms per-command timeout and 32 KiB output bound. Explicit
refresh replaces only that observation and emits the normal session update;
tests confirm the PTY identity and signals remain unchanged. The selected
session inspector renders ready, absent, and degraded evidence with a visible
Refresh control. Changed files, dirty state, diff, history, and verification
remain assigned to PC-034 through PC-037. Full verification passes with 34 test
files and 141 tests, and all four Chromium regressions pass.
