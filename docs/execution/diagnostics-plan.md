# Implementation plan: bounded redaction-aware diagnostics

- Issue: PC-073
- Owner: Pacium Control
- Agent/session: Codex
- Branch: `codex/diagnostics`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `673275b`
- Target milestone: Milestone 5 — Durability, packaging, and polish
- Status: Complete

## Objective

Add one operator-invoked, versioned, structurally redacted diagnostics surface
and JSON download without introducing telemetry, raw logs, content capture,
server-side export files, or new shell/filesystem authority.

## Existing behavior

- `/api/health` reports only `{status:"ok"}` behind the navigation boundary.
- `/api/bootstrap` establishes the ephemeral bearer token and WebSocket path.
- `/api/directories` demonstrates the exact token-protected Local/Tailscale
  read-method boundary.
- SessionManager already owns bounded session summaries and tmux capability.
- QueueObserver exposes one bounded current observation.
- Session summaries contain validated provider capability/health/diagnostic
  evidence but also sensitive identity, path, process, and activity fields that
  must never be copied wholesale.
- The browser has a shared modal/focus model, header actions, command palette,
  and no general router dependency.

## Proposed behavior

The server constructs a diagnostics snapshot field by field from allowlisted
current metadata. Every collection is capped, every object is strict, and the
whole serialized response has a fixed maximum. Session identities become
deterministic export-local labels such as `Terminal 1`; queue and provider
content-bearing fields are represented only by bounded aggregate counts.

One protected `/api/diagnostics` request returns this disposable snapshot with
`cache-control: no-store`. The browser opens `/diagnostics` as a routed modal
above the unchanged workspace, shows summary sections, and preserves the last
good snapshot during an explicit refresh failure. Exact JSON remains hidden
until `Preview export`; only that action enables browser-local `Download JSON`.

## Architecture and boundaries

### Modules touched

- `packages/contracts/src/diagnostics.ts` and contract exports:
  strict schemas, types, enums, caps, and total serialized-size constant.
- `apps/local-server/src/diagnostics.ts`: pure allowlisted projection and
  component-health aggregation.
- `apps/local-server/src/http-server.ts` and integration tests:
  protected read-only route with injected current owners.
- `apps/web/src/transport.ts`: authenticated diagnostics fetch and schema parse.
- `apps/web/src/diagnostics-model.ts`: route and safe filename/download helpers.
- `apps/web/src/diagnostics.tsx`: summary, states, exact preview, and download
  affordance.
- `apps/web/src/app.tsx`, command-palette model, CSS, semantic tests, and one
  Chromium workflow: entry points, history/focus, responsive routed modal.
- Documentation and release evidence.

### Data/state changes

- Entity/schema changes: one response-only diagnostics schema version 1.
- Commands/events: one explicit protected HTTP read and one browser-local file
  download.
- Idempotency: no durable write; snapshot ordering is deterministic and labels
  are local to each export.
- Migration: none.

### Protocol changes

- WebSocket `PROTOCOL_VERSION` remains 24.
- Add one strict HTTP `DiagnosticsSnapshot` schema.
- Bound the response to at most 256 KiB, 100 sanitized session rows, 12
  components, 24 fixed diagnostic-code rows, 16 manifest categories per list,
  and short fixed strings.
- The schema contains no general record, arbitrary diagnostic fields, raw
  content, path, identifier, argv, environment, or extension object.

### Authorization and privilege

- Reuse `authorizeProtectedApi`, the exact Origin/Host/Serve identity checks,
  bearer token, safe Local GET/HEAD and remote POST read method, and empty-body
  rule.
- Add `no-store`; do not expose detailed diagnostics through `/api/health`.
- Builder reads only owners already held by the single local process and calls
  no refresh, discovery, filesystem, Git, provider, queue, or shell operation.

## Projection contract

```text
DiagnosticsSnapshot v1
├── generatedAt
├── application
│   ├── paciumVersion / protocolVersion
│   ├── nodeVersion / platform / architecture
│   └── dependencyVersions
├── overview
│   ├── overall health
│   ├── session totals by process/runtime/preset/provider health
│   └── queue/tmux summaries
├── components[]
│   └── id / state / summary / operatorAction
├── sessions[]
│   └── Terminal N / preset / runtime / process / dimensions / exit /
│       repository-present / provider health+versions
├── diagnostics[]
│   └── component / fixed code / severity / count
└── redactionManifest
    ├── included[]
    └── omitted[]
```

The builder never spreads a source object. Every output field is assigned from
an enum, bounded number, boolean, fixed message, validated version, or count.

## UI behavior and states

- Entry: header `Diagnostics` button and `Open diagnostics` palette command.
- Route: opening pushes `/diagnostics`; browser Back closes it; direct route
  opens it after app bootstrap; Close/Escape returns to `/` and restores focus
  when an invoker exists.
- Loading: compact status and Close.
- Ready: overall status, version facts, component cards, session table, queue/
  tmux summary, redaction manifest, generated time, Refresh.
- Empty: ready state with explicit zero-session and unconfigured/zero-source
  copy.
- Degraded: component state and operator action stay visible without alarm
  color alone.
- Refresh failure: last good data remains, receives a stale/error banner, and
  Retry is available.
- Initial failure/disconnect: no fabricated snapshot; explain that server-owned
  PTYs were not terminated by this browser read.
- Preview: exact pretty JSON in an inert bounded `<pre>`; closing/reloading or a
  new successful refresh resets preview authorization.
- Download: disabled until previewed, uses Blob/ObjectURL, one sanitized
  generated-time filename, and immediate URL revocation.
- Focus: shared modal focus containment; terminal application shortcuts remain
  suspended while the surface is open.

## PTY/process lifecycle

- Diagnostics never creates, inputs, resizes, interrupts, signals, closes, or
  relaunches a PTY.
- Snapshot reads current summaries synchronously; process changes during
  projection produce one bounded point-in-time result.
- Browser route/history, preview, refresh, and download never own process
  lifecycle.

## Reconnect and failure behavior

- The diagnostics route can stay open across transport reconnect.
- The last successful snapshot remains visible and explicitly stale after
  request failure or disconnect.
- A fresh connected read replaces it atomically and clears preview/download
  authorization.
- Late responses carry a browser request generation and cannot replace a newer
  refresh or a closed diagnostics route.
- No request retries automatically and no terminal input is replayed.

## Sequence

1. Commit the issue and plan separately.
2. Add the strict shared diagnostics contract and boundary tests.
3. Add the pure allowlisted server projection and redaction tests.
4. Add the protected HTTP route and Local/Tailscale negative tests.
5. Add the browser fetcher, route model, preview/download helpers, and tests.
6. Add the diagnostics routed modal, header/palette entry, focus/error states,
   styling, and semantic tests.
7. Add one Chromium workflow covering route, refresh, exact preview, download,
   terminal preservation, Back/Escape, and accessibility layouts.
8. Run focused, security, full verify, and complete Chromium gates.
9. Synchronize evidence, mark PC-073 complete, merge into `dev`, and push.

## Failure model

| Failure point                       | Expected state                                              | Recovery                                    |
| ----------------------------------- | ----------------------------------------------------------- | ------------------------------------------- |
| Unauthorized/cross-origin request   | 403, no snapshot                                            | reconnect through accepted Pacium origin    |
| Wrong method or request body        | 405/400, no work                                            | use the fixed browser client                |
| Source state changes mid-build      | one bounded current point-in-time projection                | explicit Refresh                            |
| Projection exceeds a cap            | truncate with count/flag or fail closed before response     | inspect the responsible bounded source      |
| Response fails schema/size          | 500 fixed error, no partial export                          | repair projection and retry                 |
| Browser parse fails                 | last good snapshot retained and marked stale                | Retry after server/browser versions align   |
| Browser disconnects                 | route stays open; terminals remain server-owned             | reconnect, then explicit Retry              |
| Preview not opened                  | Download disabled                                           | open exact preview                          |
| Browser download API fails          | snapshot/preview remain; bounded error says no file written | retry or save manually outside Pacium scope |
| Route closes with request in flight | late result ignored; terminal focus restored                | reopen Diagnostics                          |

## Compatibility

- Supported versions: Node.js 24.18.x; current macOS Apple-silicon target.
- Fallback behavior: missing provider, queue, or tmux capability is explicit
  unavailable/unconfigured evidence, never zero or healthy.
- Rollback: remove response contract, endpoint, modal, and entry actions; no
  persisted state or migration remains.

## Test plan

- Unit: strict schema, caps, enum/state mapping, deterministic ordering,
  export-local labels, aggregate counts, error-code aggregation, truncation,
  route history, safe filename, and download gating.
- Property/fault: hostile content in every source field, duplicate/future
  diagnostics, maximum collections/strings, invalid dates/versions/counts,
  oversized serialization, and late refresh results.
- Contract: exact HTTP Local/Tailscale method, Origin, Host, identity, bearer,
  body, cache, response, and error behavior.
- Integration: live/exited direct/tmux session projections, provider states,
  queue ready/degraded/unconfigured, no source mutation, and no PTY writes or
  signals.
- Browser: header/palette, route/back/Escape, refresh, summary, preview-before-
  download, captured download JSON, retained terminal selection/input, 320 CSS
  px, 200% zoom, forced colors, and reduced motion.
- Security: source fixtures include terminal markers, absolute paths, tokens,
  queue/decision text, Git content, provider text/fields, session IDs, PIDs,
  hostnames, and operator logins; none appears serialized.
- Performance: bounded projection and serialization only; no polling or raw
  buffer traversal.

## Documentation changes

- README diagnostics use/privacy boundary.
- STATUS, backlog, Milestone 5, risk register, observability/security checklist,
  and changelog evidence.
- Issue and plan completion records.

## Rollout

- Development: pure projection and fixtures first.
- Integration: protected endpoint and browser parse.
- Canary: current local macOS UI plus captured browser download.
- Production: no release claim; PC-074 through PC-076 remain.

## Open questions

- None.

## Approval

- Product: authorized by the owner's instruction to continue the remaining
  roadmap.
- Architecture: disposable projection under ADR-0013 through ADR-0015;
  optional remote read follows ADR-0016.
- Security: structurally allowlisted JSON, explicit preview, browser-only save,
  no content capture, and unchanged protected-read authority.

## Completion record

Completed on 2026-07-28 at the PC-073 boundary.

- The strict response-only schema, pure server projection, protected
  `/api/diagnostics` read, browser transport, routed modal, exact JSON preview,
  and browser-local download are implemented.
- The modal keeps last-good evidence on a failed explicit refresh, ignores late
  responses, restores focus only when Diagnostics owned it, and requires an
  explicit Retry when a direct route opened before bootstrap completed.
- The implementation stayed within the planned authority: it projects already
  loaded bounded metadata and performs no PTY, queue, Git, filesystem,
  provider, tmux, persistence, telemetry, or shell action.
- Focused checks passed, supported Node.js 24.18.0 full verification passed 136
  test files and 880 tests, production builds passed, and all 20 Chromium
  workflows passed.
- PC-074 through PC-076 remain open. This completion is not packaging, Linux,
  clean-install, or release-readiness evidence.
