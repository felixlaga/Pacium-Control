# PC-073: Bounded redaction-aware diagnostics

## Problem

Pacium exposes focused status inside terminals, Activity, queue, provider, and
tmux surfaces, but an operator cannot inspect one bounded application-health
summary or prepare a safe support artifact. Diagnosing a local failure
currently requires reading several UI areas and risks reaching for terminal
output, environment data, paths, queue text, or provider payloads that do not
belong in a support bundle.

## Outcome

One explicit Diagnostics surface summarizes application versions, component
health, sanitized PTY/session state, provider status, queue status, optional
tmux capability, and recent fixed diagnostic codes. The operator must preview
the exact versioned JSON before a browser-local download becomes available.
The snapshot and export contain a machine-checkable redaction manifest and no
terminal contents, environment values, paths, credentials, queue text, Git
content, provider content, or operator identity.

## Scope

- Add one strict versioned diagnostics contract with fixed collection and
  string bounds.
- Build diagnostics from current server-owned session, queue, launch-preset,
  tmux, runtime, and fixed diagnostic evidence.
- Publish one token-protected read-only `/api/diagnostics` endpoint with the
  existing Local/Tailscale protected-read boundary.
- Add a dedicated `/diagnostics` UI reachable from the header and command
  palette without remounting or changing any terminal.
- Cover loading, ready, degraded, empty, refresh, disconnect, and failure
  states.
- Require an explicit exact-JSON preview before browser-local download.
- Record every included category and every intentionally omitted sensitive
  category in the export.

## Non-scope

- Production telemetry, background monitoring, log shipping, crash reporting,
  metrics storage, or an incident-management system.
- Terminal scrollback, terminal titles, input, prompts, transcripts, queue
  contents, diffs, commit messages, provider messages, tool payloads, raw
  events, environments, credentials, paths, session IDs, PIDs, hostnames, or
  operator login values.
- A server-side support-bundle file, archive, upload, email, clipboard write,
  or automatic report.
- Generic log viewing, arbitrary filesystem reads, command execution, provider
  probing, Git refresh, queue refresh, or health polling.
- Packaging, Linux validation, or release-readiness sign-off.

## Acceptance criteria

- [x] A strict version-1 contract caps component, session, diagnostic, version,
      manifest, and serialized-response size and rejects extra fields.
- [x] The snapshot includes Pacium/protocol/runtime/dependency versions,
      platform capability, component health, sanitized PTY/session state,
      provider health, queue status, optional tmux status, and fixed diagnostic
      code counts.
- [x] Session rows use generated export-local labels and never expose immutable
      session IDs, names, cwd/repository/path data, PID, command argv,
      relaunch metadata, terminal bytes, or provider activity content.
- [x] Queue evidence is count/status/type/conflict metadata only and excludes
      source IDs, paths, hashes, decisions, notes, answers, delivery targets,
      and source text.
- [x] Provider evidence is availability/health/version/count metadata plus
      fixed adapter-authored diagnostic codes only; raw and scalar diagnostic
      fields, activities, prompts, messages, plans, commands, paths, and tokens
      are excluded.
- [x] `/api/diagnostics` requires the exact protected Origin/Host/access-token
      boundary, accepts only the existing safe read method for Local or
      Tailscale access, rejects a body, sends `no-store`, and makes no mutation.
- [x] Diagnostics open from both the header and command palette at
      `/diagnostics`, preserve terminal process/layout/selection/input state,
      and return focus predictably.
- [x] Loading, ready, unavailable, degraded, empty, refresh-failure, and
      disconnected states say which terminal processes survived and what the
      operator can do.
- [x] Download remains unavailable until the operator opens the exact inert JSON
      preview; the eventual download is created only in the browser.
- [x] The redaction manifest lists included and omitted categories, and tests
      scan serialized fixtures for representative paths, tokens, terminal
      markers, queue text, Git content, provider content, IDs, PIDs, hostnames,
      and operator identity.
- [x] Full verification and all Chromium workflows pass.

## User experience

The header and command palette expose `Diagnostics`. Opening it uses a calm
full-height modal route above the unchanged terminal workspace. The first view
shows a compact health summary, versions, components, sanitized session rows,
queue/tmux state, and the redaction boundary. `Refresh` performs one explicit
read. `Preview export` reveals the exact inert JSON and enables `Download JSON`.

Loading uses one status message. Empty state explains that no active sessions
or queue sources is valid. A failed refresh keeps the last successful snapshot
visible but marks it stale. A disconnect or initial failure explains that
running PTYs remain owned by the local server and offers Retry after the
connection recovers. `Escape`, Close, and browser Back return to the prior
workspace focus without sending terminal input. The surface remains usable at
320 CSS pixels, 200% zoom, forced colors, and reduced motion.

## Architecture

- Systems and modules touched: shared diagnostics contract, local diagnostics
  builder, protected HTTP route, browser transport, diagnostics route/modal,
  header, command palette, styles, tests, and execution evidence.
- Systems of record: SessionManager owns current PTY metadata; providers own
  validated observations; QueueObserver owns disposable queue observation;
  tmux capability owns optional runtime status. Diagnostics is a bounded
  disposable projection and never becomes authoritative.
- State transitions: closed -> loading -> ready/degraded/error -> previewed ->
  downloaded locally; refresh never clears the last good snapshot first.
- Protocol/schema impact: one HTTP response schema; WebSocket protocol and
  terminal messages are unchanged.
- Relevant ADRs: ADR-0013, ADR-0014, ADR-0015, ADR-0016.

## Security and privacy

- Authorization: existing exact Local/Tailscale protected-read and bearer-token
  boundary; no public health detail.
- Privilege: read-only projection of already loaded bounded metadata; no new
  filesystem, shell, Git, provider, queue, or tmux action.
- Secrets/logging: export is never logged or persisted server-side; redaction
  is structural allowlisting rather than best-effort string replacement.
- Abuse/failure scenario: strict bounds and schema validation prevent a large
  support artifact; hostile loaded names/content never enter the projection;
  browser download requires a deliberate preview action.

## Reliability

- Idempotency: repeated reads create equivalent current projections aside from
  generated time and export-local session numbering.
- Timeouts/retries: no background polling; explicit refresh uses normal HTTP
  failure handling and no hidden retry.
- Restart behavior: diagnostics rebuilds from current process-owned state;
  downloaded files are outside Pacium state.
- Unknown outcome: missing/unconfigured capability is explicit and distinct
  from healthy or zero.
- Migration/rollback: no persisted schema; remove the endpoint/surface and
  contract without state migration.

## Test plan

- Unit: schema bounds/refinements, component derivation, aggregate counts,
  export-local labels, ordering, truncation, fixed code aggregation, redaction
  manifest, and hostile-field exclusion.
- Contract: exact diagnostics route method/auth/body/cache/schema behavior.
- Integration: current SessionManager/QueueObserver/tmux/provider projection
  without mutations or terminal input.
- Browser: header/palette route, summary, explicit refresh, preview-before-
  download, stale last-good failure, focus/back/Escape, unchanged terminal,
  narrow layout, zoom, forced colors, and reduced motion.
- Failure/recovery: disconnected, unavailable, degraded, no sessions, no queue,
  malformed response, and refresh failure.
- Security: serialized secret/content canaries and route Host/Origin/token/
  remote-identity negative cases.

## Dependencies

- Blocked by: PC-072 and existing session/provider/queue/tmux evidence.
- Blocks: PC-074 through PC-076.

## Evidence required

- Focused contract, builder, HTTP, transport, semantic-render, and route tests.
- One Chromium workflow exercising preview and a browser-local download without
  changing terminal state.
- Full verification counts, bundle sizes, and complete Chromium count.
- Current status, backlog, milestone, risk, security checklist, and changelog
  synchronized.

## Open questions

- None. The first slice is JSON-only and structurally redacted; archives,
  uploads, raw logs, and opt-in content remain out of scope.

## Completion evidence

Completed on 2026-07-28.

- Focused contract and projection tests passed 8 checks; protected Local and
  Tailscale endpoint tests passed both targeted workflows; browser transport,
  model, semantic-render, and palette tests passed 43 checks.
- Hostile fixtures proved structural exclusion of terminal/provider/queue/Git
  content, credentials, paths, IDs, PIDs, commands, host details, and relaunch
  metadata from serialized snapshots.
- The dedicated Chromium workflow parsed the actual browser-local download,
  preserved one live PTY through Back, Escape, direct routing, and browser
  reload, retained last-good evidence after a failed refresh, and covered 200%
  zoom, forced colors, reduced motion, and explicit fixture cleanup.
- Supported Node.js 24.18.0 `pnpm verify` passed 136 test files and 880 tests;
  production bundles were 967.16 kB web JavaScript, 128.54 kB CSS, and
  478.21 kB local-server JavaScript. All 20 Chromium workflows passed.
- WebSocket protocol remains 24. No database, persisted diagnostic state,
  server export, telemetry, provider probe, filesystem read, terminal input,
  process signal, or command endpoint was added.
