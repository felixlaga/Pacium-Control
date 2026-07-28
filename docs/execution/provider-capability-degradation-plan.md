# Implementation plan: Explicit provider capability degradation

- Issue:
  [PC-064](provider-capability-degradation-issue.md)
- Owner: Codex
- Agent/session: primary implementation agent
- Branch: `codex/provider-capability-degradation`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `82cfa7aa6bd1841af750d0599067c1acac06a334`
- Target milestone: Epic 5 / PC-064
- Status: Complete

## Objective

Make provider compatibility, observer health, freshness, capabilities, and safe
diagnostics directly understandable without weakening the direct-terminal
fallback. Unsupported or failed native enrichment must be obvious, recoverable,
and independent from PTY and task truth.

## Existing behavior

- Protocol 21 already carries provider health states, typed capabilities,
  versions, source/confidence/freshness, and bounded scalar diagnostics.
- Codex capability probes distinguish version, remote-option, and App Server
  listener failures internally, but all three currently produce
  `health.state: unavailable`, unknown capabilities, and no diagnostic.
- Codex invalid events and all transport failures currently become `degraded`;
  a later valid event restores `ready` but can leave transport diagnostics.
- Claude version detection can be null but produces no visible diagnostic.
- Activity compresses provider health, confirmed-capability count, version, and
  freshness into one evidence-source sentence. Diagnostic codes/messages and
  individual capabilities are not rendered.
- Snapshot staleness is exposed only when provider attention wins the attention
  reducer. A ready snapshot with no attention does not become visibly stale
  after its own deadline.
- PC-063 provides an explicit bounded browser-local terminal excerpt whenever
  provider evidence is not ready, but its reason is generic.

## Proposed behavior

The adapters author deterministic compatibility and failure evidence within the
existing strict contract:

```text
Codex version probe missing       -> unavailable + unknown capabilities
Codex remote/App Server missing   -> unsupported + unsupported capabilities
Codex malformed known event       -> degraded + warning diagnostic
Codex child/spawn/stdio failure   -> failed + error diagnostic
Fresh authenticated Codex event   -> ready + transient diagnostics cleared
Claude version probe missing      -> unavailable/ready as events dictate
                                     + fixed version diagnostic
```

A pure browser projection receives the current ISO time and produces one
provider-status view model. Snapshot expiry takes precedence over `ready` but
does not erase an explicit unavailable, unsupported, degraded, or failed
health state. The projection includes only:

- provider and state labels/tone;
- fixed health and recovery copy;
- provider/adapter version, source, confidence, observed/fresh-until times;
- every bounded capability ID, availability, source, confidence, and fixed
  detail;
- diagnostic severity, code, fixed message, and observation time.

Diagnostic field values are deliberately omitted. A 30-second browser clock,
refreshed immediately on visibility restoration, recomputes attention and
provider presentation only; it performs no server request or terminal read.

Activity renders the projection as one compact semantic section. A button
focuses the existing terminal; no provider action is added. PC-063 fallback
copy identifies the exact non-ready state and remains explicit, bounded,
browser-local, and non-authoritative.

## Architecture and boundaries

### Modules touched

- `apps/local-server/src/codex-observer.ts`: unsupported/failure mapping,
  fixed diagnostics, and recovery clearing.
- `apps/local-server/src/claude-observer.ts`: fixed missing-version diagnostic.
- `apps/web/src/provider-status-model.ts`: pure bounded provider-state
  projection and recovery copy.
- `apps/web/src/provider-status.tsx`: semantic compact provider-status surface.
- `apps/web/src/recent-activity-model.ts`: current-time snapshot staleness and
  state-specific terminal-fallback reason.
- `apps/web/src/app.tsx`: bounded presentation freshness clock and existing
  terminal-focus action.
- Existing styles, focused adapter/model/component tests, and Playwright
  Activity workflow.

### Data/state changes

- Entity/schema changes: none; existing provider contract fields are sufficient.
- Commands/events: none; clock ticks and terminal focus stay browser-local.
- Idempotency: adapter diagnostics remain code-deduplicated; fresh Codex
  evidence clears transient diagnostics once.
- Migration: none.

### Protocol changes

- Protocol remains 21.
- Provider observation contract remains version 1.
- No new client/server message, route, diagnostic field, or persisted state.

### Authorization and privilege

- Browser receives only existing validated session snapshots.
- Provider-status actions can only focus the selected existing xterm.
- No provider token, browser token, executable, argv, path, payload, command,
  terminal input, response, approval, or answer crosses this UI callback.
- Existing fixed local capability probes and private observer transports are
  unchanged.

## Sequence

1. Commit the PC-064 issue and implementation plan separately.
2. Refine Codex compatibility/failure/recovery states and fixed diagnostics.
3. Add Claude missing-version diagnostic and recovery tests.
4. Build the pure provider-status/freshness projection with exhaustive state,
   capability, diagnostics, and raw-field exclusion tests.
5. Add the bounded browser freshness clock and snapshot-level stale derivation.
6. Render the compact provider-status section and state-specific terminal
   fallback.
7. Add responsive, forced-color, reduced-motion, focus, and semantic evidence.
8. Add a browser workflow using a real provider launch's current compatibility
   evidence without sending a prompt or exposing a token.
9. Synchronize docs, run every gate at exact head, fast-forward `dev`, and push.

## Failure model

| Failure point                     | Expected state                                             | Recovery                                                |
| --------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| Provider version probe fails      | Unavailable; version unknown; PTY unchanged                | Check installed CLI from Terminal, then launch manually |
| Codex required option missing     | Unsupported; all adapter capabilities unsupported          | Upgrade/change Codex, then create a new session         |
| No authenticated event yet        | Unavailable; capabilities unknown                          | Continue in Terminal or wait for native evidence        |
| Known event is malformed          | Degraded with fixed warning; previous facts retained       | Later valid evidence restores ready                     |
| App Server child/stdio fails      | Failed with fixed error; direct PTY truth remains separate | Inspect Terminal and installed runtime                  |
| Snapshot deadline passes          | Ready projection becomes stale; no task inference          | Wait for fresh evidence or use Terminal fallback        |
| Fresh Codex event follows failure | Ready; transient diagnostics cleared                       | Continue normal observation                             |
| Browser hidden or suspended       | Immediate time refresh when visible                        | No server/process action                                |
| Diagnostic contains scalar fields | Code/message/time only; field values omitted               | Use future PC-073 export if explicitly implemented      |
| Component or browser reloads      | Projection rebuilt from current server snapshot            | PTY continues under existing lifecycle contract         |

## Compatibility

- Supported versions: capability-probed. Codex fixture schemas remain generated
  from CLI 0.145.0; no universal version range is declared.
- Fallback behavior: direct PTY plus process evidence and PC-063 explicit
  browser-local terminal excerpt.
- Rollback: restore current adapter health mapping, remove the pure projection,
  clock, and status section; no server or state migration is required.

## Test plan

- Unit: exact Codex reason/state/capability/diagnostic mapping, fatal versus
  degraded errors, recovery clearing, Claude missing-version diagnostic, every
  browser health/freshness state, capability order/labels, fallback reasons,
  and field exclusion.
- Property/fault: invalid times, boundary equality, duplicate diagnostic codes,
  maximum capability/diagnostic counts, hostile fixed strings, long versions,
  and clock visibility changes.
- Contract: existing provider schema, protocol 21, raw-content rejection, and
  provider matching remain green.
- Integration: observer updates through session summaries while PTY
  process/lifecycle fields remain unchanged.
- Browser: real supported/unavailable provider launch, Provider status,
  terminal focus/fallback, refresh/reconnect, 320 CSS px, 200% zoom, forced
  colors, and reduced motion.
- Security: no diagnostic field values, raw payload, token, provider content,
  persistence, network mutation, terminal input, or decision action.
- Performance: one 30-second time tick, at most 12 capabilities and 8
  diagnostics for one selected session, no polling or background xterm read.

## Documentation changes

- Mark PC-064 complete only after exact evidence passes.
- Update `STATUS.md`, `README.md`, `CHANGELOG.md`, and the implementation
  backlog.
- Keep PC-065 relaunch manifests and PC-073 diagnostic export explicitly open.

## Rollout

- Development: deterministic adapter and pure-view fixtures.
- Integration: current local server/session manager with fake native events.
- Canary: real local provider launch without sending a prompt, exposing a
  token, or changing provider configuration.
- Production: no release claim; relaunch, durability, packaging, supported
  runtime, manual provider, and real Tailscale gates remain open.

## Open questions

- A future packaged compatibility matrix may add declared provider version
  ranges only after manual canaries and release policy exist. PC-064 relies on
  capability evidence and does not guess.

## Approval

- Product: PC-064 is the next accepted dependency-ordered backlog item and
  improves oversight without adding workflow complexity.
- Architecture: provider-native enrichment remains optional and PTY truth stays
  primary.
- Security: existing bounded contract only, field-value exclusion, no new
  authority, storage, or transport.

## Result

PC-064 is complete. Codex compatibility probes now distinguish unsupported
runtime capabilities from unavailable version evidence; recoverable malformed
events, fatal observer failures, and fresh recovery have separate health and
diagnostic states. Claude version uncertainty is visible without disabling
valid hook observation.

Activity now presents health/freshness, provider and adapter versions,
source/confidence, all bounded capabilities, safe diagnostic code/message/time,
terminal independence, and fixed recovery guidance. Diagnostic scalar fields
are excluded. A 30-second browser-only clock plus visibility refresh expires
ready snapshots even without provider attention and performs no server or xterm
poll.

Focused evidence passed 81 tests. Full `pnpm verify` passed 125 test files and
815 tests plus production builds, and all 16 Chromium workflows passed. A real
Claude Code PTY canary sent no prompt and verified terminal focus, explicit
fallback, reload clearing, narrow width, zoom, forced colors, and reduced
motion. PC-065 relaunch manifests and PC-073 diagnostic export remain outside
this completed slice.
