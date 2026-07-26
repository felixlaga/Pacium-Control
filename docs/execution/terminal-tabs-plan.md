# Implementation plan: Terminal tabs

- Issue: [PC-022](terminal-tabs-issue.md)
- Owner: Felix
- Agent/session: Codex `/root`
- Branch: `codex/terminal-tabs`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `1a1434a40d2d1363d1605c68e1531df8e096e9bb`
- Target milestone: Milestone 1
- Status: Implemented locally; rendered browser validation pending

## Objective

Add a compact, accessible terminal-tab working set that preserves PTY ownership boundaries and provides deterministic selection, pinning, ordering, view closure, refresh restoration, and overflow behavior.

## Existing behavior

- The server owns multiple PTY sessions and publishes their summaries.
- The sidebar groups every session by repository.
- One selected session is attached and rendered in the terminal canvas.
- Selecting a sidebar row replaces the canvas selection.
- Browser local storage retains only the selected session ID.
- Closing from the workspace header terminates the PTY after confirmation.

## Proposed behavior

The browser maintains an ordered list of `{ sessionId, pinned }` tab references. Selecting a sidebar session opens or selects its tab. Tabs reconcile against authoritative server summaries and never keep an unknown session alive. Closing a tab changes only browser view state; terminating a session remains a distinct server command.

Pinned tabs occupy a stable leading partition. Reordering operates within the current pin partition through pointer drag-and-drop and labelled keyboard controls. The strip scrolls horizontally on overflow.

## Architecture and boundaries

### Modules touched

- `apps/web/src/session-model.ts`: pure tab transitions, reconciliation, validation, and storage serialization.
- `apps/web/src/session-model.test.ts`: deterministic tab-state tests.
- `apps/web/src/app.tsx`: state ownership, persistence, lifecycle reconciliation, and rendered controls.
- `apps/web/src/styles.css`: compact tab strip, active/pinned/focus/overflow states.

### Data/state changes

- Entity/schema changes: none.
- Commands/events: none.
- Idempotency: opening a tab for an existing session is a no-op on order and selects it.
- Migration: malformed or missing browser-local version-1 tab state becomes an empty list.

### Protocol changes

- None. Tabs reference existing `SessionSummary.id` values.

### Authorization and privilege

- View close, pin, and reorder remain browser-local.
- PTY termination still uses the existing typed `session.close` transport command.
- No commands, paths, environment values, or terminal bytes enter local storage.

## Sequence

1. Add the issue and implementation plan.
2. Implement pure tab-state parsing and transitions.
3. Add unit tests for all transitions and failure cases.
4. Integrate tab state with server session updates and local storage.
5. Render accessible tab controls and overflow styling.
6. Run the rendered workflow when browser control is available.
7. Run the full verification gate and synchronize status documentation.
8. Commit, merge into `dev`, and push.

## Failure model

| Failure point                      | Expected state                                      | Recovery                                  |
| ---------------------------------- | --------------------------------------------------- | ----------------------------------------- |
| Local storage is malformed         | Ignore it; application starts with no restored tabs | Select a sidebar session                  |
| Restored session no longer exists  | Remove the stale tab                                | Choose another live sidebar session       |
| Active PTY closes server-side      | Remove its tab and select an adjacent tab           | Canvas shows the recovered or empty state |
| Tab view closes                    | PTY and sidebar session survive                     | Select the session to reopen its tab      |
| Drag crosses pinned boundary       | Reorder is rejected                                 | Pin/unpin explicitly, then reorder        |
| Tabs exceed available canvas width | Strip scrolls horizontally                          | Scroll or keyboard-focus the desired tab  |
| Browser backend is unavailable     | Automated logic and build evidence remain valid     | Record rendered validation as pending     |

## Compatibility

- Supported versions: current protocol version 2.
- Fallback behavior: server session selection still works if no tabs restore.
- Rollback: remove browser tab state and return selection directly to the sidebar; PTY state is unaffected.

## Test plan

- Unit: parsing, open/deduplicate, close selection, pin ordering, move boundaries, reconciliation.
- Property/fault: duplicate and unknown IDs never survive normalization.
- Contract: existing protocol suite unchanged.
- Integration: full existing WebSocket and PTY suite.
- Browser: two tabs, selection, pin, reorder, close-view versus close-process, refresh.
- Security: local state contains identifiers and booleans only; no terminal or command content.
- Performance: tab transitions are linear in the small visible tab count; overflow does not render duplicate terminals.

## Documentation changes

- Update `STATUS.md`, `README.md`, `CHANGELOG.md`, and PC-022 backlog status.
- Record exact test, build, browser, runtime, and Git evidence.

## Rollout

- Development: exercise two shell sessions in one repository.
- Integration: pure reducer suite plus existing transport tests.
- Canary: local `dev` branch only.
- Production: not part of this slice.

## Open questions

- None blocking this slice.

## Approval

- Product: PC-022 is explicitly ordered in Milestone 1.
- Architecture: browser-owned tabs preserve server PTY authority.
- Security: view operations add no shell or transport capability.

## Evidence

- `pnpm verify` passed formatting, lint, type checking, 9 test files with 34 tests, and both production builds.
- Eleven deterministic web session-model tests cover tab parsing, open/deduplicate, adjacent selection, view closure, pin normalization, boundary-safe reorder, and stale reconciliation.
- The development UI and direct local-server `/api/health` endpoint both returned HTTP 200.
- Browser discovery returned no available browser instances, so rendered tab interaction and visual/accessibility review remain pending.
- Verification ran on Node.js 26.4.0 with the documented engine warning; Node.js 24.18.x remains the supported but unverified runtime.
