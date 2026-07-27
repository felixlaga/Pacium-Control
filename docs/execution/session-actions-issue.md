# PC-024: Consistent session actions

## Problem

Pacium can create, interrupt, and terminate PTYs, but controls are scattered and several routine management actions are missing. Operators cannot rename a session, duplicate its launch context, relaunch an ended process, copy its directory, or reveal its repository through one predictable interface.

## Outcome

Every session exposes one compact, consequence-aware action menu from the workspace. Metadata-only actions remain clearly separate from process actions. Relaunch and duplicate use the existing typed launch preset and canonical working directory; reveal uses a fixed host operation rather than arbitrary shell input.

## Scope

- Add server-owned session rename with bounded validation.
- Add a typed reveal-repository operation using only the canonical detected repository root.
- Add a compact action menu for the selected session.
- Open the same menu from pane headers and session-row context menus.
- Rename through a focused dialog that retains the current name on failure.
- Duplicate a session from its preset, cwd, dimensions, and a distinct display name.
- Relaunch an ended session as a clearly announced successor using its retained launch context.
- Copy the working directory through the browser clipboard API with honest failure feedback.
- Keep Interrupt separate from Close/Terminate.
- Close the browser view without terminating the PTY.
- Confirm process termination with the exact session and consequence.

## Non-scope

- Durable relaunch manifests across local-server restart.
- Custom environment replay.
- Provider resume identifiers.
- Arbitrary host shell commands.
- Git mutations.
- Native OS actions beyond revealing a server-detected repository.
- Recently closed history.

## Acceptance criteria

- [ ] Rename updates the authoritative in-memory session summary and every browser surface.
- [ ] Names are trimmed, bounded, and malformed rename commands fail deterministically.
- [ ] Duplicate starts a new PTY from the same preset, cwd, and dimensions without affecting the source.
- [ ] Relaunch is offered only for ended/failed sessions and starts a visibly announced successor.
- [ ] Copy directory reports success or explains that the path remains available in the UI.
- [ ] Reveal repository can target only the canonical repository associated with the session.
- [ ] Reveal uses a fixed platform executable and argument list, never a parsed shell string.
- [ ] Interrupt states that it sends `SIGINT` and does not imply termination.
- [ ] Closing a view and terminating a process remain distinct labelled actions.
- [ ] The action menu is reachable from visible controls, context menu, and keyboard focus.
- [ ] Server protocol, session manager, and pure availability logic have deterministic tests.
- [ ] The full repository verification gate passes.

## Failure and security behavior

- A missing or ended rename target returns a typed error without changing another session.
- Reveal fails with a typed unsupported/no-repository/host-action error.
- Duplicate or relaunch spawn failure leaves the source session untouched.
- Clipboard denial leaves the canonical path visible and reports a recoverable error.
- Remote operation reveals on the Pacium host and labels that consequence.
- No action accepts an arbitrary executable, shell string, or browser-supplied reveal path.

## Test plan

- Unit: action availability, duplicate display name, rename validation, reveal target selection.
- Contract: rename and reveal message validation and protocol version.
- Session manager: rename update event and reveal callback target.
- Integration: WebSocket rename and reveal results/errors.
- Browser/component: menu labels, enabled/disabled states, rename dialog, context entry points.
- Security: hostile path cannot enter reveal command; no queue or terminal text is executed.

## Dependencies

- Blocked by: PTY lifecycle, presets, repository discovery, tabs, and split panes.
- Blocks: command palette and Pacium role session actions.

## Evidence required

- Contract and session-manager results.
- Component/action-model results.
- Full `pnpm verify`.
- Rendered workflow when a browser backend is available.
