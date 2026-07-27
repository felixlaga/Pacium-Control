# Implementation plan: Pinned Meta and Orchestrator roles

- Issue: [PC-042](pinned-pacium-roles-issue.md)
- Owner: Felix
- Agent/session: Codex `/root`
- Branch: `codex/pinned-pacium-roles`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `b60edabf331ea18d1f56a0759aaf240efc2158a6`
- Target milestone: Milestone 3
- Status: In progress

## Objective

Turn configured Meta and Orchestrator bindings into two useful, honest pinned
role surfaces inside the existing terminal workspace. Reuse the direct-PTY,
session selection, launch catalog, and optimistic configuration paths; add no
parallel runtime, inferred role state, command endpoint, or workflow engine.

## Existing behavior

- Protocol 10 accepts nullable Meta/Orchestrator bindings to an exact live
  session ID or a fixed Shell/Codex/Claude launch preset with an optional
  configured repository.
- A session binding must reference a live Pacium-owned session at replacement
  time. Persisted direct-session references may become unresolved after server
  restart and remain explicit.
- The browser requests and retains accepted config observations, handles
  optimistic complete replacement, and refreshes on reconnect.
- `session.create` accepts only fixed preset ID, canonicalized cwd, bounded
  optional display name, and dimensions. `session.created` returns the exact
  immutable ID and selects the new terminal.
- Selecting an existing session reuses browser-owned tabs/splits and causes the
  existing attach/snapshot path to render it.
- PC-041 shows only configuration counts and keeps role pinning, setup, and
  launching deferred.

## Proposed behavior

1. Project each role into one explicit view state from accepted config,
   connection, current sessions, and launch capabilities.
2. Render Meta then Orchestrator as a compact two-card group in Pacium mode.
3. Open live session bindings through the existing `selectSession` path.
4. Let the operator assign/change one role to an eligible live session or
   fixed launch preset while preserving the rest of the workspace.
5. Let a ready preset binding launch exactly once. Correlate
   `session.created.requestId`, then optimistically replace only that role with
   the returned session ID.
6. Keep partial-failure evidence honest: a created PTY is never hidden or
   killed because its config replacement failed.

## Architecture and boundaries

### Modules touched

- `apps/web/src/pacium-role-model.ts`: pure resolution, availability,
  repository/preset projection, eligible binding options, minimal workspace,
  and one-role replacement.
- `apps/web/src/pacium-role-card.tsx`: semantic pinned-role group/cards.
- `apps/web/src/pacium-role-binding.tsx`: one-role binding dialog.
- `apps/web/src/app.tsx`: role actions, dialog state, launch request
  correlation, exact session-created binding, notices, and existing selection.
- `apps/web/src/transport.ts`: return the existing create request ID to the
  caller; no wire change.
- `apps/web/src/styles.css`: compact role grid, state/action hierarchy,
  narrow/zoom/forced-color/reduced-motion behavior.
- Focused unit, semantic, transport, and Playwright tests.

### Data/state changes

- Entity/schema changes: none. Existing `PaciumBinding` and
  `PaciumWorkspace` remain exact.
- Browser-ephemeral state: active role editor and at most one pending role
  launch `{role, requestId, sourceRevision}`.
- Commands/events: existing `session.create`, `session.created`,
  `pacium.config.replace`, and `pacium.config`.
- Idempotency: config save uses accepted revision; launch action locks while
  pending; no automatic retry.
- Migration: none.

### Protocol changes

- Protocol version remains 10.
- `PaciumTransport.createSession` returns its already-generated request ID so
  the browser can correlate the existing `session.created` response.
- No new fields, message types, capabilities, authority, or server behavior.

### Authorization and privilege

- The browser chooses only existing live session IDs, fixed preset IDs, and
  configured repository IDs.
- The server revalidates complete config references and canonical paths.
- Preset launch uses the existing fixed executable/argv catalog and process
  authority.
- Role UI never sends terminal bytes, file content, shell text, environment,
  signals, queue decisions, or verification commands.

## UI behavior and states

| Input evidence                                 | Card state             | Actions                         |
| ---------------------------------------------- | ---------------------- | ------------------------------- |
| Config not requested                           | Loading definition     | Retry when connected            |
| Config loading without retained observation    | Loading definition     | Wait                            |
| Config unconfigured                            | Setup needed           | Assign                          |
| Config error                                   | Configuration error    | Retry                           |
| Config replacement pending with prior evidence | Saving, prior retained | No duplicate mutation           |
| Connection not connected                       | Disconnected           | Open local view only if present |
| Ready, role null                               | Not assigned           | Assign                          |
| Session binding, live current summary          | Connected              | Open, Change                    |
| Session binding, ended current summary         | Ended                  | Change                          |
| Session binding, no current summary            | Missing                | Change                          |
| Preset binding, available capability           | Ready to launch        | Launch, Change                  |
| Preset binding, unavailable capability         | Preset unavailable     | Change                          |
| Matching launch request pending                | Starting terminal      | Wait                            |
| Created terminal, config replacing             | Binding terminal       | Wait; terminal stays visible    |

Cards pair all color with text and status glyph. Primary work remains the
terminal; role cards use compact density and restrained Pacium accent.

The editor:

- names the single role being edited;
- offers eligible live sessions and fixed launch presets;
- excludes any session bound to the other role or a worker;
- shows unavailable presets but disables selection;
- lets a preset select `Server default` or one already-configured repository;
- creates a minimal workspace only from unconfigured state;
- preserves every non-selected-role field for a ready workspace;
- disables Save while disconnected, replacing, or invalid;
- closes only after an accepted ready response or explicit Cancel;
- restores focus to the invoking role action.

## PTY and process lifecycle

- Open never creates a process. It selects the existing immutable session ID,
  opens/reuses its tab, places it in the focused pane, and attaches through the
  current renderer lifecycle.
- Launch creates one direct PTY with the role label, configured fixed preset,
  configured repository root or server default cwd, and existing default
  dimensions.
- Session creation remains authoritative even if the later binding write
  fails. PC-042 never compensates by terminating that PTY.
- An ended direct-session binding remains Ended; relaunch is not inferred
  because a replacement PTY has a different immutable ID.
- After local-server restart the absent session ID is Missing. No display-name
  or preset matching occurs.

## Reconnect and failure behavior

- Disconnect clears pending config intent through the existing reducer and
  marks role mutations unavailable. It does not close the editor or PTYs.
- If disconnect happens before `session.created`, the launch outcome is
  unknown; a fresh session list and explicit operator inspection are required.
- If `session.created` is received, the new terminal is inserted and selected
  before role replacement. A replacement conflict/error leaves it visible.
- A lost replacement response is resolved by the existing reconnect/get path;
  no blind retry is performed.
- Config error prevents mutation but leaves General and all terminals usable.
- Hostile/bounded server error copy is rendered as text through the existing
  notice/config surfaces.

## Sequence

1. Commit this issue and plan separately.
2. Add the pure role projection and full state-matrix tests.
3. Add immutable binding-edit/minimal-workspace helpers and tests.
4. Add semantic role cards and hostile-text tests.
5. Add the binding dialog, keyboard/focus behavior, and semantic tests.
6. Return create request IDs from the transport and test exact message
   correlation.
7. Wire role cards to existing session selection and config retry.
8. Wire editor save, accepted-response close, and focus restoration.
9. Wire preset launch, exact `session.created` correlation, and one-role
   replacement with partial-failure notices.
10. Add compact responsive/forced-color styling.
11. Add browser setup, launch/open, mode-preservation, failure, and
    accessibility evidence.
12. Synchronize README, status, backlog, issue, plan, and changelog.
13. Run focused gates, `pnpm verify`, `pnpm test:e2e`, inspect exact commits,
    fast-forward into `dev`, and push.

## Failure model

| Failure point                      | Expected state                                       | Recovery                                  |
| ---------------------------------- | ---------------------------------------------------- | ----------------------------------------- |
| No config                          | No file created by read; both roles Setup needed     | Assign one role explicitly                |
| Invalid config                     | Role mutation blocked; terminals unchanged           | Repair externally, then Retry             |
| Disconnected                       | Mutations disabled; current PTY evidence retained    | Reconnect and accept fresh config/list    |
| Preset unavailable                 | No create request; binding remains visible           | Change binding or install/restart         |
| Invalid/removed repository         | Server rejects config or config becomes error        | Refresh and explicitly choose valid input |
| Session create rejected            | No config replacement; current binding unchanged     | Correct local cause and retry explicitly  |
| Disconnect before created reply    | Launch outcome unknown; no replay                    | Inspect fresh session list                |
| Config conflict after PTY create   | New terminal survives; role shows accepted old state | Get fresh config, bind explicitly         |
| Config response lost after replace | Pending cleared on reconnect; evidence reread        | Trust fresh get, never blind retry        |
| Bound process exits                | Role becomes Ended from session summary              | Change to another session/preset          |
| Server restarts                    | Direct session ID becomes Missing                    | Explicitly change/relaunch                |
| Browser refresh                    | PTYs survive; config/list re-resolve role cards      | No input replay                           |

## Compatibility

- Supported versions: existing protocol 10, schema 1, direct PTY runtime, fixed
  Shell/Codex/Claude capability catalog.
- Fallback behavior: General mode and ordinary terminal groups remain
  unchanged; Pacium config loading/error disables role mutation only.
- Rollback: remove role UI/correlation helpers. Existing configuration and
  sessions require no migration or cleanup.

## Test plan

- Unit: all role states; immutable exact-ID resolution; ended vs missing;
  capability availability; configured/default cwd; eligible sessions; duplicate
  slot exclusion; minimal workspace; one-role replacement; no source mutation.
- Property/fault: arbitrary session order, hostile labels/paths, duplicate
  candidates, unavailable capabilities, large allowed lists, stale revisions,
  and request-ID mismatch.
- Contract: protocol-10 schemas and forbidden authority-field tests remain
  unchanged.
- Integration: create request ID -> exact created session -> exact role config
  replacement; nonmatching create; conflict; disconnect; session exit.
- Browser: unconfigured assignment, preset setup, launch/bind/open, role order,
  General absence, refresh, selected pane/inspector preservation, modal focus,
  320 CSS px, 200% zoom, forced colors, reduced motion.
- Security: no arbitrary commands/cwd; fixed option values; untrusted text;
  authenticated existing messages only; no content reads.
- Performance: two memoized role projections, bounded lists, no polling,
  watcher, terminal remount, output parsing, or new persistence.

## Documentation changes

- Update README current-slice and Pacium-mode behavior.
- Mark PC-042 complete and PC-043 next in status/backlog/issue/plan.
- Add changelog evidence and limitations.
- Do not describe prompt targeting, workers, queue, provider, tmux, or remote
  access as implemented.

## Rollout

- Development: exercise unconfigured state with one Shell preset, then ready
  live-session and preset fixtures.
- Integration: run unit, semantic, transport, config, PTY, and browser suites.
- Canary: localhost development only; use disposable state and real direct PTY.
- Production: none; project remains pre-release.

## Open questions

- PC-043 owns the visible prompt target and must use accepted resolved role
  evidence without storing terminal identity twice.
- PC-050 decides whether worker launch follows this explicit binding pattern.
- Optional tmux requires a future capability-labelled binding shape.

## Approval

- Product: makes Meta and Orchestrator immediately visible and actionable
  without displacing the terminal or inventing a second shell.
- Architecture: configuration intent, PTY truth, capabilities, and browser view
  state retain separate owners.
- Security: all mutation uses existing strict authenticated fixed operations;
  no new command or content authority is added.
