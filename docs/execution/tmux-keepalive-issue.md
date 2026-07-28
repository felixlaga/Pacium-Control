# PC-071: tmux keep-alive launches and restart reattachment

## Problem

PC-070 can explicitly attach an existing tmux session, but every new
Shell/Codex/Claude launch still uses a direct PTY and therefore ends with the
local server. A retained tmux attachment manifest can be relaunched manually,
but Pacium cannot yet create a deliberately durable preset or restore only
those opted-in clients after its server restarts.

## Outcome

When one safe local tmux socket is configured and ready, the operator may opt a
new fixed launch preset into keep-alive. Pacium creates one uniquely named tmux
session with the server-owned preset command, attaches a Pacium-owned client
PTY, records an explicit automatic-reattach policy, and restores at most one
client per retained keep-alive target on the next local-server start. Direct
PTY remains the default.

## Scope

- Add an explicit keep-alive choice to the existing new-terminal flow only
  when tmux capability is ready.
- Add one strict boolean create-session field; the browser still cannot send
  executable, argv, socket, tmux name, environment, or restart policy text.
- Launch the already selected fixed Shell/Codex/Claude preset as multiple tmux
  `new-session` command arguments, which tmux executes directly without
  `sh -c`.
- Generate a collision-resistant server-owned tmux session name and publish the
  exact resulting target.
- Distinguish external/manual attachment from Pacium keep-alive ownership in
  session and manifest evidence.
- Persist keep-alive target and underlying preset command evidence before the
  client PTY is considered successfully attached.
- On startup, deduplicate retained keep-alive targets, revalidate each exact
  target, and attach one fresh Pacium client/session identity.
- Keep direct manifests manual and keep external PC-070 attachments manual.
- Label initial, restored, failed, ended, and disconnected behavior honestly.

## Non-scope

- Making tmux the default or starting tmux during discovery.
- Automatically adopting external tmux sessions.
- Multiple sockets, browser-supplied session names, tmux window/pane mutation,
  or a generic command endpoint.
- Restarting a missing/dead tmux target or automatically rerunning its command.
- Restoring terminal scrollback that tmux no longer exposes on attachment.
- Claiming provider-native observation remains connected across server restart.
- Packaging, soak tests, diagnostics, or release readiness.

## Acceptance criteria

- [ ] Direct PTY launch remains the default and works without tmux installed or
      configured.
- [ ] Keep-alive is selectable only from a ready server capability and sends
      only a boolean alongside the existing fixed launch input.
- [ ] The server generates the tmux name and launches only one available
      fixed preset through direct multiple `new-session` arguments without a
      shell or browser command authority.
- [ ] Launch has bounded timeout/output, strict target parsing, canonical cwd,
      safe socket location, collision failure, and no automatic retry after an
      unknown browser outcome.
- [ ] A keep-alive launch creates one tmux session, one Pacium client PTY, one
      immutable local session ID, and one durable manifest that records
      automatic reattachment distinctly from an external attachment.
- [ ] Shell, Codex, and Claude retain honest preset classification; native
      provider observation is explicitly unavailable for the tmux runtime
      rather than silently inferred or falsely reconnected.
- [ ] Browser refresh/view close preserves the client; deliberate client close
      and local-server shutdown leave the tmux target alive.
- [ ] Local-server restart automatically reattaches each newest unique
      keep-alive target once with a fresh Pacium session ID and predecessor
      lineage.
- [ ] Direct manifests, external attachment manifests, missing targets, and
      duplicate/stale lineage are never automatically launched or retried.
- [ ] A target that exits or disappears remains a retained failed recovery
      option; Pacium does not rerun its underlying command automatically.
- [ ] Focused, integration, real-tmux, restart, security, full verification,
      and browser tests pass.

## User experience

The normal dialog keeps the fixed preset and working-directory controls. When
tmux is ready it adds one unchecked `Keep alive with tmux` option with concise
copy: the session may survive the local server, while direct mode remains
lighter and default.

A keep-alive session row and inspector say `tmux keep-alive`. After server
restart the restored client appears as a fresh linked Pacium session without a
browser confirmation because the earlier manifest recorded that exact policy.
If the target is gone, Recovery explains that Pacium did not rerun the command.

## Architecture

- Systems and modules touched: contracts, tmux adapter, session manager,
  startup, WebSocket create path, transport, create dialog, session actions,
  manifests, tests.
- Systems of record: tmux owns the durable command/session; the Pacium PTY owns
  one client attachment; manifests own the explicit restart policy and lineage.
- State transitions: direct create unchanged; keep-alive requested -> tmux
  target created -> manifest durable -> client attached -> live; startup
  retained target -> exact revalidation -> fresh client or retained failure.
- Protocol/schema impact: protocol 24; optional create `keepAlive`; explicit
  tmux attachment mode/policy evidence.
- Relevant ADRs: ADR-0013, ADR-0014, ADR-0015.

## Security and privacy

- Existing Origin/token/Tailscale checks protect the create request.
- Preset, executable, argv, cwd validation, socket, generated name, timeout,
  format, dimensions, and restart policy are server-owned or strictly typed.
- tmux multiple-command arguments execute directly; no constructed `sh -c`
  string, queue content, terminal text, or browser label becomes a command.
- Provider secrets, environments, terminal bytes, and tmux history are not
  persisted in the manifest.

## Reliability

- Discovery never starts a server; only an explicit keep-alive create may.
- The target is created detached before the client and the manifest becomes
  durable before attachment success is claimed.
- Startup restoration is bounded, sequential, deduplicated by exact target,
  and never retries a missing target or command.
- A client-attach failure leaves the tmux target plus durable Recovery evidence
  rather than killing an otherwise durable command.
- Server shutdown detaches clients with the existing SIGHUP path.

## Test plan

- Unit: protocol/schema relationships, generated name, direct argv, output
  parser, timeout/collision/error recovery, deduplication, and policy labels.
- Integration: keep-alive create, fixed preset authority, manifest-before-client
  behavior, input/resize/exit, startup restore, missing target, direct/manual
  exclusion, and predecessor lineage.
- Real tmux: isolated socket launches a direct argv command and survives client
  plus local-server lifecycle boundaries.
- Browser: unchecked default, explicit opt-in, label, terminal input, refresh,
  server restart, fresh identity, close consequence, and missing-target copy.
- Security: forged command/name/socket/policy fields rejected; special preset
  arguments do not invoke a shell.

## Dependencies

- Blocked by: PC-070, relaunch manifests, direct PTY lifecycle.
- Blocks: PC-072 through PC-076.

## Evidence required

- Local tmux manual/direct-argv contract plus captured fixed launch argv.
- Real isolated tmux launch and restart-reattach canary.
- Full verification/build sizes and complete Chromium workflow count.
- Current status and limitations synchronized before merge.

## Open questions

- None. Automatic restoration applies only to explicitly launched keep-alive
  targets; all other manifests stay manual.
