# PC-079: Make remote Pacium open directly into Meta

> PC-080 replaces this slice's command-oriented initial configuration with a
> local button-driven Host setup flow. Environment values remain an override.

## Problem

The current Pacium presentation asks the operator to choose a prompt target even
though the real workflow always talks through the Meta terminal. It also places
large role cards, explanatory copy, worker evidence, queue evidence, and a
second prompt composer around the terminal. The result is visually noisy and
duplicates the terminal input surface.

Remote use is also split across two manual operations: connect to
`felix-harness` over Tailscale SSH, then run `tmux attach -t meta`. Pacium
already has a safer same-host design: Tailscale Serve terminates the remote
browser connection while the loopback Pacium process attaches a configured
local tmux target. That path is not yet automatic for one existing Meta
session.

## Outcome

An operator can configure one exact local tmux session as Meta. Pacium attaches
that session during startup, publishes its immutable Pacium session identity,
and a newly opened browser selects and focuses it in a terminal-dominant view.
Opening the configured Tailscale Serve URL is the only routine browser action.

Pacium no longer renders the separate prompt-target composer. Communication
with Meta happens in the focused terminal. Pacium navigation remains available
on demand, but its cards and evidence rows use compact list presentation and
substantially less copy.

## Scope

- Add one optional server-owned `PACIUM_META_TMUX_SESSION` startup value.
- Require the existing exact `PACIUM_TMUX_SOCKET` when the Meta target is
  configured.
- Discover and match one exact tmux session name, attach by the published tmux
  session ID, and create no command from browser input.
- Report strict `unconfigured | ready | unavailable` Meta-session capability
  evidence in the authenticated welcome message.
- Select, open, and focus the exact ready Meta session once on browser startup.
- Enter Pacium presentation and collapse secondary panels for that focused
  startup without terminating or hiding other sessions.
- Remove the Pacium prompt-target composer and its ephemeral send state.
- Replace tall role cards and verbose Pacium summary/worker/queue presentation
  with compact rows and concise operational copy.
- Document the complete Tailscale Serve plus tmux startup configuration.

## Non-scope

- Running SSH from the browser, exposing a generic remote shell command, or
  accepting a host, user, socket, tmux name, command, or arguments from the
  browser.
- Tailscale SSH check-mode emulation, Tailscale daemon login, OAuth, device
  enrollment, Serve configuration, or grant mutation from Pacium.
- Cross-host control. Pacium, tmux, repositories, and queue files remain on the
  same host.
- Automatically starting or recreating a missing `meta` tmux session.
- Automatically rebinding `pacium.json`, delivering queue answers, or treating
  terminal input as an approval.
- Removing General mode, other terminals, inspectors, queue decisions, role
  configuration, or command-palette access.

## Acceptance criteria

- [x] Remote mode remains Tailscale Serve-only and Pacium remains bound to
      `127.0.0.1`.
- [x] `PACIUM_META_TMUX_SESSION` accepts one non-empty bounded control-free
      exact name only when `PACIUM_TMUX_SOCKET` is configured; invalid or
      partial configuration fails startup closed.
- [x] Startup discovers through the existing fixed no-shell tmux adapter,
      matches the exact configured name, revalidates the published ID, and
      attaches at most one Pacium client.
- [x] A missing socket, missing target, discovery failure, or attach failure
      leaves Pacium running with concise unavailable evidence and never starts
      tmux, creates a replacement session, or retries a command.
- [x] Protocol 25 exposes only Meta capability state, an immutable Pacium
      session ID when ready, and bounded recovery copy. It exposes no socket,
      executable, arguments, Host, token, or terminal content.
- [x] On a fresh page load, a ready Meta session becomes the selected open
      terminal, Pacium presentation is active, secondary panels are collapsed,
      and terminal input receives focus.
- [x] Later operator selection and panel actions remain deliberate and are not
      continuously overridden.
- [x] Browser refresh creates no second tmux client; it reuses the existing
      Pacium session and restores bounded terminal state.
- [x] The separate prompt target/select/send surface is absent. The terminal is
      the only ordinary Meta input surface.
- [x] Role, workspace, worker, and queue navigation fit the compact sidebar
      without fixed-height cards or multi-paragraph boundary copy.
- [x] Focused config, tmux, contract, server, browser-model, semantic, security,
      build, and Chromium tests pass with synchronized active documentation.

## User experience

Normal configured startup:

```text
Open https://<pacium-host>.<tailnet>.ts.net
→ Tailscale Serve verifies the operator
→ Pacium reconnects to the already attached Meta tmux client
→ Meta terminal is focused and ready for input
```

The terminal fills the main workspace. Sessions and the inspector start
collapsed and remain available through their existing buttons and shortcuts.
The connection badge continues to say `Tailscale · <login> · connected`.

If Meta is unavailable, Pacium still opens. It shows one concise unavailable
state and keeps ordinary terminal creation and explicit tmux attachment
available. It never claims the external tmux session ended.

## Architecture

- Systems and modules touched: startup config, tmux/session startup,
  protocol/welcome capability, browser initial-selection model, App shell,
  compact Pacium semantic components and styles, tests, active docs.
- Systems of record: startup environment owns the exact desired Meta tmux
  name; tmux owns target existence/content; the Pacium session manager owns the
  current client PTY and immutable session ID; Tailscale Serve owns remote
  identity; the browser owns view focus.
- State transitions: unconfigured; configured -> discovering -> ready attached;
  configured -> unavailable. Browser initial state -> exact ready Meta selected
  once -> ordinary operator-controlled navigation.
- Protocol/schema impact: protocol 25 adds strict Meta-session capability to
  `server.welcome`; no durable JSON schema changes.
- Relevant ADRs: ADR-0013, ADR-0014, ADR-0015, ADR-0016.

## Security and privacy

- Authorization: existing exact Origin, Tailscale login allowlist, ephemeral
  token, and WebSocket checks remain unchanged.
- Privilege: tmux attachment runs with the Pacium host process user. Pacium
  does not request root or cross an SSH boundary.
- Secrets/logging: no SSH key, Tailscale credential, token, socket path,
  terminal content, or environment dump enters protocol or durable state.
- Abuse/failure scenario: the browser cannot choose the tmux target. Startup
  matches one exact server-owned name and attaches using the already fixed
  tmux argv path.

## Reliability

- Idempotency: startup creates at most one client for the configured exact
  target; browser reload only reattaches transport to that Pacium client.
- Timeouts/retries: existing bounded tmux discovery and attach behavior; no
  automatic command retry or target recreation.
- Restart behavior: the external tmux session may survive. Each Pacium process
  creates one fresh client after exact rediscovery.
- Unknown outcome: startup reports unavailable and leaves the external tmux
  target untouched.
- Migration/rollback: remove `PACIUM_META_TMUX_SESSION` to recover the current
  explicit tmux attachment flow; no stored-state migration.

## Test plan

- Unit: Meta config validation, exact name matching, duplicate-client
  prevention, capability state, initial focus model, compact semantics.
- Contract: protocol-25 strict ready/unavailable/unconfigured relationships.
- Integration: real/fake tmux startup attach, missing target/socket, session
  list, reconnect without duplicate client.
- Browser: exact Meta initial selection/focus, collapsed panels, refresh,
  deliberate later selection, compact Pacium navigation, narrow/zoom/forced
  colors/reduced motion.
- Failure/recovery: unavailable Meta with usable ordinary workspace.
- Security: forged browser target fields remain invalid; loopback,
  Origin/login/token, fixed argv, no-shell, and no-SSH boundaries remain green.

## Dependencies

- Blocked by: PC-070, PC-071, PC-077.
- Blocks: owner canary on the real `felix-harness` Tailscale Serve and `meta`
  tmux session.

## Evidence required

- Exact focused test commands and results.
- Real isolated tmux evidence for one automatic attach and browser reconnect
  without duplication.
- Production build and full Chromium result.
- Manual owner canary remains explicitly separate from repository evidence.

## Open questions

- The exact real host socket path, Serve URL, and operator login remain
  deployment values and are not committed.
