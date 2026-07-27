# PC-028: Responsive and accessibility baseline

## Problem

Pacium’s main terminal workflow has visible focus and many labels, but the application shell is not yet a complete keyboard or assistive-technology surface. Sidebar and inspector visibility cannot be controlled, narrow layouts simply hide context, there is no skip navigation or persistent keyboard-owner announcement, and several dialogs do not consistently support Escape, focus containment, and focus restoration.

## Outcome

The terminal workspace has a predictable semantic structure and remains operable by keyboard from a narrow remote browser through a zoomed desktop. The operator can collapse or reopen navigation and context without losing terminal processes or selection, understand whether the terminal or application owns input, skip directly to primary work, and enter or leave every modal without a keyboard trap.

## Scope

- Add a skip link to the primary terminal workspace.
- Label navigation, main workspace, inspector, terminal, status, and supporting regions.
- Add visible sidebar and inspector toggles with `Cmd/Ctrl B` and `Cmd/Ctrl Shift B`.
- Preserve panel visibility as bounded browser-local view state.
- Present collapsed panels as responsive drawers on narrow viewports without changing process ownership.
- Add a compact status bar that states connection, selected session, and terminal/application keyboard ownership.
- Add restrained live announcements for notices, connection changes, terminal capture, and process state changes.
- Complete Escape, initial focus, focus containment, and invoking-focus restoration for create, directory, rename, session-action, settings, and command dialogs.
- Ensure icon-only controls have accessible names and stateful controls expose `aria-expanded`, `aria-controls`, or `aria-pressed` as applicable.
- Respect reduced motion and forced-colors preferences.
- Enforce a documented minimum 320 px viewport and usable 200% zoom layout.
- Add pure panel/shortcut state tests, semantic server-rendered tests, and repository browser workflow tests when the browser runtime is available.

## Non-scope

- Semantically restructuring arbitrary terminal output.
- Full screen-reader mode inside xterm beyond the terminal library’s supported label boundary.
- Custom shortcut remapping.
- Mobile push notifications.
- Agent attention, Git diff, queue, or Pacium-mode semantics that do not exist yet.
- Claiming WCAG 2.2 AA certification without rendered contrast, zoom, and assistive-technology review.

## Acceptance criteria

- [x] A keyboard user can skip directly to the terminal workspace.
- [x] Sidebar, main, inspector, terminal, status, and modal landmarks have stable accessible names.
- [x] Sidebar and inspector toggle by visible controls and documented shortcuts without firing during terminal capture or text editing.
- [x] Panel visibility restores from a strict bounded browser-local record.
- [x] Narrow layouts keep reopen controls available and show requested context as drawers rather than permanently hiding it.
- [x] The status bar states connection, selected session, and current keyboard owner without relying on color.
- [x] Dynamic announcements are concise and do not reproduce terminal bytes.
- [x] Every current modal supports Escape, bounded focus containment, and invoking-focus restoration.
- [x] Icon-only and stateful controls expose names and state.
- [x] Forced-colors and reduced-motion styles preserve focus and remove nonessential effects.
- [x] The shell remains operable at 320 CSS px and at 200% zoom through responsive behavior.
- [x] Panel, shortcut, dialog, landmark, and status semantics have deterministic tests.
- [x] The full repository verification gate passes.

## User experience

Two quiet top-bar buttons control Sessions and Inspector and teach their shortcuts. At desktop widths they collapse columns. At narrower widths the same actions open focused side drawers above the terminal; the main terminal remains visible and no PTY, tab, split, or selection state changes.

A skip link appears on keyboard focus and moves directly to the terminal workspace. A compact bottom status line says, for example, “Connected · Meta · Terminal capture” and always shows the escape chord while capture is active.

Opening a modal records the invoking control. Escape or Cancel closes it and restores focus when the control still exists; otherwise focus returns to a stable workspace fallback. Tab and Shift+Tab stay within the modal, while Escape always provides an exit.

## Architecture

- Systems and modules touched: browser panel model, shortcut resolver, App shell, modal focus utility, current dialogs, split/terminal semantics, responsive/forced-color CSS, tests.
- Systems of record: browser-local panel visibility only; PTY, session, Git, and provider truth remain unchanged.
- State transitions: panel open/close/restore, modal open/close/restore, terminal capture/application ownership, connection/process announcement.
- Protocol/schema impact: none.
- Relevant ADRs: ADR-0013, ADR-0014, ADR-0015.

## Security and privacy

- Authorization: no new endpoint or mutation.
- Privilege: view and focus changes only.
- Secrets/logging: live regions never announce terminal bytes, environment values, tokens, or full paths.
- Abuse/failure scenario: untrusted session names remain React text and announcements are length-bounded by existing contracts.

## Reliability

- Idempotency: repeated panel or modal close is harmless.
- Timeouts/retries: none.
- Restart behavior: panel view state may restore after browser refresh; PTY behavior is unchanged.
- Unknown outcome: invalid panel state uses responsive-safe defaults.
- Migration/rollback: versioned browser-local record can be discarded without losing process or repository truth.

## Test plan

- Unit: panel parse/serialize/toggle, shortcut suppression, status copy, responsive default selection.
- Contract: none.
- Integration: modal focus utility and terminal-capture status changes.
- Browser: skip, panel toggles/drawers, keyboard-only modal loop, terminal escape, 320 px, 200% zoom, light/dark/forced-colors when available.
- Failure/recovery: invalid panel state, invoking element removed, session disappears while modal is open.
- Security: announcements contain state summaries only, never terminal data.

## Dependencies

- Blocked by: tabs, splits, session actions, command palette, preferences.
- Blocks: agent-attention semantics, Git inspector accessibility, Pacium queue keyboard flow, release accessibility evidence.

## Evidence required

- Panel/shortcut/status and modal-semantic test results.
- Full `pnpm verify`.
- Loopback runtime smoke.
- Rendered keyboard, screen-reader, contrast, forced-colors, zoom, and narrow-viewport evidence when a browser backend is available.

## Open questions

- Manual screen-reader and visual contrast spot checks remain release evidence;
  automated Chromium keyboard, narrow-width, 200% zoom, forced-colors, and
  reduced-motion workflows pass.

## Implementation evidence

- `apps/web/src/panel-model.test.ts` covers strict versioned persistence,
  responsive defaults, toggles, and bounded status copy.
- `apps/web/src/modal-focus.test.ts` covers Escape, both Tab boundaries, and
  focus recovery when the active element is outside a modal.
- Server-rendered component tests cover every current modal plus terminal-pane
  and workspace-status semantics.
- `tests/e2e/accessibility.spec.ts` covers skip navigation, visible and shortcut
  panel controls, nested directory-picker focus return, narrow drawers at
  320 CSS px, 200% zoom, forced colors, and reduced motion.
- `pnpm verify` passes with 27 test files and 106 tests; `pnpm test:e2e` passes
  all four browser workflows.
- Verification ran on Node.js 26.4.0 with the known engine warning. The
  approved Node.js 24.18.x clean-runtime matrix remains a release gate.
