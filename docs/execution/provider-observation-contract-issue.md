# Define the provider observation contract

## Problem

Pacium can identify a Claude Code or Codex launch preset and observe its PTY
process, but it has no bounded contract for provider-native or hook evidence.
The interface therefore cannot describe observer capability, health, freshness,
or activity without either inventing provider state or coupling directly to
version-sensitive vendor payloads.

## Outcome

Every Claude Code or Codex terminal exposes one strict, provider-neutral
observation snapshot. The snapshot keeps capability, adapter health, evidence
source, confidence, freshness, typed provider extensions, and bounded safe
diagnostics distinct. The Activity inspector consumes the contract immediately
and reports that no observer is connected until PC-061 or PC-062 supplies real
evidence.

## Scope

- Add a versioned provider observation schema to `@pacium/contracts`.
- Model Claude Code and Codex capability availability without assuming support.
- Model adapter health independently from terminal process state and attention.
- Model bounded activity facts and optional attention evidence.
- Keep questions and approvals as distinct activity kinds.
- Allow only typed provider extensions and bounded scalar diagnostics.
- Attach the snapshot to Claude Code and Codex session summaries.
- Render provider observer health in the existing Activity inspector.

## Non-scope

- Starting, attaching to, or controlling a provider runtime.
- Installing Claude hooks or starting a Codex App Server.
- Ingesting live Claude or Codex events.
- Answering questions, granting approvals, steering, or interrupting.
- Persisting provider events, transcripts, secrets, or raw payloads.
- Reconstructing conversations or creating generic runs, tasks, or workflows.
- Replacing PTY/process truth or terminal fallback behavior.

## Acceptance criteria

- [x] The contract validates provider, contract/adapter/provider version,
      capability availability, health, source, confidence, and freshness.
- [x] Activity kinds include distinct question and approval observations.
- [x] Claude and Codex extensions are discriminated and cannot be attached to
      the wrong provider.
- [x] Diagnostics are count/size bounded, scalar-only, and reject
      secret-bearing field names.
- [x] Invalid timestamps, duplicate capabilities/activity IDs, oversized
      payloads, and cross-provider data are rejected.
- [x] Shell sessions contain no provider snapshot.
- [x] Claude and Codex sessions begin with an honest observer-unavailable
      snapshot and continue operating as direct PTYs.
- [x] The Activity inspector labels provider observer health without turning an
      unavailable observer into task or attention evidence.
- [x] Existing terminal creation, reconnect, input, resize, and close behavior
      remains unchanged.

## User experience

The Activity inspector adds a compact “Provider observer” evidence source for
Claude Code and Codex terminals. Before a live adapter exists, it reads
“Unavailable” and explains that only process evidence is active. Shell
terminals do not show a provider source. The selected terminal remains usable
regardless of observer health. No approval or question action is exposed in
this issue.

## Architecture

- Systems and modules touched: shared contracts, local session summaries,
  attention/activity projection, existing Activity inspector.
- Systems of record: the PTY remains live process truth; providers remain
  provider-event truth; the snapshot is disposable application projection.
- State transitions: session creation produces either no snapshot (`shell`) or
  an unavailable snapshot (`claude`/`codex`); later observers may replace that
  snapshot through the same validated contract.
- Protocol/schema impact: protocol version increments because
  `SessionSummary` gains nullable `providerObservation`.
- Relevant ADRs: ADR-0003, ADR-0010.

## Security and privacy

- Authorization: no new client command or mutating endpoint.
- Privilege: no new child process, hook, socket, or filesystem privilege.
- Secrets/logging: no transcript, environment, credentials, provider raw
  payload, prompt, or tool input/output enters the contract.
- Abuse/failure scenario: hostile or oversized provider values fail strict
  validation; sensitive diagnostic keys are rejected rather than redacted
  heuristically.

## Reliability

- Idempotency: activity IDs and capability IDs must be unique inside a
  snapshot.
- Timeouts/retries: none; observer startup and retry belong to later issues.
- Restart behavior: direct PTYs retain the existing restart contract; no
  provider state is persisted by this issue.
- Unknown outcome: missing or invalid provider evidence is unavailable, never
  inferred from terminal text.
- Migration/rollback: the protocol version rejects mismatched clients; rollback
  restores the previous session schema.

## Test plan

- Unit: schema bounds, provider matching, duplicate rejection, default
  snapshots, attention projection, activity-source projection.
- Contract: session and server message parsing for shell/Claude/Codex sessions.
- Integration: create each launch preset and assert its exact initial provider
  state while PTY lifecycle remains independent.
- Browser: existing Activity inspector rendering test for unavailable provider
  health and shell omission.
- Failure/recovery: stale evidence reduces to stale attention while failed
  adapter health leaves process truth intact.
- Security: sensitive diagnostic keys, nested/raw values, oversized strings,
  and unrecognized fields are rejected.

## Dependencies

- Blocked by: PC-025, PC-026, PC-027, PC-028, PC-031.
- Blocks: PC-061, PC-062, PC-063, PC-064.

## Evidence required

- Focused contract, local-server, and web tests.
- Full `pnpm verify`.
- Full browser end-to-end suite.
- Exact tested commit and synchronized status/backlog documentation.

## Open questions

- None for this slice. Live adapter transports and supported provider-version
  ranges are deliberately deferred to PC-061 and PC-062.
