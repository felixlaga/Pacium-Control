# Implementation plan: Optional tmux discovery and attachment

- Issue: PC-070
- Owner: Pacium Control
- Agent/session: Codex
- Branch: `codex/tmux-discovery-attach`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `673470fb0182fc5e6736658ffccb8a2ff6394950`
- Target milestone: Milestone 5 — Durability, packaging, and polish
- Status: In progress

## Objective

Add one explicitly configured, bounded local tmux discovery and attachment path
without changing the direct-PTY default, accepting browser-selected socket
authority, or claiming keep-alive/restart recovery before PC-071.

## Existing behavior

Protocol 22 reports `tmux: false`; `SessionSummary.runtime` and relaunch
manifests are direct-PTY-only. All terminal rendering, ordered input, resize,
bounded headless snapshots, refresh reconnect, tabs, splits, and process
lifecycle already operate over a Pacium-owned PTY child. The accepted
architecture permits tmux only as a capability-labelled optional adapter.

## Proposed behavior

`PACIUM_TMUX_SOCKET` optionally names one exact existing local Unix socket.
Startup detects an executable/version but never starts a tmux server. A
dedicated adapter runs fixed no-shell bounded `list-sessions` and
`attach-session` operations. The browser lists published identities and sends
only one exact server/target ID plus dimensions. The adapter re-lists and
matches the target before the session manager spawns the tmux client in its
existing PTY pipeline.

Attached sessions use `runtime: tmux`, carry exact target evidence, show tmux
labels and survival-aware termination copy, and retain an attachment manifest.
PC-070 remains explicit/manual after local-server restart; PC-071 will add
launch-under-tmux and automatic keep-alive reconnection.

## Architecture and boundaries

### Modules touched

- contracts: tmux observation/target schemas and protocol 23.
- config/tmux adapter: one fixed socket, detection, discovery, parsing, timeout.
- session manager: attach child and runtime/target lineage.
- WebSocket/transport: list and exact attach request.
- browser: optional attach dialog, recovery labels, runtime consequences.

### Data/state changes

- Extend session and manifest runtime from `pty` to `pty | tmux`.
- Add a nullable strict tmux target to tmux sessions/manifests only.
- No new state file; attachment manifests use the existing bounded catalog.

### Protocol changes

- Protocol 23 welcome carries explicit tmux configured/available/version state.
- Add `tmux.sessions.list` and `tmux.session.attach`.
- Add bounded list/error responses; reject unknown socket/name/command fields.

### Authorization and privilege

- Existing authenticated WebSocket boundary applies.
- The adapter owns executable, socket, format, timeout, output limit, and attach
  argv. Browser input is exact published opaque IDs and dimensions only.

## Sequence

1. Define strict tmux contracts/runtime relationships and protocol tests.
2. Parse optional socket config and detect capability safely.
3. Implement bounded no-shell discovery parser/adapter and real fixtures.
4. Add exact revalidation plus PTY-backed attachment in the manager.
5. Add list/attach WebSocket integration.
6. Add optional attach dialog and tmux-aware labels/consequences.
7. Run focused, real-tmux, full verify, and Chromium gates; sync docs.

## Failure model

| Failure point                      | Expected state                            | Recovery                            |
| ---------------------------------- | ----------------------------------------- | ----------------------------------- |
| No socket configured               | tmux unconfigured; direct PTYs unchanged  | Configure and restart               |
| Executable/socket missing          | unavailable with bounded reason           | Install/restore, restart or Refresh |
| Discovery timeout/malformed output | no targets published                      | Retry explicitly                    |
| Target disappears before attach    | no PTY/session created                    | Refresh and choose current target   |
| Client spawn/exit                  | attachment failed/ended; tmux may survive | Re-list and attach explicitly       |
| Browser disconnect after request   | no retry or duplicate attach              | Reconnect and inspect session list  |
| Local-server restart               | tmux may survive; no auto-attach claim    | PC-070 explicit re-list/attach      |

## Compatibility

- Direct PTY path remains available with no tmux installation or config.
- Initial supported canary: tmux 3.7b on macOS; parser uses documented format
  fields rather than localized human output.
- Rollback ignores tmux config/manifests and leaves external sessions untouched.

## Test plan

- Unit: config, capability, parser, bounds, controls, duplicates, target match.
- Contract: protocol 23 strict list/attach/runtime relationships.
- Integration: fixed argv, revalidation, PTY I/O/resize/exit, missing target.
- Real tmux: isolated temporary socket with one named session.
- Browser: explicit action/list/select/attach, tmux labels, Escape/focus,
  refresh, close-view, and terminate-client copy.
- Security: forged socket/name/argv rejected; no shell or server creation.

## Documentation changes

- Backlog, STATUS, README, changelog, milestone evidence, and operator
  configuration.

## Rollout

- Development: fake adapter and parser tests.
- Integration: isolated real-tmux socket canary.
- Browser: full Chromium suite.
- Production: no release claim; PC-071 through PC-076 remain.

## Open questions

- None.

## Approval

- Product: authorized by the owner's instruction to continue the remaining
  roadmap.
- Architecture: optional capability under ADR-0013.
- Security: one configured server/socket; list and attach only.
