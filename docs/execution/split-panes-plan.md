# Implementation plan: Split-pane terminal workspace

- Issue: [PC-023](split-panes-issue.md)
- Owner: Felix
- Agent/session: Codex `/root`
- Branch: `codex/split-pane-workspace`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `8e7157b`
- Target milestone: Milestone 1
- Status: In progress

## Objective

Turn the single terminal canvas into a bounded, recoverable multi-terminal workspace without changing PTY authority or allowing duplicate terminal surfaces to fight over input and dimensions.

## Existing behavior

- The server supports multiple PTYs and one WebSocket client may subscribe to more than one session.
- The browser stores tabs but renders, synchronizes, and resizes only the selected session.
- Selecting a tab or sidebar session replaces the single canvas.
- Closing a tab is view-only; closing a session is a distinct server mutation.

## Proposed behavior

The browser owns a versioned binary layout containing at most four leaf panes. Each leaf contains zero or one session reference, and each session appears in at most one leaf. A focused pane owns application selection and terminal capture. Splitting creates an empty adjacent pane; choosing a session moves or swaps assignments safely.

Each visible session gets its own terminal handle and reconnect cursor. The current server subscription set provides its snapshot and output. Resizing comes only from its unique visible surface.

## Architecture and boundaries

### Modules touched

- `apps/web/src/split-layout-model.ts`: validated layout state and pure transitions.
- `apps/web/src/split-layout-model.test.ts`: deterministic reducer coverage.
- `apps/web/src/app.tsx`: layout ownership, multi-surface transport routing, persistence, shortcuts.
- `packages/terminal-ui/src/terminal-surface.tsx`: explicit focus behavior for multiple mounted surfaces.
- `apps/web/src/styles.css`: pane headers, dividers, empty picker, focus and responsive states.
- `apps/local-server/src/http-server.integration.test.ts`: multi-subscription evidence.

### Data/state changes

- Entity/schema changes: none.
- Commands/events: none.
- Browser state: additive `pacium.splitLayout`, version 1, at most four panes and three split nodes.
- Migration: missing or malformed state becomes one empty root pane.

### Protocol changes

- None. Existing `terminal.attach`, snapshots, binary frames, input, and resize are routed by session ID.

### Authorization and privilege

- Browser layout operations remain local metadata mutations.
- Close-pane never sends `session.close`.
- PTY input and resize still use typed session-targeted messages.

## Sequence

1. Add the scoped issue and plan.
2. Implement the bounded pure layout model and tests.
3. Add multi-session WebSocket integration coverage.
4. Refactor browser synchronization from one handle/cursor to session-keyed maps.
5. Render recursive splits, pane headers, empty selection, and separators.
6. Add split/focus keyboard commands and visible controls.
7. Persist and reconcile layout state.
8. Run browser workflow when available.
9. Run full verification and synchronize status evidence.
10. Commit, merge into `dev`, and push.

## Failure model

| Failure point                          | Expected state                                     | Recovery                            |
| -------------------------------------- | -------------------------------------------------- | ----------------------------------- |
| Stored layout is malformed or too deep | One empty root pane                                | Select a running session            |
| Stored session no longer exists        | Its leaf becomes empty                             | Choose another running session      |
| Same session appears twice in storage  | Later duplicate leaf becomes empty                 | Assign another session              |
| Snapshot arrives during pane mount     | Session-keyed cursor applies it once               | Reattach requests a new snapshot    |
| Browser reconnects                     | Visible cursors reset and all panes reattach       | Bounded snapshots restore each pane |
| Pane closes                            | PTY and tab survive                                | Reopen from tab/sidebar             |
| Divider reaches an edge                | Ratio clamps to the safe range                     | Drag back or use restored default   |
| Visible session closes server-side     | Pane becomes empty and focus remains deterministic | Choose another session              |

## Compatibility

- Supported versions: current protocol version 2.
- Fallback behavior: a single root pane behaves like the existing canvas.
- Rollback: remove layout state and return to the selected-session surface; PTYs and tabs are unaffected.

## Test plan

- Unit: model transitions, validation, bounds, duplicate removal, reconciliation, persistence.
- Integration: simultaneous attach and data delivery for two PTYs.
- Browser: full split, focus, input, resize, maximize, close, and refresh flow.
- Security: no process close from view actions; no terminal content in local state.
- Performance: at most four xterm surfaces; hidden maximized siblings remain mounted but visually suppressed.

## Documentation changes

- Update `STATUS.md`, `README.md`, `CHANGELOG.md`, backlog status, and evidence.

## Rollout

- Development: two shells in the Pacium repository.
- Integration: fake-PTY multi-subscription test plus full repository suite.
- Canary: `dev` branch only.
- Production: not part of this slice.

## Approval

- Product: PC-023 is the next dependency-ordered task and directly supports Meta/Orchestrator oversight.
- Architecture: browser layout state preserves server PTY authority.
- Security: no new process or filesystem capability is introduced.
