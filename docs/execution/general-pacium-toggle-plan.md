# Implementation plan: Functional General/Pacium workspace mode

- Issue: [PC-041](general-pacium-toggle-issue.md)
- Owner: Felix
- Agent/session: Codex `/root`
- Branch: `codex/general-pacium-toggle`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `b0090b5f3eeac91acc84bf6fe827212a7bac2b1e`
- Target milestone: Milestone 3
- Status: In progress

## Objective

Turn the disabled Pacium teaser into a real, calm presentation mode within the
existing terminal shell. Make every entry path share one browser-owned state
transition, preserve terminal/session/layout/inspector truth, and show only
honest protocol-10 configuration evidence while leaving PC-042 through PC-050
unimplemented.

## Existing behavior

The sidebar footer contains a disabled `.pacium-toggle` with a “Soon” label.
There is no workspace-mode state, persistence, keyboard action, palette action,
mode-specific shell class, config summary, retry control, or browser coverage.

The browser already owns versioned settings, tabs, splits, panel visibility,
attention cursors, and disposable inspector request state. Protocol-10 startup
performs a config get and reconciles only matching responses into
idle/loading/loaded/replacing state. The terminal canvas, selected session,
tabs, split layout, inspector tab, panels, Git/check observations, and PTY
processes are independent of that state.

The command palette uses a pure catalog and typed action union. Global
shortcuts use a pure one-key resolver and refuse application commands while a
terminal, editable control, or modal owns input. There is no sequence resolver
yet.

## Proposed behavior

### Presentation state

Add a browser-only version-1 value:

```json
{
  "version": 1,
  "mode": "general"
}
```

The fixed local-storage key is `pacium.workspaceMode`. Parsing is exact;
missing, malformed, unknown-version, extra-field, or unknown-mode values return
General. Saving catches storage exceptions. The server-owned workspace
definition remains separate and is never modified by a mode change.

One `setWorkspaceMode(next, source)` action updates in-memory state, attempts
storage, and announces the result. Selecting the active mode is a no-op.
Storage failure retains the page-lifetime mode and warns that refresh may
return to General.

### Control and shell

Replace the disabled teaser with a labelled segmented group:

```text
Workspace mode
[ General ] [ Pacium ]
```

Use two real buttons with `aria-pressed`, a group label, visible focus, a stable
hit target, and restrained selected treatment. The shell receives
`data-workspace-mode` or an equivalent explicit class; no terminal component is
remounted or keyed by mode.

General mode renders the current session navigation unchanged. Pacium mode
changes the section heading to “Pacium sessions,” adds one compact definition
status card above the same repository/session groups, and applies one subdued
accent to the shell. It does not reorder, hide, relabel, infer, or launch
sessions.

The status card maps visible accepted config evidence:

| Browser config state                  | Presentation                                              |
| ------------------------------------- | --------------------------------------------------------- |
| idle/loading with no prior evidence   | Loading definition; terminals available                   |
| loading/replacing with prior evidence | Retained evidence plus refreshing label                   |
| loaded unconfigured                   | Setup not configured; PC-042 will add role setup          |
| loaded ready                          | Workspace label and configured-only counts                |
| loaded error                          | Bounded error, terminal-survival text, Retry              |
| disconnected                          | Retained evidence if any plus disconnected freshness text |

Ready counts distinguish configured Meta and Orchestrator bindings, workers,
repositories, and queue sources. They do not call session bindings live,
workers active, or queues observed. Labels and server error strings render as
React text.

### Input paths

- Pointer/Tab/Enter/Space on the segmented buttons calls the shared action.
- Command palette adds one current-mode-aware “Switch to Pacium mode” or
  “Switch to General mode” action with `G P`.
- Shortcut reference documents `G P`.
- A pure bounded sequence reducer arms on unmodified `G`, toggles on unmodified
  `P` within 1,200 ms, resets on another key/expiry, and never arms while a
  terminal, editable target, or dialog owns input.

The chord is handled before the existing one-key resolver but uses the same
ownership inputs. The first `G` is consumed only when the application owns the
keyboard. It produces no UI state until `P`.

### Preservation

Mode is not an input to:

- session reconciliation or selection;
- tab or split layout state;
- terminal surface keys, refs, sync epochs, input, resize, or capture;
- inspector tab or its Git/history/check/activity request maps;
- sidebar/inspector visibility;
- PTY, WebSocket subscription, Git, verification, or config replacement.

No effect resets focus. A keyboard chord leaves the currently focused element
unchanged. Pointer activation naturally leaves focus on the selected segmented
button. Reload restoration follows the existing browser/session/layout
mechanisms and config reconnect get independently.

## Architecture and boundaries

### Modules touched

- New `workspace-mode.ts`: strict storage and transition helpers.
- New `workspace-mode-shortcut.ts`: bounded two-key reducer.
- New `pacium-mode-summary.tsx` plus pure summary model if needed.
- `command-palette-model.ts`: typed toggle action, current mode input, shortcut
  reference, search terms, and tests.
- `app.tsx`: state/ref/action wiring, config presentation, retry read, shell
  mode attribute, and shared dispatch.
- `styles.css`: segmented control, definition card, mode accent, responsive,
  forced-color, and reduced-motion treatment.
- Semantic/unit/E2E fixtures and synchronized docs.

### Data/state changes

- Entity/schema changes: one browser-local version-1 presentation preference;
  no server schema or durable server file change.
- Commands/events: local mode transition and read-only config Retry; no domain
  event or WebSocket mutation.
- Idempotency: selecting the current mode is a no-op; Retry is a get.
- Migration: invalid/old local values fail to General; no server migration.

### Protocol changes

- None. Protocol 10 config observation and get are reused.
- No mode field is sent to the server.
- No queue, context, prompt, answer, process, Git, or verification message is
  added.

### Authorization and privilege

- Presentation change is local browser state without operating-system
  authority.
- Retry uses existing exact Origin, ephemeral token, strict get request, and
  bounded response.
- Config labels/errors and stored values are untrusted and never interpreted as
  HTML, selectors, paths to open, or commands.

## Sequence

1. Commit the PC-041 issue and this plan separately.
2. Add strict workspace-mode storage/load/save helpers and unit tests.
3. Add bounded keyboard chord state and ownership/timing tests.
4. Add typed palette action, current-mode catalog labels, shortcut reference,
   search tests, and dispatch.
5. Wire one shared mode transition into app state without presentation changes.
6. Replace the disabled footer teaser with the accessible segmented control.
7. Add pure config-to-summary projection for loading/unconfigured/ready/error
   and configured-only counts.
8. Render the compact Pacium definition card and read-only Retry.
9. Add explicit shell mode styling, responsive/zoom/forced-color behavior, and
   motion restraint.
10. Add semantic tests for control/group/status copy and hostile text.
11. Add browser coverage for pointer, chord, palette, refresh persistence,
    General restoration, focus, selection, layout, inspector, and narrow width.
12. Synchronize README, status, backlog, issue, plan, and changelog.
13. Run focused gates, `pnpm verify`, and `pnpm test:e2e`.
14. Fast-forward the small coherent commit series into `dev` and push.

## Failure model

| Failure point                 | Expected state                                    | Recovery                            |
| ----------------------------- | ------------------------------------------------- | ----------------------------------- |
| Missing/invalid stored mode   | General, no warning                               | Select Pacium explicitly            |
| Storage read throws           | General, app remains usable                       | Fix browser storage and retry       |
| Storage write throws          | In-memory mode changes; warning                   | Retry control or refresh to General |
| First chord key only          | No mode change; expires                           | Press `G P` again                   |
| Wrong/late second key         | Sequence resets; no mode change                   | Press `G P` again                   |
| Terminal/input/modal owns key | No arm, preventDefault, or mode change            | Leave capture/input/modal first     |
| Config loading                | Pacium mode opens with loading truth              | Wait for matching response          |
| Config unconfigured           | Setup-needed state; terminals unchanged           | PC-042 setup flow later             |
| Config error                  | Bounded error and Retry                           | Retry get or repair server file     |
| Retry disconnects             | Prior evidence retained; no success claimed       | Reconnect performs get              |
| Browser refresh               | Valid mode/layout/selection restore independently | Invalid mode falls to General       |
| Local-server restart          | Mode survives browser; config rereads             | Missing direct bindings shown later |

## Compatibility

- Supported versions: current browser with protocol 10 server; workspace-mode
  storage version 1.
- Fallback behavior: General remains safe for missing/invalid local state or
  absent/invalid Pacium config.
- Rollback: remove mode UI/state and storage key; terminal/server state requires
  no migration or cleanup.

## Test plan

- Unit: exact storage format, invalid/extra/old values, storage exceptions,
  no-op transitions, chord arm/complete/reset/expiry, ownership suppression,
  ready configured counts, retained loading evidence, and error copy.
- Property/fault: arbitrary stored JSON, rapid/repeated keys, clock boundary,
  hostile labels/errors, large allowed counts, and unavailable storage.
- Contract: existing protocol-10 fixtures for unconfigured/ready/error; prove no
  protocol diff.
- Integration: app consumes transport request/response state and Retry calls get
  only.
- Browser: segmented pointer and keyboard, `G P`, palette action, refresh,
  General return, unchanged selected terminal, tabs/splits, inspector tab,
  terminal input, focus, 320 CSS px, 200% zoom, forced colors, reduced motion.
- Security: keys suppressed in terminals/editables/modals; untrusted evidence
  is text; no new mutation/content/authority fields.
- Performance: no polling, watcher, server write, terminal remount, or config
  duplication; only a small conditional card and CSS state change.

## Documentation changes

- Update README current-slice/Pacium-mode behavior and shortcut list.
- Mark PC-041 complete and PC-042 next in status/backlog/issue/plan.
- Add changelog evidence and limitations.
- Do not describe role pinning, queue observation, setup editing, prompt
  targeting, or content reads as implemented.

## Rollout

- Development: use unconfigured server state first, then unit/semantic ready and
  error fixtures.
- Integration: full unit, semantic, transport, and browser regression suites.
- Canary: localhost development only; no real queue/config write.
- Production: none; project remains pre-release.

## Open questions

- PC-042 decides the role setup/editing surface and how ready bindings become
  pinned/missing/launchable rows.
- A future real workspace router decides whether mode preference becomes
  per-workspace rather than one current-shell browser preference.

## Approval

- Product: makes the existing shell mode real while keeping the terminal
  primary and explicitly deferring role/queue behavior.
- Architecture: browser presentation state remains separate from server
  configuration and all existing systems of record.
- Security: adds no authority; shortcut ownership and config evidence remain
  bounded, typed, and text-only.
