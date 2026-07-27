# Implementation plan: PC-077 optional Tailscale Serve access

- Issue: [PC-077 optional Tailscale Serve access](tailscale-serve-access-issue.md)
- Owner: Local implementation agent
- Agent/session: Codex `/root`
- Branch: `codex/tailscale-serve-access`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `ac7616047bc4e09a2fd0ff501442c368a49b8c15`
- Target milestone: Milestone 5 — polish and remote access
- Status: In progress

## Objective

Implement the one accepted remote shape from ADR-0016: Tailscale Serve proxies
one tailnet-only HTTPS origin to the unchanged loopback Pacium server, and
Pacium authorizes only exact configured user logins before exposing terminal
authority.

Preserve the existing local experience, ephemeral-token transport, direct-PTY
lifecycle, and single-process design. PC-077 adds no application accounts,
database, remote host, daemon integration, generic proxy trust, or public
ingress.

## Existing behavior

- `loadServerConfig` accepts only `PACIUM_HOST=127.0.0.1`, creates one
  process-local access token, and builds a set of local HTTP origins.
- `createPaciumHttpServer` listens on the configured loopback host.
- Bootstrap accepts a loopback Host plus an allowed local Origin or same-origin
  fetch metadata and returns the ephemeral token.
- `/api/directories` additionally requires that token as a bearer credential.
- WebSocket upgrades require loopback Host, allowed Origin, the token in a
  subprotocol, and `pacium.v1`.
- Web assets and local health currently do not have a Host authority check.
- `WebSocketHub` sends protocol-17 welcome/capabilities without connection
  transport or identity evidence.
- The browser connection badge shows only connecting, connected, reconnecting,
  or disconnected.
- PTYs are owned by the local server and survive browser reconnect but not a
  local-server process exit.

Primary existing modules:

- `apps/local-server/src/config.ts`
- `apps/local-server/src/security.ts`
- `apps/local-server/src/http-server.ts`
- `apps/local-server/src/ws-hub.ts`
- `packages/contracts/src/protocol.ts`
- `apps/web/src/transport.ts`
- `apps/web/src/app.tsx`
- `apps/web/src/styles.css`
- `apps/local-server/src/http-server.integration.test.ts`

Current official Tailscale documentation states that Serve is tailnet-only,
proxies local ports to `127.0.0.1`, strips incoming identity headers before
adding `Tailscale-User-Login`, `Tailscale-User-Name`, and optional profile
picture headers, and does not add user identity headers for tagged-device
traffic. Background Serve uses `tailscale serve --bg <port>` and is disabled
with `tailscale serve off`. Funnel is a separate public feature and remains
prohibited.

## Proposed behavior

### Startup configuration

Two optional environment values form one atomic remote configuration:

```text
PACIUM_TAILSCALE_ORIGIN=https://node.tailnet.ts.net
PACIUM_TAILSCALE_OPERATOR_LOGINS=owner@example.com
```

Both absent means local-only. Both present means enabled. Either alone, an
empty login set, or an invalid value rejects startup.

The origin must be its own canonical URL origin with:

- `https:` scheme;
- an ASCII lowercase hostname ending in `.ts.net`;
- no explicit port, username, password, path, query, or fragment;
- bounded bytes and no control characters.

The config stores the exact origin, derived hostname, and an immutable set of
at most 32 exact logins. Each login is trimmed at configuration separators,
then required to be unique, ASCII, contain one identity-provider separator
`@`, contain no whitespace/comma/control characters, and fit within 254 bytes.
Request authorization compares the resulting value exactly and does no case
folding or display-name fallback.

The origin is added to the browser asset CSP for HTTPS/WSS connectivity only
when remote mode is enabled. The listener host remains the literal
`127.0.0.1`.

### Request authority

A new pure server authority module returns:

```text
{ kind: "local" }
{ kind: "tailscale", login: "<exact verified login>" }
null
```

Local authority requires a loopback Host and the existing allowed local
Origin/fetch-site rules. Tailscale-looking headers never transform a loopback
Host into a remote request.

Remote authority requires:

- the exact hostname from `PACIUM_TAILSCALE_ORIGIN`, with no alternate port;
- remote mode enabled;
- exactly one bounded `Tailscale-User-Login` header;
- exact membership in the application login allowlist;
- exact remote Origin for bootstrap, protected API requests, and WebSocket
  upgrades;
- safe same-origin/none fetch metadata for navigation and assets.

Node joins duplicate HTTP headers with commas, while accepted login values
cannot contain commas, so a joined/duplicate identity is rejected. Missing
identity includes tagged-device traffic and is denied. Name, profile-picture,
app-capability, forwarded-IP, source-IP, and device headers are ignored.

Routes apply authority before revealing state:

- web assets and local health: local navigation authority or allowlisted remote
  navigation authority;
- bootstrap: local bootstrap authority, or exact remote POST Origin plus
  allowlisted identity;
- directories: existing token plus local protected authority, or exact remote
  Origin/identity protected authority;
- WebSocket: exact local/remote authority, token, path, and subprotocol.

The browser uses a same-origin POST for remote bootstrap so the user agent
supplies the exact HTTPS Origin. Local bootstrap remains the existing GET.

### Connection evidence

Protocol 18 adds one strict `connection` field to `server.welcome`:

```text
{ kind: "local" }
{ kind: "tailscale", login: "<bounded exact login>" }
```

The HTTP upgrade classifies the request before accepting it and passes that
disposable result to `WebSocketHub`. The hub does not infer identity from IP or
browser messages. Every new socket receives only the evidence independently
verified for that upgrade.

The browser clears prior connection evidence whenever transport leaves the
connected state, then accepts the current welcome evidence. The existing
header badge renders `Local · connected` or
`Tailscale · <login> · connected`. Reconnecting/disconnected states explicitly
retain the transport label only if it came from the current socket; stale
identity is not presented as active.

No connection history or identity enters application state, Pacium config,
preferences, terminal metadata, logs, or URLs.

### Operator procedure

An active operations page documents:

1. configure the two Pacium environment values;
2. start Pacium and confirm a loopback listener;
3. run `tailscale serve --bg <Pacium port>`;
4. inspect `tailscale serve status`;
5. apply a reviewed grant limited to the operator source and destination node
   on `tcp:443`;
6. verify allowed-user HTTPS/WSS and canary terminal behavior;
7. verify unlisted user, LAN/tailnet direct port, and public internet denial;
8. confirm Funnel is not configured;
9. revoke by removing the login and restarting Pacium;
10. disable with `tailscale serve off` and remove both environment values.

Provider/tailnet validation is recorded as a manual release gate rather than
being inferred from local request fixtures.

## Architecture and boundaries

### Modules touched

- `apps/local-server/src/config.ts`
  - strict optional Serve configuration.
- `apps/local-server/src/remote-access.ts` (new)
  - pure local/remote request classification and safe login extraction.
- `apps/local-server/src/security.ts`
  - token/origin/Host primitives and dynamic CSP construction.
- `apps/local-server/src/http-server.ts`
  - route/upgrade authority and connection-context handoff.
- `apps/local-server/src/ws-hub.ts`
  - authenticated connection evidence in welcome.
- `packages/contracts/src/protocol.ts`
  - protocol-18 strict connection evidence.
- `apps/web/src/transport.ts`
  - HTTPS remote bootstrap method and typed welcome handling.
- `apps/web/src/app.tsx`
  - disposable current connection evidence.
- `apps/web/src/styles.css`
  - compact identity-aware badge and accessibility states.
- focused unit/integration/component/Chromium fixtures and tests.
- `README.md`, `ARCHITECTURE.md`, `SECURITY.md`, deployment topology,
  identity/authorization, active remote operations, STATUS, backlog, milestone,
  changelog, issue, and plan.

### Data/state changes

- Entity/schema changes:
  - none;
  - remote configuration is process startup input;
  - connection identity is disposable per-socket evidence.
- Commands/events:
  - no application command;
  - protocol-18 `server.welcome.connection`.
- Idempotency:
  - classification is pure;
  - bootstrap returns the current process token only after current request
    authorization;
  - reconnect repeats the complete authorization flow without replaying input.
- Migration:
  - none for `pacium.json`, `queue-state.json`, preferences, terminals, or Git.

### Protocol changes

- Bump `PROTOCOL_VERSION` from 17 to 18.
- Add strict `ConnectionAccessSchema`:
  - local has only `kind`;
  - Tailscale has only `kind` and a bounded ASCII login.
- Add `connection` to `server.welcome`.
- Do not expose Origin, Host, IP, display name, profile picture, device, tags,
  grants, access token, or allowlist.
- Keep application-message and terminal-frame bounds unchanged.

### Authorization and privilege

- Tailscale grants control which tailnet sources can reach Serve.
- Serve strips inbound spoofed identity headers and supplies user login only
  for user-associated tailnet traffic.
- Pacium trusts that login only for the exact configured Serve Host/Origin
  while its listener remains loopback.
- Pacium's exact login allowlist is a required second authorization check.
- The ephemeral token remains required for protected HTTP and WebSocket
  control.
- A trusted process on the Pacium host remains inside the accepted invoking-OS
  user boundary.
- Pacium never invokes Tailscale, edits grants, receives provider credentials,
  selects a remote host, or launches a command from remote configuration.

## Sequence

1. Commit the PC-077 issue and this implementation plan separately.
2. Add strict remote startup configuration and its complete failure matrix.
3. Add pure local/Tailscale request classification with spoof/header bounds.
4. Apply authority to assets, health, bootstrap, protected HTTP, and WebSocket
   upgrade while retaining the access token.
5. Add authenticated HTTP/WebSocket integration coverage for every accepted
   and denied combination.
6. Add strict protocol-18 connection evidence and server welcome projection.
7. Track current connection evidence in the browser and clear stale identity.
8. Render the compact Local/Tailscale badge with accessible truncation and
   failure copy.
9. Add browser/Chromium fixtures for local, remote, reconnect, terminal
   preservation, narrow/zoom/forced-color/reduced-motion states.
10. Add the active Serve/grants/revocation/disable/public-denial runbook.
11. Synchronize architecture, security, README, STATUS, backlog, milestone,
    changelog, issue, and plan.
12. Run focused tests after each coherent slice, then `pnpm verify` and full
    Chromium at the exact head.
13. Audit the small commit series and clean worktree, fast-forward into `dev`,
    push exact `origin/dev`, and continue with the directory-picker refresh.

## Failure model

| Failure point                             | Expected state                                          | Recovery                                                      |
| ----------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------- |
| Both remote values absent                 | Local-only startup                                      | Configure both only when remote access is needed              |
| Only origin or allowlist set              | Startup rejected before listening                       | Supply a complete reviewed pair or remove both                |
| Unsafe origin/login                       | Startup rejected with bounded config-field error        | Correct startup environment                                   |
| Serve not installed/running               | Local Pacium works; remote URL unavailable              | Configure Serve externally                                    |
| Funnel/public exposure configured         | Unsupported external security failure                   | Run `tailscale serve off`, remove Funnel, reconfigure Serve   |
| Wrong Host or Origin                      | Generic 403; no token or state                          | Use the one configured Serve URL                              |
| Identity missing/tagged                   | Generic 403                                             | Use an allowlisted user-associated device                     |
| Identity unlisted/revoked                 | Generic 403                                             | Review grants/allowlist; do not auto-enrol                    |
| Duplicate/malformed identity header       | Generic 403                                             | Repair proxy path; another proxy is unsupported               |
| Missing/wrong token                       | Protected API/upgrade denied                            | Re-bootstrap through the authorized origin                    |
| Browser disconnect                        | Existing PTYs survive; stale identity clears            | Reconnect and re-authorize                                    |
| Pacium restart                            | Direct PTYs follow current exit behavior; token rotates | Restart and bootstrap again                                   |
| Remove allowlist member                   | Existing socket lasts only until server restart         | Restart Pacium to apply startup config; user cannot reconnect |
| Disable Serve                             | Remote reachability ends; local Pacium/PTYs continue    | Use localhost or re-enable reviewed Serve config              |
| Local spoofed Tailscale header            | Remains local; header grants no remote identity         | No action                                                     |
| Automated external validation unavailable | Release gate remains explicitly unverified              | Run manual tailnet/public checks                              |

## Compatibility

- Supported versions:
  - protocol 18;
  - Node.js 24.18.x;
  - Tailscale Serve CLI contract validated against current official docs;
  - unchanged Pacium and queue-state schemas.
- Fallback behavior:
  - no remote environment means exact local-only behavior;
  - no user identity means denial, including tagged devices;
  - local browser operation does not require Tailscale.
- Rollback:
  - run `tailscale serve off`;
  - remove both remote environment values and restart Pacium;
  - no data conversion or cleanup is required.

## Test plan

- Unit:
  - complete remote environment matrix;
  - canonical origin and exact login bounds;
  - local/remote navigation, bootstrap, protected, and WebSocket authority;
  - duplicate/spoof/missing/tagged/unlisted headers;
  - current connection badge projection and clearing.
- Property/fault:
  - case/port/path/query/fragment variations;
  - maximum login/list sizes;
  - Node duplicate-header joining;
  - partial config and token rotation;
  - stale welcome/close ordering.
- Contract:
  - protocol-18 strict local/Tailscale welcome;
  - login bound/ASCII invariant;
  - forbidden identity/network/token fields;
  - protocol mismatch.
- Integration:
  - assets, health, bootstrap, directory API, and WebSocket through local and
    proxy-shaped requests;
  - exact Host/Origin/login/token combinations;
  - canary terminal create/input/reconnect;
  - remote denial without PTY termination and local continuity.
- Browser:
  - Local and Tailscale labels;
  - long login accessible name;
  - reconnect/disconnect;
  - refresh and terminal preservation;
  - 320 CSS px, 200% zoom, forced colors, reduced motion.
- Security:
  - non-loopback bind;
  - direct tailnet/LAN-shaped Host;
  - hostile Origin;
  - header spoofing/multiplicity;
  - tagged/unlisted/shared identity;
  - invalid/missing token;
  - generic errors and absent token/identity logging;
  - documented external Funnel/public-denial checks.
- Performance:
  - constant-time set membership and token comparison;
  - no daemon query, database, watcher, durable session, or extra polling.

## Documentation changes

- Add an active `docs/operations/tailscale-serve.md` runbook with current
  commands, grants template, validation, revocation, disable, and residual
  risks.
- Update `README.md`, `ARCHITECTURE.md`, `SECURITY.md`, deployment topology,
  identity/authorization, and workspace protocol with the implemented boundary.
- Update Milestone 5, implementation backlog, `STATUS.md`, and `CHANGELOG.md`
  with exact implementation and test evidence.
- Mark superseded multi-user production deployment content clearly outside the
  active runbook.
- Complete this issue/plan with exact test counts, bundle sizes, runtime
  caveats, manual tailnet gates, merge SHA, and remaining release work.

## Rollout

- Development: deterministic loopback HTTP requests with proxy-shaped
  Host/Origin/identity headers only.
- Integration: real loopback local server, WebSocket, and disposable canary PTY;
  no operator tailnet or terminal state.
- Canary: owner configures one real Serve URL/login/grant and performs the
  documented allowed/denied/public checks.
- Production: none. Pacium Control remains pre-release until the broader
  release checklist and manual remote-security gate pass.

## Open questions

- Existing authenticated sockets cannot observe an environment allowlist edit
  because configuration is startup-only. Revocation therefore requires a
  Pacium restart (closing direct PTYs under the current lifecycle) unless outer
  Tailscale grants or Serve are disabled first. The runbook makes Serve/grant
  revocation the non-PTY-killing immediate path; live allowlist reload is
  outside this slice.
- Browsers do not reliably attach `Origin` to same-origin GET requests. Remote
  bootstrap uses POST so the user agent supplies it; navigation assets rely on
  exact Host, verified Serve login, and fetch metadata because top-level
  navigation normally has no Origin.
- Current official docs distinguish tailnet-only Serve from public Funnel and
  state that tagged-device traffic lacks user identity headers. PC-077 denies
  missing identity rather than introducing device authorization.

## Approval

- Product: remote access remains an optional transport label in the existing
  lightweight workspace, not an account or administration feature.
- Architecture: one loopback process, direct PTYs, ephemeral token, typed
  protocols, no database, and same-host source ownership remain unchanged.
- Security: exact Serve Host/Origin, exact user-login allowlist, token,
  loopback binding, grants, Funnel prohibition, negative tests, and explicit
  manual external gates implement ADR-0016 without general proxy trust.
