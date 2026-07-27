# PC-022: Terminal tabs

## Problem

Repository grouping makes sessions easier to find, but the terminal canvas still exposes only one selected session with no visible working set. Moving between active terminals requires returning to the full sidebar, and the operator cannot keep important sessions pinned, reorder the immediate working set, or close a view without terminating its PTY.

## Outcome

The operator can maintain a compact, ordered tab strip for active terminal views. Tabs can be selected, pinned, reordered, and closed without conflating view closure with process termination. The active tab and tab order recover safely across browser refresh when the referenced PTYs still exist.

## Scope

- Add a browser-owned terminal-tab model.
- Open a tab whenever a sidebar session is selected or a session is created.
- Select tabs with the mouse and existing numbered/previous/next shortcuts.
- Pin and unpin tabs.
- Reorder tabs with drag and drop or keyboard controls.
- Close a tab without closing its PTY.
- Remove tabs whose server session no longer exists.
- Preserve valid tab order, pins, and active selection in local browser storage.
- Provide horizontally scrollable overflow behavior.

## Non-scope

- Split panes.
- Renaming, duplicating, or relaunching sessions.
- Server-side or cross-browser tab persistence.
- Recently closed tabs.
- Terminal process termination from the tab-close control.
- Command palette.

## Acceptance criteria

- [ ] Selecting a sidebar session opens and selects one tab without duplicates.
- [ ] Tabs expose name, command label, process state, and active state.
- [ ] Closing a tab keeps the underlying PTY and sidebar session alive.
- [x] Closing the active tab selects a deterministic adjacent tab or the empty canvas.
- [x] Pinning moves a tab into a stable leading pinned group.
- [x] Reordering preserves the pinned and unpinned boundaries.
- [ ] Pointer and keyboard tab reordering are both available.
- [ ] Overflow remains horizontally navigable without shrinking terminal content.
- [x] Refresh restores only tab references that still exist in the server session list.
- [x] Server-side session closure removes its tab and recovers selection.
- [x] Pure tab-state behavior has deterministic unit tests.
- [x] The full repository verification gate passes.

## User experience

The tab strip sits directly above the active terminal. Each tab shows a state dot, session name, and compact command label. Pin and close controls are labelled for assistive technology. Closing a tab says explicitly that the terminal continues running in the sidebar; terminating a PTY remains the separate consequence-aware Close action.

Pinned tabs stay at the beginning of the strip. Reorder controls do not allow a tab to cross the pinned boundary accidentally. When tabs overflow, the strip scrolls horizontally and keyboard focus brings the active control into view.

## Architecture

- Systems and modules touched: web session model, React workspace shell, styles, unit tests.
- Systems of record: the local server remains authoritative for PTY sessions; browser state owns the open-tab view.
- State transitions: open/select, close-view, pin/unpin, reorder, reconcile-after-session-list, restore-after-refresh.
- Protocol/schema impact: none.
- Relevant ADRs: ADR-0013, ADR-0014, ADR-0015.

## Security and privacy

- Authorization: unchanged local token and Origin boundary.
- Privilege: tabs never create shell commands or change process authority.
- Secrets/logging: local storage contains only session IDs, order, and pin state.
- Abuse/failure scenario: malformed or stale local-storage data is ignored; unknown session IDs are removed during reconciliation.

## Reliability

- Idempotency: opening an already-open session selects the existing tab.
- Timeouts/retries: none.
- Restart behavior: direct PTYs still end with the server; stale tabs disappear when the new session list arrives.
- Unknown outcome: closing a view never sends a process mutation.
- Migration/rollback: invalid or older tab state falls back to an empty tab list and can be removed without affecting PTYs.

## Test plan

- Unit: open, deduplicate, adjacent selection, pin normalization, boundary-safe reorder, stale reconciliation, local-state parsing.
- Contract: none; protocol is unchanged.
- Integration: existing session-list and reconnect tests remain green.
- Browser: create two terminals, switch tabs, pin, reorder, close a view, confirm the sidebar session survives, refresh.
- Failure/recovery: stale and malformed local storage; server-side active-session close.
- Security: prove tab close invokes no transport close command through the pure action boundary and rendered workflow.

## Dependencies

- Blocked by: PC-010 through PC-017 and the implemented portions of PC-020/PC-021.
- Blocks: PC-023 split panes and the remaining PC-026 keyboard/command work.

## Evidence required

- Tab-model unit-test results.
- Full `pnpm verify` output.
- Rendered browser workflow evidence when the browser backend is available.
- Clean diff and exact integration commits.

## Open questions

- Cross-browser durable workspaces remain part of PC-020/PC-027, not this browser-local slice.
