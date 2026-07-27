# Implementation plan: Responsive and accessibility baseline

- Issue: [PC-028](accessibility-baseline-issue.md)
- Owner: Felix
- Agent/session: Codex `/root`
- Branch: `codex/accessibility-baseline`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `fa34577`
- Target milestone: Milestone 1
- Status: Complete

## Objective

Complete the current terminal shell’s semantic, focus, panel, keyboard-owner, and narrow-layout foundations without changing PTY lifecycle or adding a parallel mobile application.

## Existing behavior

- The shell has sidebar, main, inspector, terminal tab/panel, and several dialog elements, but not every region is named.
- The inspector disappears below 980 px and the sidebar becomes icon-only below 680 px with no explicit visibility control.
- Terminal capture has a visual focused-pane label and escape chord but no persistent textual status region.
- Command palette and settings contain focus; create, directory, rename, and some session-action flows are incomplete.
- Reduced-motion styling exists only for optional transitions.

## Proposed behavior

Add a strict browser-local panel view model and responsive-safe defaults. The App owns sidebar/inspector toggles, shortcuts, drawer dismissal, `aria-expanded` state, and a compact keyboard-owner status bar. Add stable landmarks and a keyboard-visible skip link.

Create a reusable modal focus hook/utility that records initial focus, contains Tab navigation, closes on Escape, and returns focus through an explicit callback. Apply it consistently to every current dialog without changing action semantics. Add CSS for collapsed columns, narrow drawers, 320 px operation, forced colors, and reduced effects.

## Architecture and boundaries

### Modules touched

- `apps/web/src/panel-model.ts`: strict view state, parsing, serialization, responsive defaults.
- `apps/web/src/modal-focus.ts`: Escape, Tab containment, initial focus, and restoration helpers.
- `apps/web/src/session-model.ts`: sidebar/inspector shortcuts.
- `apps/web/src/app.tsx`: landmarks, panel controls, status/live regions, responsive state, dialog invokers.
- Existing dialog and terminal workspace components: focus and semantic props.
- `apps/web/src/styles.css`: skip link, status bar, collapsed columns, drawers, forced colors, reduced effects, 320 px behavior.
- Focused model, shortcut, component, and semantic tests.

### Data/state changes

- Entity/schema changes: browser-local `pacium.panelView` version 1 only.
- Commands/events: browser-local panel toggles.
- Idempotency: normalized parsing/serialization and repeated close.
- Migration: invalid or unknown state uses responsive defaults.

### Protocol changes

- None.

### Authorization and privilege

- No server or process privilege change.
- Live-region content is built from bounded application metadata, never terminal streams.

## Sequence

1. Commit issue and implementation plan separately.
2. Add strict panel state and status-copy models with tests.
3. Add sidebar/inspector shortcut resolution and tests.
4. Add named landmarks, skip navigation, panel controls, and status/live regions.
5. Add reusable modal focus behavior and apply it dialog by dialog in small commits.
6. Add collapsed desktop panels and narrow responsive drawers.
7. Add forced-colors, reduced-motion, 320 px, and 200% zoom-oriented styles.
8. Add semantic server-rendered and project browser tests where executable.
9. Run rendered validation if the connected browser backend becomes available.
10. Run full verification, synchronize evidence, merge, and push.

## Failure model

| Failure point               | Expected state                                                   | Recovery                                 |
| --------------------------- | ---------------------------------------------------------------- | ---------------------------------------- |
| Panel state malformed       | Responsive-safe defaults; no process or selection change         | Toggle and persist a valid view          |
| Local storage unavailable   | Current in-memory view works; refresh persistence is unavailable | Continue or retry after browser recovery |
| Narrow viewport opens panel | Drawer overlays main work and exposes a close action             | Close, press shortcut, or use Escape     |
| Invoking control disappears | Focus returns to stable workspace fallback                       | Continue normal keyboard navigation      |
| Session ends during dialog  | Dialog closes or reports unavailable target; process truth wins  | Reopen from current session state        |
| Terminal capture active     | Panel/global shortcuts are suppressed                            | Use dedicated escape chord first         |
| Forced-colors active        | Effects recede; borders, text, and focus remain explicit         | Use normal controls                      |

## Compatibility

- Supported versions: panel schema version 1; protocol remains version 3.
- Fallback behavior: desktop defaults show both panels; narrow defaults keep navigation compact and inspector closed.
- Rollback: remove browser-local view state and semantic/style additions without PTY or session migration.

## Test plan

- Unit: panel validation, serialization, responsive defaults, shortcut routing, status summary.
- Property/fault: malformed/oversized panel JSON and removed focus return target.
- Contract: none.
- Integration: dialog Escape/Tab/restore behavior and capture ownership.
- Browser: panel controls, drawers, skip link, full keyboard path, 320 px, 200% zoom, themes, forced colors when available.
- Security: live regions exclude terminal bytes and arbitrary paths.
- Performance: no continuous resize loop or announcement stream.

## Documentation changes

- README keyboard/panel/status behavior.
- STATUS evidence and rendered-validation boundaries.
- PC-028 backlog status.
- Issue acceptance evidence and plan result.
- CHANGELOG entry.

## Rollout

- Development: focused tests for each state/focus/component slice.
- Integration: full `pnpm verify` and loopback runtime smoke.
- Canary: not applicable for localhost development slice.
- Production: no release artifact yet.

## Open questions

- Manual screen-reader, visual contrast, and international-layout checks remain
  release evidence. Repository Playwright coverage now verifies keyboard
  navigation, focus return, narrow drawers, 200% zoom, forced colors, and
  reduced motion in Chromium.

## Result

The browser shell now exposes stable landmarks, skip navigation, explicit panel
controls, versioned responsive view state, concise keyboard-owner status, and a
shared modal focus contract. Narrow clients use dismissible side drawers while
the terminal workspace and PTY ownership remain unchanged.

Deterministic component and model tests cover semantic and state boundaries.
Four Playwright workflows verify the rendered keyboard and responsive behavior.
The full repository gate passes with 27 test files and 106 tests. Manual
screen-reader and visual contrast review remains intentionally separate from
the completed implementation claim.

## Approval

- Product: preserves terminal dominance and improves remote/narrow oversight.
- Architecture: browser-local view behavior only; no ADR change.
- Security: no new command, filesystem, or network boundary.
