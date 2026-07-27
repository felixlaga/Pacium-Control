# PC-026: Contextual command palette

## Problem

Pacium has visible controls and several stable shortcuts, but operators still need to remember where an action lives before using it. Session switching, split control, creation, and session actions are spread across the header, tabs, panes, and context menus. The current global shortcut resolver also has no palette state, so adding more commands directly would make terminal-focus behavior harder to reason about.

## Outcome

`Cmd/Ctrl K` opens one compact, searchable command surface that ranks the focused terminal context first. It can switch sessions, open the new-terminal flow, manage the split workspace, and route to existing session actions without bypassing their confirmations. Keyboard ownership remains explicit: terminal capture and editable controls keep ordinary input.

## Scope

- Add a pure command catalog and search/ranking model.
- Include open-session switching with repository and preset context.
- Include available creation, split, pane-focus, maximize/restore, and session-action commands.
- Rank the selected session and focused-pane actions before general commands.
- Open from a visible top-bar control and `Cmd/Ctrl K`.
- Support search input, arrow navigation, Enter execution, and Escape closure.
- Show target, consequence/context, category, availability, and shortcut where applicable.
- Include a searchable shortcut-reference view.
- Route destructive session choices to the existing review surface; never execute them directly from fuzzy selection.
- Restore focus to the invoking control when practical.

## Non-scope

- Git, verification, provider, queue, Pacium-mode, or settings commands whose consumers do not exist yet.
- A generic plugin or command-registration framework.
- Arbitrary shell commands or free-form terminal input.
- Persistent search history, telemetry, or command usage scoring.
- Customizable keyboard mappings.
- `Cmd/Ctrl P` repository/file search.
- Full preferences or sidebar/inspector visibility settings.

## Acceptance criteria

- [x] A visible control and `Cmd/Ctrl K` open the palette when application focus owns the keyboard.
- [x] The palette never opens from ordinary keys while a terminal is captured or a text field is active.
- [x] Search is case-insensitive, token-based, deterministic, and bounded.
- [x] The selected session and focused-pane commands rank before other applicable commands.
- [x] Open sessions are searchable by display name, repository, preset, and cwd.
- [x] Results state the target and consequence or context rather than exposing ambiguous verbs.
- [x] Disabled or inapplicable commands do not execute and explain why when shown.
- [x] Arrow keys, Enter, Escape, pointer selection, and visible focus work without a keyboard trap.
- [x] Session switching, new terminal, split, pane focus, maximize/restore, and the existing action menu are reachable.
- [x] Destructive choices open consequence-aware review and do not mutate process state directly.
- [x] Search and shortcut resolution have deterministic tests.
- [x] Server-rendered component tests cover empty, results, selected-result, and shortcut-reference states.
- [x] The full repository verification gate passes.

## User experience

The palette appears as a centered, restrained overlay with search focused. With no query, “Suggested” shows the selected terminal’s actions followed by workspace actions and recently ordered open sessions. Typing filters the bounded local catalog; it never sends text to a PTY or server.

Each row shows a concise command, a muted target/context line, a category, and a shortcut where one exists. An empty query teaches the most useful next action. No-match state suggests changing the search rather than implying a server failure.

Selecting a safe command closes the palette and performs it. Selecting “Review termination…” closes the palette and opens the existing session action surface, where the operator must deliberately choose and confirm termination.

## Architecture

- Systems and modules touched: browser command model, workspace shortcut resolver, `App` action routing, palette component, styles, component/model tests.
- Systems of record: current browser session, tab, and split state; live PTY truth remains server-owned.
- State transitions: closed/open, query update, active-result movement, command dispatch, close/focus restoration.
- Protocol/schema impact: none.
- Relevant ADRs: ADR-0013, ADR-0014, ADR-0015.

## Security and privacy

- Authorization: no new HTTP or WebSocket operation.
- Privilege: the palette can only invoke already-typed browser actions.
- Secrets/logging: search text and result selection are ephemeral and are not logged or persisted.
- Abuse/failure scenario: terminal or repository text is rendered as React text and can only influence search labels, never command identifiers or dispatch.

## Reliability

- Idempotency: opening or closing repeatedly does not mutate session state.
- Timeouts/retries: none; commands retain the behavior of their existing action.
- Restart behavior: catalog rebuilds from current browser/server summaries.
- Unknown outcome: transport-backed actions continue to report through existing notices and typed results.
- Migration/rollback: no persistent state or schema migration.

## Test plan

- Unit: catalog construction, context ranking, token search, bounds, session matching, active-index movement.
- Contract: none.
- Integration: reuse existing session and split action coverage.
- Browser: open/search/navigate/execute/escape/focus restoration when a backend is available.
- Failure/recovery: no-match state, selected session disappears, disabled command, palette closes during reconnect.
- Security: untrusted session text remains inert; terminal capture and editable targets suppress palette shortcuts.

## Dependencies

- Blocked by: PC-022 tabs, PC-023 splits, PC-024 session actions, fixed launch presets.
- Blocks: PC-027 preferences discoverability, PC-028 keyboard/accessibility baseline, Pacium-mode commands.

## Evidence required

- Command-model and shortcut-test results.
- Server-rendered palette component results.
- Full `pnpm verify`.
- Runtime health smoke.
- Rendered keyboard and focus workflow when a browser backend is available.

## Open questions

- Final international-layout key mappings require rendered hands-on validation.

## Completion evidence

- Pure catalog tests cover selected-context ordering, current-state availability, session bounds, and dynamic relaunch/maximize labels.
- Search tests cover case-insensitive multi-field tokens, diacritic normalization, stable ranking, 160-character query bounds, 40-result bounds, and disabled-row keyboard skipping.
- Shortcut tests prove `Cmd/Ctrl K` and `?` are suppressed during terminal capture, editable input, and modal ownership while the dedicated terminal escape chord remains available.
- Server-rendered component tests cover selected contextual results, explicit consequences, disabled reasons, no-match guidance, and filtered shortcut-reference markup.
- Palette dispatch reuses typed session, tab, and split actions; the termination result opens the existing confirmation before any process mutation.
- `pnpm verify` passed on 2026-07-27: format, lint, type checking, 20 test files with 82 tests, and both production builds.
- Development runtime smoke passed on loopback: `/api/health` and the Vite application returned HTTP 200.
- Rendered pointer, keyboard, modal-focus, responsive, and international-layout validation remains pending because the browser runtime reported no available backend.
