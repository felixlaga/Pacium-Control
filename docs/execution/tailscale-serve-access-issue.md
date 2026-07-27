# PC-077: Add optional Tailscale Serve access

## Problem

Pacium Control is correctly bound to loopback, but that currently limits the
workspace to a browser on the same machine. The owner needs to supervise the
same local PTYs, Meta, Orchestrator, and queue workflow from another device on
the private tailnet without turning Pacium into a public, multi-user, or
cross-host control plane.

Binding Pacium directly to a LAN or Tailscale address would widen the
browser-to-shell boundary. Trusting a remote Origin or Tailscale-looking header
by itself would let an unrelated route obtain terminal authority. Treating a
tailnet IP as a person would also be unstable and would admit tagged devices
that have no interactive user identity.

## Outcome

Pacium remains bound only to `127.0.0.1` and optionally accepts a single
Tailscale Serve HTTPS origin. Every proxied request is classified independently
from its exact Host, Origin where required, and verified Serve login header.
Only explicitly allowlisted logins can load the app, obtain the ephemeral
Pacium token, use protected HTTP APIs, or upgrade a WebSocket.

The browser labels the active connection as Local or Tailscale and shows the
bounded verified login for a remote connection. Disabling Serve immediately
removes remote reachability without changing or terminating PTYs. Removing the
startup configuration returns the next Pacium process to local-only behavior
without a state migration.

## Scope

- Keep the server listener fixed to `127.0.0.1`.
- Add one optional exact HTTPS Tailscale Serve origin and one non-empty exact
  login allowlist to startup configuration.
- Fail startup closed when only part of remote mode is configured or when the
  origin/login values are malformed, duplicated, unbounded, or unsafe.
- Classify local and Serve-proxied requests from exact Host, Origin, fetch
  metadata, and `Tailscale-User-Login` evidence.
- Reject missing, multiple, malformed, tagged-device-only, or unlisted
  identity without using source IP as identity.
- Protect web assets, bootstrap, health, protected HTTP APIs, and WebSocket
  upgrades with the appropriate request classification.
- Continue requiring the ephemeral Pacium token for protected HTTP and
  WebSocket transport.
- Carry independently verified connection identity into the WebSocket welcome
  message and render a compact Local or Tailscale connection label.
- Add operator documentation for Serve enable/status/off, a least-privilege
  grants example, revocation, local-only rollback, Funnel prohibition, and
  public-reachability checks.
- Test local compatibility, accepted remote traffic, spoofed header/Host/Origin
  combinations, tagged/missing/unlisted identity, token denial, revocation
  configuration, PTY survival, and loopback binding.

## Non-scope

- Binding Pacium to a Tailscale, LAN, wildcard, Unix-socket, or public address.
- Tailscale Funnel, another reverse proxy, Cloudflare Tunnel, VPN-independent
  remote access, or Pacium-managed TLS.
- Installing, logging into, configuring, invoking, or monitoring the Tailscale
  daemon from Pacium.
- Persisting Tailscale identity, access tokens, certificates, keys, grants, or
  connection history.
- Application users, memberships, roles, concurrent input ownership,
  invitations, authentication sessions, or a database.
- Cross-host terminal aggregation, remote process spawning, SSH transport, or
  a generic remote shell endpoint.
- Trusting display name, profile picture, source IP, device name, tags, app
  capabilities, or browser-supplied identity.
- Claiming that application allowlisting replaces Tailscale grants or that an
  automated test proves a real tailnet/public configuration.

## Acceptance criteria

- [x] Server configuration always resolves the listening host to
      `127.0.0.1`; remote mode cannot alter the bind address.
- [x] Remote mode starts only with one canonical
      `https://<node>.<tailnet>.ts.net` origin and a non-empty bounded list of
      exact Tailscale logins. Partial or unsafe configuration fails startup
      closed.
- [x] Local browser assets, bootstrap, token-protected HTTP APIs, and
      token-protected WebSockets retain their current behavior without
      Tailscale headers.
- [x] Remote assets and same-origin navigation require the exact configured
      Host and an allowlisted `Tailscale-User-Login`; bootstrap additionally
      requires the exact configured Origin.
- [x] Protected remote HTTP and WebSocket requests require exact Host, exact
      Origin, the same allowlisted verified login, and the existing ephemeral
      token.
- [x] Missing, empty, duplicated, comma-joined, control-bearing, non-ASCII,
      oversized, tagged-device-only, or unlisted login evidence is denied.
- [x] Tailscale identity headers on local, hostile-Origin, wrong-Host, or
      unconfigured requests never activate remote mode or grant authority.
- [x] The server welcome contract reports only `local`, or `tailscale` plus
      the bounded verified login. Display name and profile-picture headers are
      not authorization inputs or protocol data.
- [x] The header connection indicator communicates transport and identity in
      text, preserves connection-state semantics, and works with keyboard,
      narrow viewport, 200% zoom, forced colors, and reduced motion.
- [x] Disabling Serve needs no state migration and does not terminate running
      PTYs. Removing both remote values selects local-only mode on the next
      planned Pacium start; existing direct PTYs retain their documented server
      lifecycle.
- [x] Documentation gives current `tailscale serve --bg <port>`, `status`, and
      `off` commands; a reviewed TCP-443 grants example; explicit Funnel
      prohibition; allowlist revocation; and public/LAN denial checks.
- [x] Focused unit, protocol, HTTP/WebSocket integration, browser, security,
      production-build, and full repository gates pass with exact evidence.

## User experience

Local use remains visually and behaviorally unchanged except that the compact
connection badge says `Local · connected`. Through the accepted Serve URL it
says `Tailscale · <login> · connected`. The verified login is informational;
there are no account menus, roles, or user-management screens.

Authorization failures return a generic forbidden response and never reveal
the allowlist, token, alternate login, or terminal state. A lost or revoked
remote connection changes to the existing reconnecting/disconnected state and
explains that running PTYs remain on the Pacium host. Local access remains
available when remote mode is disabled.

The badge remains in the existing workspace header. It uses text and the
existing status dot, truncates a long login without hiding the full accessible
name, and does not take terminal focus or add an action.

## Architecture

- Systems and modules touched:
  - startup configuration and validation;
  - HTTP/upgrade request authority classification;
  - strict protocol connection identity;
  - WebSocket connection context;
  - browser transport/app connection state and header badge;
  - focused server, browser, and Chromium tests;
  - active security, deployment, status, release, and operator documentation.
- Systems of record:
  - environment variables own the optional exact origin and application
    allowlist;
  - Tailscale Serve owns HTTPS termination and verified identity headers;
  - the current request classification owns disposable connection identity;
  - Pacium owns the ephemeral process token and live PTYs.
- State transitions:
  - startup `local-only | valid remote config | rejected startup`;
  - request `local | tailscale allowlisted | forbidden`;
  - browser connection keeps its existing network states plus disposable
    transport identity from the current authenticated socket.
- Protocol/schema impact:
  - protocol 18 adds strict `connection` evidence to `server.welcome`;
  - no application-state, Pacium-config, queue-state, or browser-storage schema
    changes.
- Relevant ADRs:
  - ADR-0001, ADR-0013, ADR-0014, and ADR-0016.

## Security and privacy

- Authorization: Tailscale grants are the outer network boundary. Pacium then
  requires exact configured Host/Origin, a Serve login in its explicit
  allowlist, and its ephemeral token for protected transports.
- Privilege: remote mode exposes only the existing browser application and
  typed protocols to the same invoking OS user. It adds no shell endpoint,
  role, elevation, daemon control, or host selection.
- Secrets/logging: the access token remains memory-only and out of URLs/logs.
  Login values are bounded operator-facing evidence and are not persisted or
  emitted in generic errors. Other Tailscale identity headers are ignored.
- Abuse/failure scenario: direct LAN/tailnet connection, hostile pages,
  spoofed identity headers, tagged devices, shared devices, revoked users,
  wrong Serve hostname, incomplete config, and public Funnel exposure fail
  closed at network, request, or token boundaries.

## Reliability

- Idempotency: request classification is a pure operation. Repeated bootstrap
  returns the same process token only to currently authorized requests.
- Timeouts/retries: no new server retry exists. The browser uses its existing
  bounded reconnect loop and re-runs bootstrap/upgrade authorization.
- Restart behavior: PTYs follow the existing direct-PTY server lifecycle.
  Remote configuration and the ephemeral token are reloaded/regenerated; stale
  browsers must bootstrap again.
- Unknown outcome: absence of identity headers is denial, never an inferred
  local or tagged identity. Application tests cannot prove external grants,
  certificate, Funnel, DNS, or public-firewall state.
- Migration/rollback: remove both remote environment values and run
  `tailscale serve off`. No durable Pacium data changes.

## Test plan

- Unit: remote configuration matrix, exact origin/hostname/login parsing,
  request classification, local compatibility, header multiplicity, and
  bounded connection-label projection.
- Contract: protocol-18 local/remote welcome variants, strict fields, login
  bounds, forbidden display/profile/IP data, and protocol mismatch.
- Integration: local and remote assets/health/bootstrap/directories,
  WebSocket upgrades, token checks, exact Host/Origin/header identity, session
  creation, reconnect, and PTY survival.
- Browser: Local and Tailscale badges, reconnect/revocation copy, long login,
  narrow viewport, 200% zoom, forced colors, and reduced motion.
- Failure/recovery: partial configuration, malformed headers, server restart,
  config removal, remote denial while local remains usable, and Serve-off
  operator path.
- Security: spoofed local/remote headers, hostile Origin, wrong Host, missing
  identity, tagged device, unlisted/shared user, invalid token, non-loopback
  bind rejection, no identity/token logging, and public/LAN denial procedure.

## Dependencies

- Blocked by: ADR-0016 and the implemented localhost bootstrap/token/WebSocket
  boundary.
- Blocks: supported remote directory picking, remote release review, and the
  Milestone-5 remote-access gate.

## Evidence required

- Focused config, authority-classification, strict-contract, rendering, and
  authenticated HTTP/WebSocket tests.
- Real local-server evidence that accepted remote requests can operate one
  canary PTY while every negative identity/Host/Origin/token combination is
  denied and the server listener remains loopback.
- Chromium evidence for connection labelling, reconnect behavior, terminal
  preservation, narrow/zoom/forced-color/reduced-motion states.
- Reviewed current official Tailscale commands and least-privilege grants
  example, clearly separated from locally automated evidence.
- Passing `pnpm verify`, `pnpm test:e2e`, and production builds with exact
  counts and bundle sizes.
- Small coherent commits, clean branch, fast-forward merge into `dev`, and
  pushed exact `origin/dev` head.

## Completion evidence

- `pnpm verify` passed formatting, lint, every workspace type check, 114 test
  files and 701 tests. Production output was 903.24 kB web JavaScript
  (238.71 kB gzip), 107.74 kB CSS (16.90 kB gzip), and 335.82 kB local-server
  JavaScript.
- `pnpm test:e2e` passed all 11 headless Chromium workflows. The focused
  accessibility workflow verified Local connection evidence at ordinary and
  320 CSS-pixel widths plus 200% zoom, forced colors, and reduced motion.
- Focused configuration, request-authority, protocol, component, HTTP,
  WebSocket, and PTY tests passed. They cover partial/unsafe startup,
  canonical local and Serve Origins, wrong Host/Origin, duplicate/missing/
  tagged/unlisted login, Funnel, token denial, exact WSS policy, Local/
  Tailscale welcome evidence, a proxy-shaped canary PTY, browser reconnect, and
  direct LAN/tailnet/public-shaped Host denial.
- Current official Tailscale documentation and source were inspected for Serve
  CLI syntax, tailnet-only behavior, Host preservation, forwarding/identity
  header replacement, tagged-device identity absence, Funnel distinction,
  grants/tests syntax, and `off` behavior. The active runbook records the
  reviewed procedure.
- No real tailnet, certificate, grant, Funnel, revocation, LAN, or public
  provider state was changed or claimed. The runbook's canary and external
  reachability exercise remains an explicit owner/release gate.
- Verification used Node.js 26.4.0 and emitted the expected engine warning
  because the supported runtime is Node.js 24.18.x. Vite retained the existing
  chunk-size warning.

## Open questions

- A local process running as the same OS user can send matching Host, Origin,
  and identity headers to the loopback service. ADR-0016 accepts that host-local
  trust boundary; PC-077 does not claim to defend the operator from their own
  trusted local processes.
- A real Tailscale Serve/grants/public-reachability exercise requires the
  operator's tailnet and remains a manual release gate. Deterministic tests use
  only a loopback proxy-shaped request fixture and make no provider claim.
