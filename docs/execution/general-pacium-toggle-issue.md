# PC-041: Functional General/Pacium workspace mode

## Problem

The application still renders a disabled “Pacium mode — Soon” control even
though protocol 10 can now load the server-owned Pacium workspace definition.
The operator cannot enter a focused Pacium presentation, discover whether that
definition is ready, or return to General mode. Building role pinning or queue
UI on top of a decorative toggle would leave mode ownership, persistence,
focus, failure, and recovery undefined.

## Outcome

The operator can switch the same terminal workspace between General and Pacium
presentation through a compact segmented control, the command palette, or the
documented `G` then `P` chord. The mode survives browser refresh, never changes
PTY/session/layout/selection state, and presents server configuration as
loading, unconfigured, ready, or error without claiming that PC-042 through
PC-050 behavior exists.

## Scope

- One browser-owned version-1 General/Pacium presentation preference.
- A labelled, compact two-option segmented control in the stable application
  shell.
- `G` then `P` outside terminal capture, editable fields, and dialogs.
- A contextual command-palette action and shortcut reference.
- Pacium-mode shell styling and navigation emphasis that leaves the terminal
  visually dominant.
- Honest Pacium config loading, unconfigured, ready-summary, and error states
  with an explicit retry read.
- Screen-reader mode/status announcements and visible focus.
- Refresh and reconnect behavior using the existing protocol-10 config state.
- Unit, semantic, responsive, keyboard, persistence, and regression tests.

## Non-scope

- Editing `pacium.json` or choosing repositories, roles, queue sources,
  deliveries, objective, or plan paths.
- Pinning, launching, attaching, resolving, or targeting Meta, Orchestrator, or
  workers.
- Reading, watching, parsing, classifying, displaying, or delivering queue
  content.
- Reading objective/plan content or adding a Queue inspector tab.
- Changing the terminal layout, selected session/tab/pane, inspector tab,
  sidebar/inspector visibility, PTY lifecycle, terminal input, or Git/check
  state when mode changes.
- Protocol, server, filesystem, URL/router, multi-workspace, provider, tmux, or
  notification changes.

## Acceptance criteria

- [ ] General is the safe default when no valid browser preference exists;
      only `general` or `pacium` is restored.
- [ ] The visible control behaves as a labelled two-option selection with
      pressed/selected semantics, concise copy, keyboard focus, and restrained
      Linear-inspired hierarchy at desktop, 320 CSS px, 200% zoom, forced
      colors, and reduced motion.
- [ ] Mouse, `G` then `P`, and command-palette mode changes share one action and
      the shortcut never fires during terminal capture, text editing, or a
      modal.
- [ ] Switching mode preserves session list identity, selected session,
      terminal tabs, split tree and ratios, focused/maximized pane, inspector
      tab, panel visibility, PTY processes, terminal sync/input state, and
      current Git/check evidence.
- [ ] Pacium mode can be entered while config is loading, unconfigured, ready,
      errored, or disconnected; each state states what is known and that
      terminals survived.
- [ ] Ready presentation uses only the accepted config observation and labels
      configured role/worker/queue counts without claiming live resolution,
      queue observation, or delivery.
- [ ] Error presentation exposes only the bounded server message and a Retry
      action; retry sends only `pacium.config.get` and does not mutate config or
      terminals.
- [ ] Mode persistence failure leaves the in-memory change active and reports
      that refresh may return to General; it never writes server state.
- [ ] Refresh restores mode and the existing terminal layout/selection;
      reconnect reconstructs config truth without changing mode.
- [ ] General mode restores the ordinary terminal navigation and contains no
      Pacium-only placeholder chrome.
- [ ] No queue/context file read, prompt, answer, process, verification, Git,
      or protocol mutation is introduced.
- [ ] Focused tests, `pnpm verify`, and `pnpm test:e2e` pass with synchronized
      status, backlog, issue, plan, README, and changelog.

## User experience

The control is a compact segmented group:

```text
Workspace mode
[ General ] [ Pacium ]
```

Changing mode updates one restrained shell accent and the sidebar heading
without replacing the terminal canvas. Pacium mode adds one compact definition
card above the unchanged terminal groups:

- Loading: “Loading Pacium workspace definition…”
- Unconfigured: “Pacium setup is not configured yet.”
- Ready: workspace label plus configured Meta/Orchestrator, worker, repository,
  and queue-source counts, all explicitly labelled “Configured.”
- Error: “Pacium configuration is unavailable. General terminals are still
  running.” plus Retry.

PC-041 does not manufacture Meta/Orchestrator rows or a queue. The next slices
consume the ready definition. Switching back to General removes the definition
card and returns the ordinary “Terminals” hierarchy without changing current
work.

The existing notice live region announces the new mode and persistence failure.
The segmented control remains usable by Tab/Enter/Space. The `G` then `P` chord
uses a short bounded window, consumes no terminal bytes, and has no partial
mode effect if the second key is absent or different.

## Architecture

- Systems and modules touched: browser workspace-mode model/storage, shortcut
  sequence model, command-palette catalog/action, app shell, Pacium config
  presentation, styles, semantic/unit/E2E tests.
- Systems of record: browser local storage owns only presentation preference;
  accepted protocol-10 observation owns displayed definition evidence; PTYs,
  tabs/splits, Git, checks, and configured files retain their existing owners.
- State transitions: invalid/missing -> General; General <-> Pacium; persistence
  failure changes in-memory state with warning; disconnect interrupts config
  request only; reconnect get updates evidence only.
- Protocol/schema impact: none; protocol 10 get/observation is reused unchanged.
- Relevant ADRs: ADR-0007, ADR-0013, ADR-0014, and ADR-0015.

## Security and privacy

- Authorization: no new server operation; Retry uses the existing
  Origin/token-protected config get.
- Privilege: mode selection is presentation only and grants no filesystem,
  shell, terminal, Git, verification, queue, prompt, or delivery authority.
- Secrets/logging: no content, environment, token, or transcript is persisted
  or logged.
- Abuse/failure scenario: hostile stored values fail closed to General; the
  shortcut is suppressed wherever keys could belong to a terminal or input;
  bounded server error text renders as text.

## Reliability

- Idempotency: selecting the active mode is a no-op; Retry is a read.
- Timeouts/retries: the two-key chord expires locally; config retries remain
  explicit with no polling.
- Restart behavior: browser refresh restores a valid presentation preference;
  local-server restart may make session bindings unresolved but does not choose
  another mode or session.
- Unknown outcome: storage failure is reported immediately; mode remains active
  only for the current page lifetime.
- Migration/rollback: version 1 has only two values. Removing the storage key
  or the feature restores General; no server/file migration is required.

## Test plan

- Unit: strict storage parsing/saving, safe fallback, no-op transitions,
  configured summary labels, and bounded chord timing/reset/suppression.
- Contract: no protocol changes; protocol-10 config observation fixtures cover
  all four presentation states.
- Integration: App transport state supplies accepted config evidence and Retry
  calls get only.
- Browser: mouse, keyboard chord, palette, reload persistence, selected
  terminal/layout/inspector preservation, focus, 320 CSS px, and 200% zoom.
- Failure/recovery: storage exceptions, disconnected/loading/error config,
  Retry, stale response, reload, and General restoration.
- Security: editable/modal/terminal shortcut suppression, untrusted bounded
  labels/errors as text, and no new mutating message.

## Dependencies

- Blocked by: PC-040 server-owned Pacium workspace configuration.
- Blocks: PC-042 through PC-050.

## Evidence required

- Small coherent commits separating issue/plan, state/storage, chord, palette,
  UI presentation, styling/accessibility, browser coverage, and documentation.
- Unit evidence for mode persistence, chord ownership, config presentation, and
  palette action.
- Browser evidence that sessions, selected terminal, layout, inspector, and PTY
  behavior survive mode changes and reload.
- `pnpm verify`, `pnpm test:e2e`, clean worktree, exact-head commit evidence,
  and synchronized docs.

## Open questions

- Multi-workspace mode preference waits for a real workspace router; version 1
  deliberately owns only the current local shell presentation.
