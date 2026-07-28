# Implementation plan: Codex native observer

- Issue: [codex-observer-issue.md](codex-observer-issue.md)
- Owner: Codex
- Agent/session: primary implementation agent
- Branch: `codex/codex-observer`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `630621dc2dc23b479569923f4518b449a6fa78bd`
- Target milestone: Epic 5 / PC-062
- Status: Complete

## Objective

Keep the supported Codex terminal UI in Pacium's direct PTY while using one
private App Server child and one authenticated loopback bridge per session to
project bounded native runtime metadata without controlling Codex or retaining
provider content.

## Existing behavior

- Protocol 20 carries a strict provider snapshot and Claude status usage
  fields.
- Codex sessions start observer-unavailable with unknown capabilities and use
  the installed `codex` executable directly in a PTY.
- The HTTP server owns one loopback listener and routes only the authenticated
  browser WebSocket plus Claude HTTP ingress.
- Installed local evidence is Codex CLI `0.145.0`. Its generated App Server
  schemas expose stable thread/turn/item/approval notifications plus some
  experimental fields; generated output is version-specific.

## Proposed behavior

At server startup, fixed probes confirm the installed CLI version and required
App Server/remote flags. For a supported Codex launch, the observer registers
the immutable Pacium session ID, generates a session token, and appends:

```text
--remote ws://127.0.0.1:<port>/api/provider/codex/<session-id>/runtime
--remote-auth-token-env PACIUM_CODEX_RUNTIME_TOKEN
```

The shared HTTP server accepts only that exact token-bound no-Origin upgrade.
The observer then launches the same canonical Codex executable as
`app-server --listen stdio://`, forwards TUI text frames to JSONL stdin and
JSONL stdout messages back as text frames, and observes only strict bounded
method metadata. It never sends an independent App Server request or response.

If required capabilities are absent, SessionManager launches the existing
direct Codex preset with an unavailable observer instead.

## Architecture and boundaries

### Modules touched

- `packages/contracts/src/provider-observation.ts`: typed Codex usage totals.
- `packages/contracts/src/protocol.ts`: protocol 21.
- `apps/local-server/src/codex-observer.ts`: capability probe, preparation,
  exact child spawn, bridge ownership, strict message normalization,
  deduplication, snapshot reduction and release.
- `apps/local-server/src/http-server.ts`: exact provider upgrade dispatch
  before the browser WebSocket route.
- `apps/local-server/src/session-manager.ts`: prepare/release observer and
  broadcast validated snapshots.
- Existing PTY environment additions and Activity consumers remain the shared
  boundaries.

### Data/state changes

- Entity/schema changes: Codex activity extensions gain nullable bounded usage
  scalars.
- Commands/events: no browser command; one fixed provider-only WebSocket route.
- Idempotency: bounded method/identity/status fingerprints per session.
- Migration: no file migration or durable provider state.

### Protocol changes

- Increment protocol 20 to 21.
- Add only typed nullable Codex usage scalars; no arbitrary App Server message.

### Authorization and privilege

- One random 256-bit URL-safe token per registered Codex session.
- Exact loopback Host, absent Origin, exact UUID route, bearer auth, text-only
  bounded frames and one active client.
- The App Server uses private stdio and the canonical already-allowlisted Codex
  executable; the bridge is not a generic process or shell endpoint.
- The browser access token and Tailscale authority cannot authorize the
  provider route.

## Sequence

1. Extend/test the Codex typed usage extension and protocol 21.
2. Implement strict pure normalization for the exact generated 0.145.0
   thread/turn/item/plan/usage/error/request shapes.
3. Implement capability probing, registration, token preparation, event
   deduplication and snapshot reduction.
4. Implement the bounded single-client WebSocket-to-JSONL child bridge.
5. Integrate provider upgrade routing and SessionManager lifecycle cleanup.
6. Add Activity usage detail plus reconnect/security/failure tests.
7. Synchronize issue, backlog, status, README and changelog.
8. Run focused tests, full verification and all browser workflows.

## Failure model

| Failure point                            | Expected state                                                      | Recovery                                       |
| ---------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------- |
| Capability/version probe unavailable     | Existing direct Codex PTY; observer unavailable                     | Install/upgrade Codex and restart Pacium       |
| Provider upgrade invalid                 | HTTP 403; no child or snapshot change                               | TUI retries only with current registered token |
| App Server spawn/start failure           | Observer failed; TUI shows remote connection failure                | Relaunch after fixing local Codex installation |
| Invalid/binary/oversized WebSocket frame | Bridge closes with bounded provider error                           | Relaunch the affected Codex session            |
| Invalid/oversized App Server JSONL       | Observer failed; no raw retention                                   | Relaunch after compatible Codex update         |
| Unknown notification                     | Forward unchanged; no unsupported fact invented                     | Adapter update can add typed support           |
| Duplicate notification                   | No duplicate fact or attention transition                           | Later unique event proceeds                    |
| Foreign thread after binding             | Forward for TUI; ignore observer projection and degrade diagnostics | Matching thread evidence resumes               |
| PTY exit/remove/shutdown                 | Close bridge and terminate exact child process                      | Relaunch creates new child/token               |

## Compatibility

- Supported versions: capability-probed; fixture schemas generated from local
  Codex CLI 0.145.0, not declared as a universal semantic range.
- Fallback behavior: ordinary direct Codex PTY plus process evidence when the
  native adapter is not available.
- Rollback: remove observer preparation/bridge and protocol-21 typed fields
  together.

## Test plan

- Unit: schemas, mappings, version/capability parsing, token separation,
  deduplication, bounds, source/confidence/freshness and usage.
- Property/fault: unknown keys/methods, content-heavy fixtures, malformed JSON,
  oversized lines/frames, duplicate IDs, foreign threads and timestamps.
- Contract: protocol 21, Codex usage bounds and cross-provider rejection.
- Integration: exact upgrade auth, one active client, bidirectional forwarding,
  App Server lifecycle, `session.updated`, disconnect and shutdown.
- Browser: existing Activity semantic rendering and complete terminal/Pacium
  workflows.
- Security: no content retention/logging, no generated response/approval, no
  remote/browser route access.
- Performance: bounded frame/line/queue sizes, 32 activities and 128
  fingerprints; no polling.

## Documentation changes

- Update PC-062 backlog status.
- Update `STATUS.md`, `README.md`, and `CHANGELOG.md`.
- Record generated-schema version, experimental transport boundary and manual
  canary status.

## Rollout

- Development: fixture-driven normalizer from locally generated exact schemas.
- Integration: fake App Server child and real WebSocket bridge tests.
- Canary: manual local Codex TUI only if it can be done without sending a
  provider prompt or altering user config; otherwise retain the explicit
  external canary gate.
- Production: no release claim; PC-064 degradation, packaging and supported
  runtime gates remain open.

## Open questions

- Whether a future packaged adapter should prefer a Unix socket is deferred
  until Codex exposes a stable, directly consumable local-client contract that
  preserves strict per-session correlation.

## Approval

- Product: bounded by accepted PC-062 backlog entry.
- Architecture: direct PTY remains primary; App Server provides only native
  observation and the TUI remains the only controlling client.
- Security: session-token loopback bridge, fixed executable/argv, bounded
  transparent forwarding and no raw retention.

## Result

PC-062 is complete. Protocol 21, capability probing, the per-session private
App Server bridge, strict native normalization, lifecycle cleanup, reconnect
preservation, and bounded Activity usage presentation are implemented. Full
verification passed 121 test files and 766 tests, and all 14 Chromium
workflows passed. The live-provider canary, stable-version compatibility UX,
control actions, persistence, PC-063 cards, PC-064 degradation, and PC-065
relaunch manifests remain outside this completed slice.
