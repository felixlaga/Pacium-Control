# Implementation plan: Contextual command palette

- Issue: [PC-026](command-palette-issue.md)
- Owner: Felix
- Agent/session: Codex `/root`
- Branch: `codex/command-palette`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `bc8b937`
- Target milestone: Milestone 1
- Status: Implemented; rendered browser validation pending

## Objective

Make the existing terminal, split, and session-management capabilities quickly discoverable and operable from one compact keyboard-first surface without weakening terminal-input ownership or action confirmation.

## Existing behavior

- `resolveWorkspaceShortcut` maps creation, tab selection, split creation/focus, and the terminal escape chord.
- The application-level listener suppresses shortcuts for editable targets, dialogs, and terminal capture.
- Session actions already share a deterministic availability model and consequence-aware dialog.
- Tabs and the split layout are browser-owned state; PTY commands remain typed transport operations.
- There is no palette component, query/ranking model, or shortcut-reference surface.

## Proposed behavior

Add a bounded ephemeral palette catalog derived from current sessions, selected session, tabs, focused pane, and layout capability. The catalog contains stable command identifiers rather than callbacks or shell text. A pure matcher tokenizes the query, ranks selected-context commands first, and returns a bounded deterministic result list.

`Cmd/Ctrl K` or a top-bar button opens command search. `?` opens the searchable shortcut reference when application focus owns the keyboard. Search, arrows, Enter, pointer selection, and Escape are handled inside a modal with focus restoration. The app dispatches selected identifiers through existing typed action functions. Termination routes to review rather than sending a process mutation.

## Architecture and boundaries

### Modules touched

- `apps/web/src/command-palette-model.ts`: stable identifiers, catalog construction, token matching, context ranking, result bounds, shortcut reference.
- `apps/web/src/command-palette.tsx`: accessible command/search overlay, command and reference views, active-row navigation.
- `apps/web/src/session-model.ts`: palette/help shortcut resolution with terminal/editable/dialog suppression.
- `apps/web/src/app.tsx`: palette state, context derivation, identifier dispatch, focus restoration.
- `apps/web/src/styles.css`: compact Linear-inspired overlay, rows, groups, empty and responsive states.
- Focused model, shortcut, and server-rendered component tests.

### Data/state changes

- Entity/schema changes: none.
- Commands/events: browser-local palette command identifiers only.
- Idempotency: catalog derivation and palette open/close are pure or browser-local.
- Migration: none.

### Protocol changes

- None. Existing typed PTY and session operations are reused.

### Authorization and privilege

- No new privilege or endpoint.
- Repository, cwd, and display-name strings are inert search metadata.
- No command identifier is derived from terminal, repository, or queue text.

## Sequence

1. Commit issue and implementation plan separately.
2. Add stable palette entry types, catalog construction, and deterministic tests.
3. Add bounded token search and ranking tests.
4. Extend shortcut resolution for palette and shortcut reference.
5. Build the command/search overlay and server-rendered state tests.
6. Wire safe workspace, split, session-switch, and session-action dispatch in small commits.
7. Add destructive-action review routing and focus restoration.
8. Add compact responsive styling and accessibility semantics.
9. Run rendered validation if a browser backend becomes available.
10. Run full verification, synchronize status/evidence, merge, and push.

## Failure model

| Failure point                        | Expected state                                               | Recovery                                   |
| ------------------------------------ | ------------------------------------------------------------ | ------------------------------------------ |
| Selected session disappears          | Stale command is ignored and a bounded notice is shown       | Reopen palette from current state          |
| Query has no matches                 | Explicit no-results state; terminal and PTYs are unchanged   | Edit or clear query                        |
| Command is unavailable               | Row explains the reason and cannot dispatch                  | Select an applicable command               |
| Transport-backed command fails       | Existing typed result/notice behavior remains authoritative  | Retry from refreshed session state         |
| Palette opens during reconnect       | Local navigation remains usable; server actions are labelled | Wait for connection or choose local action |
| Invoking element disappears on close | Focus moves to the workspace fallback                        | Continue with normal tab navigation        |
| Terminal capture owns keyboard       | Palette shortcut is ignored and bytes retain terminal owner  | Use escape chord, then open palette        |
| Destructive result is selected       | Review surface opens; no process mutation occurs             | Confirm deliberately or cancel             |

## Compatibility

- Supported versions: current browser protocol version 3; no server change.
- Fallback behavior: every palette command retains an existing visible control or context-menu route.
- Rollback: remove browser-local model, overlay, shortcut entries, and dispatch without state migration.

## Test plan

- Unit: catalog contents, availability, selected-context ordering, session fields, token matching, stable ties, result/query bounds, active-index movement.
- Property/fault: hostile/unusually long labels remain inert and bounded.
- Contract: none.
- Integration: existing transport and split/session tests remain green.
- Browser: open from button/shortcut, search, arrows, execute, help, Escape, and focus restoration when available.
- Security: editable targets and terminal capture suppress global palette/help shortcuts; destructive result only opens review.
- Performance: derive and filter a bounded catalog for at least 100 synthetic sessions without unbounded results.

## Documentation changes

- README shortcuts and current-slice description.
- STATUS evidence and remaining keyboard boundaries.
- PC-026 backlog status.
- Issue acceptance evidence and plan result.
- CHANGELOG entry.

## Rollout

- Development: focused tests after each model/component/wiring slice.
- Integration: full `pnpm verify` and loopback runtime smoke.
- Canary: not applicable for localhost development slice.
- Production: no release artifact yet.

## Open questions

- International keyboard layout validation remains a rendered/manual gate.

## Approval

- Product: scoped by the accepted keyboard and command specification.
- Architecture: browser-local only; no ADR change.
- Security: no new shell, filesystem, or transport boundary.

## Result

- A pure catalog derives bounded workspace, split, selected-session, and open-session entries from current browser/server summaries.
- Deterministic search normalizes case and diacritics, matches bounded tokens across labels and context, ranks the selected terminal first, and returns at most 40 results.
- `Cmd/Ctrl K`, `?`, arrows, Enter, Escape, pointer selection, modal focus containment, and invoking-focus restoration are implemented without taking keys from terminal capture or editable controls.
- Safe commands reuse current browser actions. Transport-backed commands reuse existing typed operations. Termination opens explicit confirmation before any mutation.
- The responsive command surface includes selected, disabled, empty, commands, and searchable shortcut-reference states.
- `pnpm verify` passed on 2026-07-27 with 20 test files and 82 tests.
- Both loopback development services passed direct HTTP smoke checks.
- Rendered pointer, keyboard, modal-focus, responsive, and international-layout validation remains open because the browser runtime reported no available backend.
