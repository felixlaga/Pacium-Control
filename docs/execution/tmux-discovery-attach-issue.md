# PC-070: Optional tmux discovery and attachment

## Problem

Pacium accurately owns direct PTYs but cannot discover or explicitly attach to
an existing shared tmux session. Operators who already use tmux therefore
cannot bring that durable terminal into the same clean workspace, and the
server currently reports tmux as unsupported even when one deliberately
configured local server is available.

## Outcome

An operator may configure one exact local tmux socket. Pacium detects the local
tmux executable and socket capability, lists bounded validated sessions, and
attaches one exact selected session through a Pacium-owned PTY. Direct terminals
remain the default, attached sessions are always labelled tmux-backed, and no
socket, session name, or arbitrary command comes from browser authority.

## Scope

- Add optional startup configuration for one absolute local tmux socket.
- Detect tmux executable/version and socket availability without starting a
  server.
- List bounded exact sessions from fixed no-shell argv and strict output.
- Add strict capability/list/attach protocol contracts.
- Revalidate the exact session identity immediately before attachment.
- Run `tmux attach-session` inside a Pacium-owned PTY and reuse bounded terminal
  input, resize, snapshots, exit, tabs, splits, and focus.
- Label tmux runtime, server, target, attachment state, and failure honestly.
- Retain a secret-free attachment manifest for explicit later reattachment.

## Non-scope

- Launching new commands or provider presets under tmux (PC-071).
- Automatic attachment or restart recovery.
- Multiple or browser-selected socket paths.
- tmux window/pane creation, rename, kill, signals, or control mode.
- Adopting Terminal.app, iTerm, or arbitrary shell processes.
- Treating tmux output as provider truth.

## Acceptance criteria

- [ ] With no configured socket, direct PTYs work unchanged and tmux is
      explicitly unconfigured.
- [ ] Configuration accepts only one bounded absolute canonical Unix socket
      outside repositories and never starts a tmux server during discovery.
- [ ] Discovery uses one detected executable and fixed `-S`, `list-sessions`,
      and format arguments with timeout/output bounds.
- [ ] Malformed, duplicate, control-bearing, oversized, missing, or changing
      discovery evidence fails visibly and yields no attach target.
- [ ] Browser attach supplies only the published server/target identity and
      dimensions; the server revalidates both before spawn.
- [ ] Attachment uses fixed `tmux -S <configured> attach-session -t <exact-id>`
      argv without a shell.
- [ ] Attached sessions are labelled `tmux`, remain distinct from direct PTYs,
      and use existing ordered input/resize/snapshot/focus behavior.
- [ ] Browser close/refresh does not kill the tmux session; local-server shutdown
      ends only its tmux client attachment.
- [ ] Missing target, socket loss, tmux client exit, and reconnect uncertainty
      explain whether the tmux server session may still survive.
- [ ] Focused, integration, real-tmux, security, full verification, and browser
      tests pass.

## User experience

The New terminal flow retains Shell/Codex/Claude as its primary path and adds a
small `Attach tmux` action only when configured. The dialog loads one bounded
server-owned list, shows exact name/ID, window count, attached-client count,
current path, and observation time, and requires an explicit selection. Empty,
loading, unavailable, stale, and retry states explain that direct terminals
remain usable.

After attach, session rows, pane headers, inspector evidence, and status copy
say `tmux`. Closing the browser view leaves both the Pacium attachment and tmux
session alive; terminating the Pacium attachment closes only the tmux client
and never sends `kill-session`.

## Architecture

- Systems and modules touched: config, tmux adapter, contracts, session manager,
  WebSocket hub, transport, attach dialog, runtime labels, manifests, tests.
- Systems of record: tmux owns server/session survival and terminal contents;
  the Pacium PTY owns only the current client attachment; manifests own bounded
  attachment metadata.
- State transitions: unconfigured/unavailable/ready discovery; selected target
  -> exact revalidation -> attaching client -> live/ended attachment.
- Protocol/schema impact: protocol 23, tmux capability/list/attach messages,
  runtime/target evidence.
- Relevant ADRs: ADR-0013, ADR-0014, ADR-0015, ADR-0016.

## Security and privacy

- Existing Origin/token/Tailscale identity checks protect discovery and attach.
- The browser never supplies a socket, executable, name, command, or argv.
- Socket access is treated as privileged local control and limited to the exact
  configured path plus read/list and attach operations.
- Terminal bytes, environments, socket contents, and complete tmux history are
  neither logged nor persisted.

## Reliability

- Discovery does not retry or create a server; Refresh is explicit.
- Attach requests are not automatically retried after disconnect.
- A failed revalidation or spawn creates no Pacium session.
- A tmux client exit ends the attachment but does not claim the tmux server
  session ended.
- PC-071 owns automatic rediscovery/reattachment after local-server restart.

## Test plan

- Unit: config/path/version/output parser, bounds, duplicate/control rejection.
- Contract: strict capability/list/attach and runtime/target schemas.
- Integration: list, revalidate, attach, input, resize, client exit, missing
  target/socket, and no-shell argv.
- Real tmux: isolated temporary socket/session discovery and attachment canary.
- Browser: loading/empty/error/retry, explicit selection, runtime label, focus,
  refresh, view close, and attachment termination consequence.
- Security: forged socket/name/argv fields rejected; discovery never starts a
  server or contacts a remote.

## Dependencies

- Blocked by: PC-065, direct PTY lifecycle, terminal snapshots, and loopback
  transport.
- Blocks: PC-071 through PC-076.

## Evidence required

- Exact fixed argv and real isolated tmux canary output.
- Full verification/build sizes and complete Chromium workflow count.
- Current status and limitations synchronized before merge.

## Open questions

- None. One configured socket and session-level attachment are the accepted
  first capability.
