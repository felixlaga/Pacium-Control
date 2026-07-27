# PC-023: Split-pane terminal workspace

## Problem

Tabs provide a compact terminal working set, but only one session is visible at a time. Supervising Meta, Orchestrator, and coding workers still requires constant switching, and a visual-only split would be unsafe if multiple terminal surfaces competed to resize or write to the same PTY.

## Outcome

The operator can arrange up to four live terminal sessions in a compact horizontal or vertical split layout. One pane has explicit application focus and owns terminal input. Pane closure never terminates a process, layouts restore safely after refresh, and each visible session has exactly one terminal surface.

## Scope

- Add a bounded browser-owned binary split-layout model.
- Split the focused pane right or down into an empty pane.
- Choose or move an existing running session into an empty pane.
- Prevent one session from rendering in multiple panes.
- Focus panes independently from sidebar and tab selection.
- Resize adjacent panes with a bounded draggable separator.
- Maximize and restore a pane without destroying the underlying layout.
- Close a pane without terminating its PTY.
- Preserve valid layout, ratios, focus, and maximized state in local storage.
- Subscribe and restore every visible session through the existing multi-session transport.
- Add visible controls and keyboard shortcuts for split creation and pane focus.

## Non-scope

- Detaching panes into native windows.
- More than four simultaneous rendered terminals.
- Server-side or cross-browser layout persistence.
- Automatically tiling every running session.
- tmux window or pane mutation.
- Process termination from the close-pane control.
- A generalized dock-layout framework.

## Acceptance criteria

- [ ] The focused pane can split right or down through visible controls and keyboard shortcuts.
- [ ] An empty pane clearly offers available running sessions without creating a duplicate terminal surface.
- [ ] Selecting a tab or sidebar session assigns it to the focused pane, or focuses its existing pane.
- [ ] Every visible live pane receives its own snapshot, ordered terminal output, input, and resize path.
- [ ] Pane focus is visually and textually distinguishable from tab/sidebar selection.
- [ ] A separator resizes adjacent panes within safe minimum ratios.
- [ ] Maximize and restore preserve the nested layout.
- [ ] Closing a pane keeps its terminal process and tab alive.
- [ ] Moving a session to an occupied pane swaps the two pane assignments deterministically.
- [ ] Stale or malformed stored layouts recover without affecting PTYs.
- [ ] Closing a server session removes it from the layout and recovers focus.
- [ ] Pure layout behavior has deterministic unit tests.
- [ ] The full repository verification gate passes.

## User experience

Split controls live beside the terminal tabs and in each pane header. Splitting creates a calm empty pane with a short session picker rather than duplicating the current terminal. Focus uses a restrained violet edge and a textual “Focused” label. Pane headers show session name, command, state, and view-only actions.

The application caps the initial layout at four panes. This keeps the workspace legible, prevents accidental resource-heavy grids, and matches the personal Meta/Orchestrator/worker oversight use case.

## Architecture

- Systems and modules touched: browser layout reducer, App transport routing, terminal surface focus behavior, split renderer, styles, tests.
- Systems of record: the server remains authoritative for PTYs; browser local state owns layout references and ratios.
- State transitions: split, focus, assign/move/swap, resize, maximize/restore, close-view, reconcile.
- Protocol/schema impact: none; the current WebSocket client already supports multiple terminal subscriptions.
- Relevant ADRs: ADR-0013, ADR-0014, ADR-0015.

## Security and privacy

- Authorization: unchanged local token and Origin boundary.
- Privilege: layout actions do not create commands or mutate a PTY.
- Secrets/logging: local storage contains bounded pane IDs, session IDs, direction, ratios, focus, and maximized state only.
- Abuse/failure scenario: malformed, deeply nested, duplicate, oversized, or stale state is rejected or normalized before rendering.

## Reliability

- Idempotency: selecting a session already visible focuses its pane instead of rendering it twice.
- Resize: only the one visible surface for a session can resize its PTY.
- Restart behavior: unknown direct-PTY session references become empty panes after reconciliation.
- Unknown outcome: closing or replacing a pane changes only browser view state.
- Migration/rollback: malformed or missing layout state becomes one empty pane; PTYs and tabs remain intact.

## Test plan

- Unit: split bounds, assignment, swap, focus order, ratio clamping, maximize, close, reconciliation, parsing.
- Contract: existing protocol remains unchanged.
- Integration: one browser WebSocket attaches to multiple sessions and receives both snapshots/streams.
- Browser: split right/down, choose sessions, type in each, resize, maximize, close, refresh.
- Failure/recovery: stale sessions, malformed local state, server-side session close, reconnect.
- Security: layout close invokes no process mutation and local storage remains metadata-only.

## Dependencies

- Blocked by: PC-022 terminal tabs and multi-subscription WebSocket behavior.
- Blocks: remaining PC-024 session actions, PC-026 command palette, and side-by-side Meta/Orchestrator operation.

## Evidence required

- Layout-model unit-test results.
- Multi-session subscription integration result.
- Full `pnpm verify`.
- Rendered workflow evidence when a browser backend is available.

## Open questions

- None blocking this bounded first layout.
