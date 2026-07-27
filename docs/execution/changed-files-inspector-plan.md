# Implementation plan: Bounded changed-files inspector

- Issue: [PC-034](changed-files-inspector-issue.md)
- Owner: Felix
- Agent/session: Codex `/root`
- Branch: `codex/changed-files-inspector`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `1e9ad19`
- Target milestone: Milestone 2
- Status: In progress

## Objective

Add one calm, read-only Changes view that answers “what is this agent changing?”
from direct Git evidence, without adding diff text, Git mutations, background
watchers, persistence, or a generalized repository service.

## Existing behavior

Protocol 5 session summaries contain refreshable canonical repository identity,
branch/detached/unborn HEAD, commit, main/linked worktree, and bounded errors.
The selected-session inspector shows that evidence in Overview. No command reads
worktree status, no changed-file contract exists, and the browser has no
repository-status request state.

## Proposed behavior

Protocol 6 adds `repository.changes` request/response messages. The request
contains only request and session IDs. The server resolves the current
server-owned repository root, runs fixed prompt-disabled status/numstat commands,
and returns one strict observation associated with session, root, HEAD commit,
and observation time.

At most 500 files are returned. Each entry has current path, optional previous
path, semantic kind, staged/unstaged/untracked/conflicted booleans, nullable
additions/deletions, binary and large labels, and size when known. Totals sum
known text counts and separately report files with unavailable counts.

The inspector gains Overview/Changes tabs. Changes requests lazily on first
selection and explicitly on Refresh. Browser state is keyed by session ID, is
not persisted, ignores stale responses for presentation, and never changes
terminal selection or focus.

## Architecture and boundaries

### Modules touched

- `packages/contracts`: strict file/observation schemas and protocol 6.
- `apps/local-server/git-changes`: fixed command runner, NUL parsers, stat
  classification, deterministic ordering/totals.
- Session manager: server-owned session repository resolution only.
- WebSocket hub: request dispatch and bounded response.
- Browser transport/model: typed request identity and per-session load state.
- Inspector Changes components/styles/tests.

### Data/state changes

- Entity/schema changes: no session mutation; changes are a separate response.
- Commands/events: `repository.changes` request and response.
- Idempotency: every request is read-only and self-contained.
- Migration: no durable state; protocol 5 → 6 is atomic.

### Protocol changes

- Increment `PROTOCOL_VERSION` to 6.
- Add strict changed-file kind/status/observation schemas.
- Response includes the originating request and session IDs.
- Reject paths/counts/files/errors beyond schema bounds and extra fields.

### Authorization and privilege

- Existing WebSocket token and Origin checks protect the request.
- Server ignores browser paths and derives root from the immutable session.
- `execFile` uses only the Git executable and fixed arguments; no shell,
  repository command, alias, queue text, or terminal output becomes executable.

## Sequence

1. Commit issue and plan.
2. Add protocol-6 changed-file vocabulary and contract tests.
3. Add NUL-delimited status/numstat parsers and deterministic aggregation tests.
4. Add bounded fixed-command reader and filesystem size classification.
5. Resolve changes through session manager and WebSocket request/response tests.
6. Add browser request/state model and transport tests.
7. Add Overview/Changes inspector tabs and ready/empty/error/truncated rendering.
8. Synchronize docs and run complete gates.
9. Merge and push the small commit series to `dev`.

## Failure model

| Failure point               | Expected state                                  | Recovery              |
| --------------------------- | ----------------------------------------------- | --------------------- |
| Session has no repository   | `not_repository` response; PTY unchanged        | Choose repository cwd |
| Repository identity degraded| Bounded error response                          | Refresh Overview      |
| Git unavailable/timeout     | Bounded error without stderr/content            | Install/fix Git, retry|
| Malformed/excess status     | Invalid-output error; no partial unsafe payload | Inspect Git directly  |
| More than 500 files         | First deterministic 500 plus `truncated: true`  | Use Git/diff tools    |
| Binary file                 | Binary label; line counts null                  | PC-035 may summarize  |
| Deleted file stat           | Size null; deletion remains visible             | None                  |
| Selection changes in flight | Response cached by original session only        | Open that session     |
| Browser reconnect           | Changes state resets and reloads explicitly     | Reopen Changes        |

## Compatibility

- Supported versions: Git porcelain v2 and numstat on supported macOS/Linux.
- Fallback behavior: terminal and Overview remain usable when Changes fails.
- Rollback: revert protocol/server/client together; Git and PTYs are untouched.

## Test plan

- Unit: record parsing, XY mapping, rename pairs, unusual paths, conflicts,
  numstat, binary, totals, sorting, truncation.
- Property/fault: bounds, malformed fields, duplicate records, excessive
  output, timeout, stat failures.
- Contract: valid/invalid observations and command-free request.
- Integration: fixed arguments, session-owned root, response identity, PTY
  survival.
- Browser: view model, rendered rows/states, tabs, keyboard/focus regression.
- Security: no shell, browser path, stderr, content, or raw HTML.
- Performance: 500-file cap and bounded outputs; no polling.

## Documentation changes

- Protocol/status/README/backlog/issue/plan/changelog.
- Keep PC-035 diff text, PC-036 commits, and PC-037 verification explicitly
  incomplete.

## Rollout

- Development: temporary Git fixtures for staged, unstaged, mixed, untracked,
  deleted, renamed, binary, large, and conflicted states.
- Integration: contract/session/WebSocket/browser suites.
- Canary: local `dev` only.
- Production: none; project remains pre-release.

## Open questions

- Whether a file with both staged and unstaged changes receives a dedicated
  visual group or one row with two badges will be settled by the simplest
  scannable implementation; the evidence model retains both facts either way.

## Approval

- Product: improves oversight with compact facts and no mutation controls.
- Architecture: Git remains authoritative; browser holds disposable response
  state.
- Security: fixed bounded read commands, no file content or shell.
