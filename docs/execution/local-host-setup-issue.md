# PC-080: Replace shell configuration with a local setup flow

## Problem

PC-079 still requires the operator to discover a socket, export four
environment values, start Pacium, and configure Serve in a shell. That exposes
implementation details and fails the intended experience.

## Outcome

From a local Pacium page, the operator selects one discovered tmux session and
chooses Enable. Pacium derives Tailscale identity and URL, applies one fixed
private Serve mapping, persists the setup, attaches Meta, and presents the URL
to open. If consent is needed, the operator opens a verified Tailscale approval
page and retries.

## Scope

- Discover the same user's default tmux server without configured paths.
- Inspect bounded current-node fields from `tailscale status --json`.
- Add a protected local-only Host setup read/apply API.
- Run one fixed guarded Tailscale Serve operation.
- Persist version-1 host setup atomically and load it at startup.
- Apply exact Meta immediately and on restart.
- Add a compact accessible setup dialog under Workspace settings.

## Non-scope

- Installing or signing in Tailscale, grants, Funnel, sudo/password handling,
  arbitrary SSH/tmux/Tailscale commands, remote setup, multiple sockets, or
  cross-host control.
- Hiding the initial need to install and launch Pacium.
- Claiming real tailnet reachability without the owner-host canary.

## Acceptance criteria

- [x] Setup denies non-local requests and requires exact local authority,
      token, content type, method, and bounded strict body.
- [x] The browser submits only one server-published tmux session ID.
- [x] Pacium discovers the default same-user tmux socket with fixed no-shell
      arguments and revalidates the target before saving.
- [x] Tailscale projection accepts only a Running node with one canonical
      `*.ts.net` DNS name and exact owner login.
- [x] Apply refuses unknown non-empty Serve configuration.
- [x] The only mutation argv is `serve --bg --yes 4174`; output and time are
      bounded and no shell, SSH, sudo, or Funnel is invoked.
- [x] An approval URL must be canonical HTTPS on `login.tailscale.com`.
- [x] Successful private state is versioned, validated, atomically replaced,
      and contains no credential, token, environment, or transcript.
- [x] Live remote authority and Meta attach change only after successful Serve
      and persistence.
- [x] The dialog has concise discovery, applying, consent, failure, and ready
      states with keyboard and focus support.
- [ ] Repository verification and Chromium pass; real-host evidence remains
      separate.

## User experience

```text
Local Pacium → Settings → Host setup → select Meta → Enable remote Meta
→ if needed: Open Tailscale approval → Retry → Open Pacium
```

No path, login, URL, command, or argument field is shown.

## Architecture

- Systems touched: contracts, startup config, tmux discovery, setup service
  and store, protected HTTP, transport, preferences UI, tests, docs.
- Systems of record: Tailscale owns node/Serve state; tmux owns targets; the
  private setup file owns Pacium's selected projection.
- State transitions: unavailable; ready; consent-required; applying;
  configured; failed/unknown.
- Protocol/schema impact: protected HTTP schemas only; WebSocket remains 25.
- Relevant ADRs: ADR-0013 through ADR-0018.

## Security and privacy

- Authorization: loopback-only protected API.
- Privilege: invoking OS user only.
- Secrets/logging: no keys, credentials, raw JSON, or command output retained.
- Abuse/failure: hostile browser fields fail strict schema; unknown Serve state
  refuses mutation; failed persistence triggers fixed rollback.

## Reliability

- Idempotency: matching setup avoids another Serve mutation.
- Timeouts/retries: bounded inspection and mutation; operator retry only.
- Restart: persisted setup becomes startup configuration.
- Unknown outcome: shown honestly; no success saved.
- Rollback: environment override, file removal, and exact Serve disable.

## Test plan

- Unit: schema/projection, URLs, commands, storage, precedence.
- Contract: strict HTTP relationships.
- Integration: local authorization, default tmux, fake Tailscale.
- Browser: setup, consent, failure, ready URL, focus, responsive behavior.
- Security: remote denial and injection fields.

## Dependencies

- Blocked by: PC-077, PC-079, ADR-0018.
- Blocks: real `felix-harness` no-command canary.

## Evidence required

Focused/full tests, fixed argv evidence, real isolated tmux, Chromium,
production build, and separate real-host evidence.

## Open questions

- None.
