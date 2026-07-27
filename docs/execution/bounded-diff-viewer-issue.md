# PC-035: Bounded on-demand diff viewer

## Problem

Pacium now shows which files a selected terminal changed, but understanding the
actual work still requires leaving the workspace or trusting agent narration.
Rendering arbitrary repository patches naively could expose unbounded content,
follow unsafe paths, execute external diff drivers, break on binary/unusual
files, or make the inspector unusable on large changes.

## Outcome

The operator can select one reported changed file and inspect a compact,
read-only, syntax-aware unified diff beside the live terminal. The patch is
derived from Git on demand, bounded before transport, searchable and
collapsible in the browser, and honest about binary, large, missing, conflicted,
untracked, unborn-HEAD, and degraded states.

## Scope

- Protocol 7 request/response contracts for one selected-session changed path.
- Server revalidation of the requested path against a fresh changed-files
  observation before any diff read.
- Fixed Git diff arguments with external diff, text conversion, color, prompts,
  and optional locks disabled.
- HEAD-to-worktree patches for tracked files and bounded `/dev/null` comparison
  for untracked files.
- Unborn repositories represented by separate staged and unstaged patch
  sections where applicable.
- A 64 KiB UTF-8 patch-content limit, 2,000-line limit, 4,096-character
  per-line limit, and final application-message size check.
- Explicit ready, binary, too-large, missing/stale, non-repository, and degraded
  observations.
- File selection from Changes, back navigation, diff-line categories, old/new
  line numbers, hunk collapse, literal text search, line wrapping, loading,
  empty, and recovery states.

## Non-scope

- Git mutations, staging, discarding, committing, branch switching, or push.
- Arbitrary filesystem paths, generic Git arguments, or generic command
  execution.
- Multi-file combined patches or repository-wide diff transport.
- Language grammar highlighting; this slice highlights unified-diff syntax
  only.
- Side-by-side diff, review comments, patch editing, copy/apply, blame, or
  history.
- Persisting diff content, searches, collapsed hunks, or wrap preference.
- Automatic filesystem watchers; refresh and file selection remain explicit.

## Acceptance criteria

- [x] Selecting a changed file loads only that file’s current Git patch and
      preserves terminal selection, focus, and PTY lifecycle.
- [x] The server derives the canonical root from the session, rejects absolute
      or escaping paths, and refuses paths absent from fresh changed-file
      evidence.
- [x] Git runs without a shell, external diff drivers, text conversion, color,
      prompts, optional locks, or browser-supplied arguments.
- [x] Tracked staged/unstaged/mixed/deleted/renamed/type-changed/conflicted and
      untracked files produce honest patch or unsupported/degraded states.
- [x] Binary and known-large files are labelled without returning binary
      content or attempting an unbounded patch.
- [x] Patch bytes, lines, individual lines, paths, errors, and the serialized
      response are strictly bounded.
- [x] Diff headers, hunks, additions, deletions, context, and metadata render as
      text with old/new line numbers and no HTML interpretation.
- [x] Literal search, hunk collapse/expand, and line wrapping are keyboard
      operable and do not trigger new Git reads.
- [x] Loading, empty, stale/missing, binary, too-large, and error states explain
      the next useful action while the terminal remains usable.
- [x] Real Git fixtures, protocol/session/WebSocket boundaries, focused
      rendering/model tests, full verification, and browser regressions pass.

## User experience

Changes remains the file overview. Each non-binary row becomes a clear button.
Opening one replaces the list with a diff header containing Back, the file path,
status/freshness, Search, Wrap, Collapse all/Expand all, and Refresh. Native
buttons and inputs preserve predictable tab order; `Escape` from the diff
returns to the file list when search does not own focus.

Patch lines use restrained diff-syntax color paired with `+`, `-`, header, hunk,
or context text. Line numbers remain visible independently of color. Search is
literal, case-insensitive, bounded, and highlights matching rows without
injecting markup. Collapsed hunks retain their header and a textual hidden-line
count. Large, binary, stale, and failed reads show a compact reason and recovery
action instead of a blank surface.

## Architecture

- Systems and modules touched: contracts, bounded Git diff reader/parser,
  session manager, WebSocket hub, browser transport/state, Changes inspector.
- Systems of record: Git owns patch truth; Pacium keeps the selected response in
  browser memory only.
- State transitions: files → loading → ready/empty/binary/too-large/error;
  Back returns to files; Refresh repeats for the same session/path.
- Protocol/schema impact: protocol 7 adds strict `repository.diff`
  request/response messages and bounded observations.
- Relevant ADRs: ADR-0005, ADR-0013, ADR-0014, ADR-0015.

## Security and privacy

- Authorization: existing exact Origin, ephemeral token, and WebSocket schema
  checks apply.
- Privilege: fixed read-only Git commands run as the Pacium host user.
- Secrets/logging: patch content is ephemeral, is never logged or persisted,
  and is not included in notifications or diagnostics.
- Abuse/failure scenario: browser paths are treated as untrusted selectors,
  revalidated against fresh server-owned Git evidence, bounded before command
  use, and never interpolated through a shell; repository content renders only
  through React text nodes.

## Reliability

- Idempotency: diff reads are read-only and safe to repeat.
- Timeouts/retries: 1.5 second fixed-command timeout; retry is explicit.
- Restart behavior: no server or browser diff survives server restart.
- Unknown outcome: changed-file and terminal views remain available when a diff
  is stale, unsupported, excessive, or unreadable.
- Migration/rollback: protocol 7 is an atomic local client/server change with no
  durable state.

## Test plan

- Unit: patch bounds, UTF-8, line classification/numbers, hunk grouping,
  literal search, collapse, and wrap state.
- Contract: strict request/path/observation variants and cross-field
  invariants.
- Integration: fixed arguments, session-owned root, fresh path membership,
  tracked/untracked/unborn/binary/large/error, response identity, PTY unchanged.
- Browser: file selection, lazy read, search, collapse, wrap, Back/Escape,
  terminal selection, responsive inspector.
- Failure/recovery: stale selection, deleted path race, timeout,
  malformed/excess output, disconnect, selection change during request.
- Security: traversal/symlink selector, no shell/external driver/textconv,
  hostile diff text, raw HTML, and final serialized payload bound.

## Dependencies

- Blocked by: PC-034 changed-files contract, selection, and bounded Git reader.
- Blocks: PC-038 recent activity and richer later review surfaces.

## Evidence required

- Direct Git-fixture comparisons for representative tracked, untracked,
  renamed, deleted, conflicted, binary, large, and unborn states.
- Focused contract/reader/session/transport/model/rendering tests.
- Browser workflow for select/search/collapse/wrap/Back with PTY survival.
- `pnpm verify` and `pnpm test:e2e`.
- Synchronized protocol, status, backlog, issue, plan, README, and changelog.

## Open questions

- A unified patch is intentionally preferred over side-by-side rendering in
  this first slice because it fits the compact inspector and retains one
  predictable keyboard reading order.

## Completion evidence

Completed on 2026-07-27.

- `pnpm verify`: formatting, lint, type checking, 46 test files and 199 tests,
  and both production bundles passed.
- `pnpm test:e2e`: all five Chromium workflows passed, including a temporary
  real-Git repository that exercised file selection, deleted/added lines,
  literal search, wrap, hunk collapse, Escape return, focus restoration, and
  unchanged terminal selection.
- Real-Git fixture coverage passed for tracked, staged, unstaged, mixed,
  deleted, renamed, conflicted, untracked, binary, known-large, symlink, stale,
  and unborn states.
- Protocol, session manager, WebSocket dispatch, final serialized-message
  bounds, browser transport/state, hostile text rendering, and PTY-survival
  tests passed.
- The connected in-app browser backend was unavailable, so independent manual
  visual review remains a release-level evidence gap rather than part of this
  automated completion claim.
