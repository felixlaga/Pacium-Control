# PC-064: Implement explicit provider capability degradation

## Problem

Pacium now observes supported Claude Code and Codex sessions and renders clean
activity cards, but provider-health loss is still compressed into one evidence
source row. Unsupported Codex runtime capabilities are reported as merely
unavailable, safe adapter diagnostics are not visible, and a ready snapshot
without provider attention can remain visually ready after its freshness
deadline until another session update happens.

This makes it too difficult to distinguish “no event yet,” “this installed
runtime is unsupported,” “the observer failed,” and “the last native evidence
is stale.” The terminal stays usable in each case, but the interface does not
explain that recovery boundary clearly enough.

## Outcome

Every selected Claude Code or Codex session has one compact provider-status
surface that separates health, freshness, runtime compatibility, capability
availability, safe diagnostics, and terminal process truth. Unsupported,
unavailable, degraded, failed, and stale states use explicit copy and fixed
recovery guidance while preserving the direct PTY and PC-063 terminal fallback.

A browser freshness clock re-evaluates provider expiry without polling the
server. Fresh authenticated evidence restores ready state and removes transient
Codex observer-failure diagnostics.

## Scope

- Distinguish a detected Codex runtime missing required remote/App Server
  capability as `unsupported`, not generic `unavailable`.
- Keep an undetectable/unparseable provider version `unavailable` rather than
  guessing compatibility.
- Mark terminal-breaking observer transport failures as provider `failed` and
  recoverable malformed-event/transport problems as `degraded`.
- Emit only fixed bounded adapter-authored diagnostic codes/messages for
  compatibility and observer failures.
- Clear transient Codex diagnostics after fresh authenticated native evidence.
- Derive snapshot staleness from the snapshot deadline even when no provider
  attention object exists.
- Re-evaluate provider freshness on a bounded browser timer and when the page
  becomes visible, without a server request or terminal read.
- Project provider label, health/freshness, provider and adapter versions,
  observation source/confidence, observed/fresh-until times, all bounded
  capabilities, and safe diagnostic code/message/time.
- Render one compact provider-status section in Activity with explicit
  terminal-survival and fixed recovery guidance.
- Make the PC-063 terminal-fallback reason specific to unsupported,
  unavailable, degraded, failed, or stale provider evidence.
- Preserve narrow, zoomed, keyboard, forced-color, reduced-motion, reconnect,
  and terminal-focus behavior.

## Non-scope

- Starting, restarting, reconnecting, relaunching, steering, interrupting,
  answering, approving, or otherwise controlling a provider.
- Persisting provider observations, capabilities, diagnostics, terminal text,
  environments, credentials, or tokens.
- Showing diagnostic scalar-field values, raw payloads, frames, JSONL,
  prompts, messages, commands, output, diffs, paths, question text, or approval
  reasons.
- Adding a protocol version, server request, browser-to-provider route,
  diagnostics export, global diagnostics screen, logging pipeline, notification,
  or background terminal scan.
- Declaring a universal Claude or Codex semantic version range.
- Packaging a Claude status companion or adding PC-065 relaunch manifests.
- Adding PC-073 diagnostic export or release-support tooling.

## Acceptance criteria

- [x] A capability-probed Codex runtime missing required remote or App Server
      surfaces is explicitly `unsupported`; version detection failure remains
      `unavailable`.
- [x] Fatal Codex observer transport failures become `failed`, recoverable
      invalid events become `degraded`, and neither changes PTY process truth.
- [x] Fresh valid Codex evidence restores `ready` and clears transient
      adapter-failure diagnostics.
- [x] Claude version-detection loss is a fixed bounded diagnostic while valid
      hooks can still become ready.
- [x] Snapshot expiry becomes `stale` even without provider attention, and a
      bounded browser clock refreshes it without network or terminal polling.
- [x] Ready, unavailable, unsupported, degraded, failed, and stale fixtures
      produce deterministic labels, tones, summaries, and recovery copy.
- [x] Provider/adapter versions, source, confidence, timestamps, capability
      availability, and safe diagnostic code/message/time are visible and
      bounded.
- [x] Diagnostic scalar fields and raw provider content are not projected or
      rendered.
- [x] The direct terminal remains available when its process is live; each
      degraded state offers the existing explicit terminal fallback and never
      implies task failure.
- [x] Shell sessions render no provider-status section and retain the existing
      terminal fallback.
- [x] Session change, browser reconnect, provider recovery, 320 CSS px, 200%
      zoom, forced colors, reduced motion, focus, and keyboard behavior remain
      usable.
- [x] Full verification and browser workflows pass without changing protocol
      21, provider-control authority, queue authority, Git authority, terminal
      lifecycle, or Tailscale access.

## User experience

Activity gains a compact `Provider status` section for Claude Code and Codex
sessions. Its header uses one explicit state such as `Ready`, `Unsupported`,
`Degraded`, `Failed`, or `Stale`. The primary sentence says what observer
evidence exists; subdued metadata identifies provider version, adapter
version, source, confidence, and evidence time.

Capabilities are listed as compact rows with `Supported`, `Unsupported`, or
`Unknown` labels and provider-authored fixed detail. Safe diagnostics show only
their severity, code, fixed message, and observation time. No scalar field
value is displayed.

Non-ready states explain that the direct terminal process is independent and
give one fixed next step, such as continuing in Terminal, checking the
installed CLI capability, or relaunching manually after resolving the runtime
problem. PC-063's explicit terminal excerpt stays available with a
state-specific explanation.

## Architecture

- Systems and modules touched: Codex/Claude observation construction, browser
  freshness clock, pure provider-status projection, Activity presentation,
  styles, focused tests, and browser workflow.
- Systems of record: provider events own provider truth; installed CLI probe
  owns compatibility evidence; PTY/session owns process truth; browser owns
  disposable time-based presentation.
- State transitions: unavailable/unsupported -> ready after evidence; ready ->
  stale after deadline; ready/degraded -> failed on fatal transport loss;
  degraded/failed -> ready on fresh authenticated evidence.
- Protocol/schema impact: none; protocol 21 and provider contract version 1
  already model every required state.
- Relevant ADRs: ADR-0003, ADR-0010, ADR-0012, ADR-0013, ADR-0014, ADR-0015.

## Security and privacy

- Authorization: no new client command, server route, provider response, or
  decision action.
- Privilege: capability probes and observer children keep their existing fixed
  executable/argv/local-user boundary.
- Secrets/logging: only existing validated diagnostic code/message/time is
  projected. Diagnostic field values and raw content are deliberately excluded.
- Abuse/failure scenario: hostile strings remain bounded contract data rendered
  as React text; stale presentation never triggers a process or provider action.

## Reliability

- Idempotency: fresh evidence replaces transient observer-health presentation;
  repeated diagnostics remain code-deduplicated by the adapter.
- Timeouts/retries: existing bounded provider probes/transports are unchanged;
  the browser timer only updates a local ISO timestamp.
- Restart behavior: provider state remains process-local and disappears with
  the local server; browser reload reconstructs only the current snapshot.
- Unknown outcome: no event/version evidence stays unavailable or unknown, not
  unsupported or failed.
- Migration/rollback: no durable or protocol migration; remove the projection,
  timer, and refined adapter state mapping to restore current behavior.

## Test plan

- Unit: Codex capability-state mapping, fatal/degraded failure mapping,
  diagnostic recovery, Claude version diagnostic, freshness without attention,
  every provider-status state, capabilities, recovery copy, and field exclusion.
- Contract: protocol remains 21 and existing provider bounds/security tests
  stay green.
- Integration: session updates preserve PTY lifecycle through unsupported,
  degraded, failed, recovered, and stale observer evidence.
- Browser: provider-status hierarchy, capabilities, diagnostics, terminal
  fallback, recovery, reconnect, focus, narrow width, zoom, forced colors, and
  reduced motion.
- Failure/recovery: version probe failure, missing remote surface, malformed
  event, child spawn/exit, stale snapshot, fresh recovery, no selected session,
  and shell session.
- Security: diagnostic field/raw-content exclusion, inert rendering, no new
  request/input/control/persistence path.

## Dependencies

- Blocked by: PC-060, PC-061, PC-062, PC-063.
- Blocks: PC-065 and Milestone 4 exit evidence.

## Evidence required

- Focused adapter, provider-status model, Activity semantic, freshness-clock,
  and session lifecycle tests.
- Browser evidence for all visible states, explicit terminal fallback,
  recovery, and responsive/accessibility behavior.
- Full `pnpm verify` and `pnpm test:e2e`.
- Synchronized backlog, status, README, issue, plan, and changelog at one exact
  tested commit.

## Open questions

- Stable supported provider-version ranges remain intentionally unspecified.
  Capability probing is authoritative for this slice; packaging and manual
  real-provider canaries remain later release gates.

## Completion evidence

- Focused Codex/Claude adapter, provider-status projection, semantic render,
  recent-activity, and freshness-clock coverage passed 81 tests. Fixtures cover
  unsupported versus unavailable capability evidence, degraded versus fatal
  failure, fresh recovery, missing Claude version, every visible state,
  snapshot expiry without attention, terminal independence, fixed recovery,
  hostile text, and diagnostic-field exclusion.
- `pnpm verify` passed formatting, lint, every workspace type check, 125 test
  files and 815 tests, plus the 929.58 kB web JavaScript, 118.08 kB stylesheet,
  and 411.54 kB local-server production bundles.
- `pnpm test:e2e` passed all 16 Chromium workflows. The PC-064 canary launched
  a real Claude Code PTY without sending a prompt, showed eight capability
  rows and current provider status, focused the unchanged terminal, exercised
  explicit fallback and reload invalidation, and remained usable at 320 CSS
  px, 200% zoom, forced colors, and reduced motion.
- Protocol 21, contract version 1, Tailscale authority, queue/Git/verification
  authority, provider decision/control behavior, and durable state are
  unchanged.
- Verification used Node.js 26.4.0 instead of supported Node.js 24.18.x. The
  supported-runtime clean-install and manual live-event provider canaries
  remain release gates.
