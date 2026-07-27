# Implementation plan: Bounded recent commit history

- Issue: [PC-036](commit-history-issue.md)
- Owner: Felix
- Agent/session: Codex `/root`
- Branch: `codex/commit-history`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `a0d49d9`
- Target milestone: Milestone 2
- Status: Complete

## Objective

Let the operator inspect what has recently landed on the selected terminal’s
current local HEAD without leaving Pacium, while keeping the browser-to-Git
boundary fixed, read-only, bounded, local, and independent of PTY lifecycle.

## Existing behavior

Protocol 7 exposes canonical repository context, bounded changed-file evidence,
and one-file unified patches. All Git reads are selected by session ID, derive
their repository root from server-owned session state, use fixed commands, and
return disposable browser observations. The inspector has Overview and Changes
tabs. It does not expose commit history, revision selection, configured base
references, or remote metadata.

## Proposed behavior

Protocol 8 adds a command-free `repository.history` request with only request ID
and session ID. The session manager passes the session’s current repository
observation to a history inspector. Ready repositories with a HEAD run one
fixed local command equivalent to:

```text
git -c core.fsmonitor=false -C <root> --no-pager log
  --no-show-signature --date-order --max-count=51
  -z --format=<fixed NUL-delimited fields> HEAD
```

The reader parses groups of fixed NUL-delimited fields for full commit ID,
parents, author name, strict author ISO time, and subject. It normalizes
embedded layout control characters to visible spaces, rejects malformed IDs,
timestamps, record framing, excess parents, excessive fields, and duplicate
commit IDs, then returns at most the newest 50 records. Reading 51 valid records
sets `truncated: true`; no continuation token or browser-controlled count is
introduced.

Ready repositories with unborn HEAD return `empty` without executing log.
Non-repository and degraded repository observations map to explicit states.
Command errors use bounded stable copy rather than stderr. A complete
`repository.history` response is checked against the application-message limit
before send and degrades to bounded invalid/excess-output evidence if needed.

History becomes a third inspector tab. It loads lazily for the selected session,
keeps prior evidence visible while refreshing, ignores stale responses, and
returns pending state to prior/idle on disconnect. Rows show short display
hash, safe subject, author, authored time, and a textual Merge label for
multiple parents. The browser stores no history outside current memory and
never sends commit data to a terminal.

## Architecture and boundaries

### Modules touched

- `packages/contracts`: protocol-8 history request, record, observation, and
  error schemas with cross-field invariants.
- `apps/local-server/git-history-model`: fixed record framing and bounded field
  normalization.
- `apps/local-server/git-history`: repository-state mapping and fixed Git read.
- Session manager and WebSocket hub: session-owned dispatch and final response
  bound.
- Browser transport/state: request identity, lazy per-session observation, and
  disconnect recovery.
- Inspector: three-tab keyboard model and compact history presentation.

### Data/state changes

- Entity/schema changes: none; commit observations remain browser-memory only.
- Commands/events: `repository.history` request and response.
- Idempotency: repeated history reads do not mutate repositories, sessions, or
  PTYs.
- Migration: no durable state; browser and server move atomically to protocol 8.

### Protocol changes

- Increment `PROTOCOL_VERSION` from 7 to 8.
- A commit record contains a 40–64 lowercase hexadecimal ID, up to 16 parent
  IDs, a 1–200 character normalized author name, a strict ISO authored time,
  and a 1–500 character normalized subject.
- An observation contains status `ready`, `empty`, `not_repository`, or
  `error`; nullable root/HEAD context; observation time; at most 50 records; a
  truncation boolean; and one bounded typed error only for `error`.
- Ready requires repository root, HEAD, at least one commit, and no error.
  Empty permits unborn HEAD with no records. Non-repository contains no
  repository/commit data. Error contains no records and one stable bounded
  error.
- Request and response objects are strict and contain no revision, range,
  count, format, path, command, or environment fields.

### Authorization and privilege

- Existing WebSocket token and exact Origin checks authorize the request.
- The browser never chooses repository root, revision, count, sort order,
  formatting, executable, flags, or environment.
- `execFile` runs Git without a shell; `GIT_TERMINAL_PROMPT=0` and
  `GIT_OPTIONAL_LOCKS=0` remain enforced.
- Fixed arguments disable the pager and signature display and inspect only
  local `HEAD`; no remote or network command is run.
- Commit output and stderr are not logged, persisted, interpreted as HTML, or
  passed to the PTY.

## Sequence

1. Commit the PC-036 issue and implementation plan.
2. Add protocol-8 history vocabulary, invariants, and contract tests.
3. Add bounded NUL-record normalization and fault tests.
4. Add fixed history inspection with direct real-Git fixtures.
5. Add session-owned history dispatch and PTY-survival tests.
6. Add WebSocket response bounding and integration tests.
7. Add browser transport and per-session request-state tests.
8. Add the third inspector tab and compact history states.
9. Add lazy app integration, reconnect behavior, and focused semantic tests.
10. Add the deterministic browser workflow.
11. Synchronize docs and run complete gates.
12. Fast-forward and push the small commit series to `dev`.

## Failure model

| Failure point               | Expected state                                    | Recovery                    |
| --------------------------- | ------------------------------------------------- | --------------------------- |
| No repository               | `not_repository`; terminal unchanged              | Choose a repository cwd     |
| Unborn HEAD                 | `empty`; explain that no commits exist            | Create the first commit     |
| Repository evidence failed  | Bounded `repository_unavailable` error            | Refresh repository/history  |
| Git missing                 | Bounded `git_unavailable` error                   | Install or expose Git       |
| Git timeout                 | Bounded `timeout` error                           | Retry or inspect with Git   |
| Nonzero log exit            | Bounded `inspection_failed` error                 | Inspect repository directly |
| Malformed/excess output     | Bounded `invalid_output` error; no partial list   | Inspect repository directly |
| More than 50 commits        | Newest 50 plus explicit truncation                | Use Git for older history   |
| Browser disconnect          | Pending state restores prior evidence or idle     | Reconnect and Refresh       |
| Session changes in flight   | Old request cannot replace selected-session state | Open the intended session   |
| Final message exceeds bound | Bounded invalid/excess state                      | Use Git directly            |

## Compatibility

- Supported versions: local Git SHA-1 or SHA-256 object IDs with strict ISO
  author dates; protocol 8 browser and server must match.
- Fallback behavior: terminal, Overview, Changes, and Diff remain usable when
  history is empty or degraded.
- Rollback: revert protocol/server/browser together; no repository or durable
  state is modified.

## Test plan

- Unit: NUL framing, ID/parent parsing, author/subject normalization, control
  characters, timestamp strictness, duplicate IDs, 50/51 records, and all field
  limits.
- Property/fault: missing/extra fields, empty subject/author, CR/LF/tab/escape
  characters, oversized UTF-8, excess parents, invalid object IDs, malformed
  dates, and output-buffer overflow.
- Contract: all valid states, invalid cross-field combinations, exact bounds,
  extra keys, command-free request, and protocol 8.
- Integration: real linear/merge/detached/unborn/51-commit histories, unusual
  metadata, fixed args, timeout, missing Git, invalid output, session ownership,
  response identity, and unchanged PTY.
- Browser: lazy load, Refresh, merge/truncation text, three-tab arrows/Home/End,
  selected terminal preservation, and narrow inspector.
- Security: no shell/pager/network/browser revision, bounded hostile commit
  text, React-text rendering, stale-response rejection, and final message
  bound.
- Performance: one on-demand command, no polling, 256 KiB raw-output ceiling,
  51-record parse ceiling, and 50-record payload ceiling.

## Documentation changes

- Protocol/status/README/backlog/issue/plan/changelog.
- Keep configured-base comparison, commit details/patches, remote metadata, Git
  mutations, verification, and recent activity explicitly incomplete.

## Rollout

- Development: temporary real-Git repositories for linear, merge, detached,
  truncated, hostile-text, and unborn states.
- Integration: contract/session/WebSocket/browser suites.
- Canary: localhost `dev` only.
- Production: none; project remains pre-release.

## Open questions

- Base-relative history is deferred until PC-040 or an earlier dedicated
  server-owned workspace/base configuration exists. Automatically choosing an
  upstream or branch name would make the evidence look more authoritative than
  it is.

## Approval

- Product: adds recent landed-work evidence without mutation or remote scope.
- Architecture: Git remains authoritative; history state is disposable.
- Security: fixed local HEAD, no shell/pager/network, strict output/message
  bounds, and text-only rendering.

## Result

Completed on 2026-07-27 as the planned protocol-8 vertical slice.

- A command-free selected-session request runs one fixed, local, no-pager
  `HEAD` history read with a 1.5 second timeout and 256 KiB raw-output ceiling.
- Fixed NUL framing produces at most 50 validated records from a 51-record
  window; IDs, parents, author names, ISO dates, subjects, errors, and the final
  WebSocket message are bounded.
- The inspector now has accessible Overview, Changes, and History tabs with
  cyclic arrow navigation. History loads lazily, retains prior evidence during
  Refresh, rejects stale/cross-session responses, recovers pending state on
  disconnect, and renders local commit evidence only as text.
- `pnpm verify` passed 51 files and 227 tests plus both production builds.
- `pnpm test:e2e` passed all six Chromium workflows, including deterministic
  real-Git History evidence and its 320 CSS px layout.
- Manual in-app-browser visual review could not be performed because no browser
  backend was connected; that broader release evidence remains open and is not
  represented as completed here.
