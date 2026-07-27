# Implementation plan: Bounded on-demand diff viewer

- Issue: [PC-035](bounded-diff-viewer-issue.md)
- Owner: Felix
- Agent/session: Codex `/root`
- Branch: `codex/bounded-diff-viewer`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `0f9a910`
- Target milestone: Milestone 2
- Status: Complete

## Objective

Let the operator move from “which files changed?” to “what changed in this
file?” inside the existing inspector, using one compact, read-only unified diff
that cannot become a generic Git or filesystem read surface.

## Existing behavior

Protocol 6 exposes strict changed-file observations for a selected session.
Fixed porcelain-v2 and numstat reads derive at most 500 changed paths, status
facts, known line totals, binary/large labels, and freshness. The Changes tab
loads lazily, holds disposable per-session browser state, ignores stale
responses, and preserves terminal lifecycle and selection. It has no selectable
file action or patch-content transport.

## Proposed behavior

Protocol 7 adds a `repository.diff` request containing only request ID, session
ID, and one bounded repository-relative path. The session manager first obtains
fresh changed-file evidence for that session. The diff reader proceeds only
when the requested current path is an exact member of that observation.

For a normal repository with HEAD, one fixed `git diff HEAD -- <path>` read
shows the current tracked result. Unborn repositories use separately labelled
cached and unstaged sections. Untracked regular files use a fixed
`git diff --no-index -- /dev/null ./<path>` comparison. Known binary and
large files short-circuit before content transport; an untracked symlink or
realpath escape is rejected before comparison.

The response carries status, root, HEAD, current/previous path, observation
time, exact patch byte/line counts, up to two labelled patch sections, and one
bounded error when degraded. Patch text is capped at 64 KiB UTF-8, 2,000 lines,
and 4,096 characters per line. The WebSocket boundary checks the complete
serialized response and replaces an excessive response with `too_large`.

Selecting a file opens a diff subview inside Changes. Browser parsing assigns
diff-header, file-header, hunk, addition, deletion, context, and metadata
categories and derives old/new line numbers for ordinary unified hunks.
Combined conflict hunks remain visible with unavailable line numbers rather
than invented numbering. Literal search, hunk collapse, and wrap are local
presentation state and never trigger Git.

## Architecture and boundaries

### Modules touched

- `packages/contracts`: protocol-7 diff request, observation, section, and
  error schemas.
- `apps/local-server/git-diff-model`: path and patch bounds/normalization.
- `apps/local-server/git-diff`: fresh membership validation and fixed commands.
- Session manager and WebSocket hub: session-owned dispatch and serialized
  response bound.
- Browser transport/state: keyed request identity and stale-response handling.
- Changes inspector: selectable file rows, diff model, rendering, and controls.

### Data/state changes

- Entity/schema changes: none; diff observations remain browser-memory only.
- Commands/events: `repository.diff` request and response.
- Idempotency: repeated reads do not mutate Git, files, sessions, or PTYs.
- Migration: no durable state; browser and server move atomically to protocol 7.

### Protocol changes

- Increment `PROTOCOL_VERSION` from 6 to 7.
- Request accepts UUID request/session IDs and one relative path capped at 4,096
  characters; absolute, NUL, and `..` segment paths are rejected.
- Observation status is `ready`, `empty`, `binary`, `too_large`,
  `not_found`, `not_repository`, or `error`.
- Ready observations contain one or two strict `combined`, `staged`,
  `unstaged`, or `untracked` sections whose aggregate counts satisfy the stated
  byte/line bounds.
- All other states contain no patch sections; only `error` carries a bounded
  typed error.

### Authorization and privilege

- Existing WebSocket token and exact Origin checks authorize the request.
- Browser input never chooses a root, command, revision, flag, or executable.
- Fixed Git arguments include `--no-ext-diff`, `--no-textconv`, `--no-color`,
  `--unified=3`, and `--` path separation.
- The shared command runner keeps prompts and optional locks disabled and uses
  `execFile` without a shell.
- Untracked comparison accepts only a fresh status member, rejects symlinks and
  containment escapes, and prefixes the relative path with `./`.

## Sequence

1. Commit issue and plan.
2. Add protocol-7 diff vocabulary, invariants, and contract tests.
3. Add bounded patch normalization and browser diff-line model tests.
4. Add tracked/untracked/unborn fixed-command inspection with real Git fixtures.
5. Add session-owned membership validation and PTY-survival tests.
6. Add WebSocket dispatch, response-size fallback, and integration tests.
7. Add browser transport and keyed request-state tests.
8. Make changed-file rows selectable and add the diff subview states.
9. Add search, hunk collapse, wrap, keyboard/escape, and compact styling.
10. Add the focused browser workflow.
11. Synchronize docs and run complete gates.
12. Merge and push the small commit series to `dev`.

## Failure model

| Failure point                  | Expected state                                    | Recovery                   |
| ------------------------------ | ------------------------------------------------- | -------------------------- |
| No repository                  | `not_repository`; terminal unchanged              | Choose repository cwd      |
| Path no longer changed         | `not_found`; retain file list                     | Refresh Changes            |
| Absolute/escaping selector     | Request rejected or `not_found`                   | Re-select a reported file  |
| Untracked symlink/escape       | Bounded unsafe-path error                         | Inspect with Git directly  |
| Known binary                   | `binary`; no patch content                        | Use a binary-aware tool    |
| Known large or excessive patch | `too_large`; counts only                          | Use Git directly           |
| Git unavailable/timeout        | Bounded error without stderr                      | Fix Git and retry          |
| Malformed UTF-8/excess line    | Invalid-output error, no partial patch            | Inspect Git directly       |
| Conflict combined hunk         | Raw safe text; numbering unavailable              | Resolve in terminal/editor |
| Browser disconnect             | Pending request interrupted; prior patch retained | Reconnect and Refresh      |
| Selection changes in flight    | Response cached only for original key             | Reopen that file           |

## Compatibility

- Supported versions: Git unified/combined patch output on supported
  macOS/Linux; protocol 7 browser and server must match.
- Fallback behavior: terminal, Overview, and changed-file list remain usable
  when diff inspection fails.
- Rollback: revert protocol/server/browser together; no Git or durable state is
  modified.

## Test plan

- Unit: selector safety, UTF-8/byte/line bounds, patch-section aggregation,
  line kinds/numbers, conflict hunks, search, collapse, and wrap state.
- Property/fault: unusual names/content, CRLF, no-final-newline metadata,
  duplicate headers, long line, too many lines, excessive serialized JSON.
- Contract: all valid states, invalid cross-field combinations, extra keys,
  command-free request, and protocol 7.
- Integration: real tracked staged/unstaged/mixed/deleted/renamed/conflicted,
  untracked, unborn, binary, large, stale path, symlink, timeout, and PTY
  survival.
- Browser: file selection, lazy patch, literal search, collapse/expand, wrap,
  Back/Escape, refresh, terminal selection, and narrow inspector.
- Security: fixed args, no shell/external diff/textconv, fresh membership,
  traversal/symlink escape, React-text hostile content, final payload bound.
- Performance: one on-demand file, no polling, 64 KiB/2,000-line ceiling, local
  search over the already bounded model.

## Documentation changes

- Protocol/status/README/backlog/issue/plan/changelog.
- Keep history, verification, Git mutations, and broader review tooling
  explicitly incomplete.

## Rollout

- Development: temporary Git fixtures for all tracked/untracked/unborn and
  boundary states.
- Integration: contract/session/WebSocket/browser suites.
- Canary: localhost `dev` only.
- Production: none; project remains pre-release.

## Open questions

- Combined conflict diffs intentionally remain raw syntax-aware text with null
  line numbers in this slice; inventing two-parent numbering would add
  complexity without improving the primary oversight decision.

## Approval

- Product: adds direct work evidence with one file and no mutation controls.
- Architecture: Git remains authoritative; patch state is disposable.
- Security: fresh membership, fixed no-shell commands, content and response
  bounds, and no HTML interpretation.

## Result

Completed on 2026-07-27 as the planned protocol-7 vertical slice.

- One selected changed path is revalidated against fresh session-owned status
  before fixed, bounded Git inspection.
- Tracked, untracked, unborn, binary, large, stale, and degraded observations
  cross strict contract, session, and WebSocket boundaries without persisting
  patch content.
- The Changes inspector now opens a compact unified-diff subview with safe text
  rendering, old/new line numbers, local literal search, hunk collapse, wrap,
  explicit refresh, Back/Escape navigation, and invoking-row focus return.
- `pnpm verify` passed 46 files and 199 tests plus both production builds.
- `pnpm test:e2e` passed all five Chromium workflows, including the
  deterministic real-Git diff workflow.
- Manual in-app-browser visual review could not be performed because no browser
  backend was connected; that broader release evidence remains open and is not
  represented as completed here.
