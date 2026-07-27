# Implement the Claude Code observer

## Problem

Pacium can launch Claude Code in a direct PTY and now has a strict provider
observation contract, but every Claude terminal remains observer-unavailable.
Process liveness cannot show whether Claude is handling a prompt, running a
tool, asking a question, awaiting approval, completing a turn, or failing.

Claude Code exposes structured lifecycle hooks and status-line snapshots, but
both are version-sensitive and contain untrusted fields that Pacium must not
store or interpret as shell commands. Hook responses can also affect Claude, so
an observation integration must stay silent and non-authoritative.

## Outcome

A Claude Code terminal launched by Pacium receives session-scoped,
server-generated HTTP hooks. Valid authenticated hook events update the
existing provider snapshot and Activity inspector without changing PTY
operation or returning decisions to Claude. A strict status-snapshot parser and
authenticated ingestion path can add bounded usage/version evidence when an
operator explicitly connects a status-line command; Pacium does not replace an
existing status line automatically.

## Scope

- Detect and record the installed Claude Code version with a bounded exact
  executable call.
- Add session-scoped HTTP hook settings only to Pacium-launched Claude Code.
- Generate one random hook token per Claude session and pass it only in that
  PTY environment.
- Receive hooks on an exact loopback Host/path with bearer authentication,
  JSON content type, and a fixed body ceiling.
- Normalize SessionStart, UserPromptSubmit, PreToolUse, PermissionRequest,
  PostToolUse, PostToolUseFailure, Notification, Stop, StopFailure, and
  SessionEnd.
- Keep approval requests and questions distinct.
- Normalize bounded Claude status version, model, context, cost, and token
  totals through a separate authenticated status path.
- Project source-labelled attention, activity, capability, health, freshness,
  and safe diagnostics through protocol 20.
- Preserve a bounded in-memory recent event list and deduplicate exact hook
  deliveries.

## Non-scope

- Returning allow, deny, block, retry, context, or any other hook decision.
- Reading transcripts, prompts, tool inputs/outputs, full environments, or
  provider credentials.
- Installing user/project hooks or editing Claude settings files.
- Replacing or wrapping an operator's existing status-line command.
- Sending prompts, answering questions, approving actions, steering,
  interrupting, resuming, or controlling Claude.
- Claiming provider receipt for Pacium queue delivery.
- Persisting provider observations across local-server restart.
- Supporting arbitrary externally launched Claude sessions.

## Acceptance criteria

- [ ] Only a Pacium-created live Claude session with its exact random token can
      submit hook or status observations.
- [ ] Hook requests require POST, exact loopback Host, no Origin, JSON content
      type, a canonical session UUID path, and a bounded body.
- [ ] Every hook response is a 2xx empty/no-decision response after successful
      observation; ingestion failure is non-authoritative and cannot approve or
      block Claude.
- [ ] Unknown, malformed, oversized, mismatched-session, and duplicate inputs
      fail safely without terminal interruption or raw-payload retention.
- [ ] Prompt text, transcript paths, tool input/output, environments, and
      credentials never enter provider snapshots, diagnostics, or logs.
- [ ] Supported hook fixtures produce honest activity and attention for start,
      prompt, tool, approval, question, completion, and failure.
- [ ] Status fixtures produce bounded usage/version evidence without storing
      repository, transcript, or session-name content.
- [ ] Capabilities remain unknown until matching evidence arrives, and observer
      health/freshness degrades honestly.
- [ ] Shell and Codex launch behavior is unchanged.
- [ ] Browser refresh preserves current process-local Claude evidence while the
      local server is alive.

## User experience

The selected Claude terminal remains the primary surface. In Activity, the
Claude observer moves from Unavailable to Ready after its first valid hook.
Structured facts use short labels such as “Tool started,” “Approval requested,”
“Question asked,” and “Turn completed.” The attention card identifies hook
evidence and its confidence. If hooks are blocked, stale, unsupported, or fail,
the observer row explains the degraded state while terminal input/output stays
available.

No browser approval or question action is added in this issue.

## Architecture

- Systems and modules touched: provider contract, launch preparation, PTY
  environment boundary, Claude observer service, loopback HTTP routing,
  session updates, Activity projection and tests.
- Systems of record: Claude hooks/status own provider evidence; PTY owns
  process truth; the observer snapshot is disposable.
- State transitions: prepared/unavailable -> first valid hook/ready -> event
  attention/activity updates -> stale/degraded or session completion.
- Protocol/schema impact: protocol 20 extends typed Claude activity usage data.
- Relevant ADRs: ADR-0003, ADR-0010.

## Security and privacy

- Authorization: independent 256-bit per-session bearer token; never the
  browser bootstrap token.
- Privilege: hook configuration is fixed server JSON passed as Claude argv; no
  user path or shell command is interpolated.
- Secrets/logging: tokens and payload bodies are not logged; sensitive fields
  are discarded before normalization.
- Abuse/failure scenario: remote/browser requests, replay floods, oversized
  nesting, unknown events, and cross-session provider IDs are rejected or
  bounded; hook failure remains non-blocking in Claude.

## Reliability

- Idempotency: exact event fingerprints are retained in a bounded process-local
  set and duplicate delivery does not add a second activity.
- Timeouts/retries: Claude HTTP hooks use a one-second timeout; provider docs
  define connection/non-2xx/timeout failures as non-blocking.
- Restart behavior: observations and tokens disappear; Pacium direct PTYs keep
  the existing server-restart limitation.
- Unknown outcome: missing hook evidence never becomes a provider claim.
- Migration/rollback: protocol 20 is the client/server boundary; removing hook
  argv returns Claude launches to terminal/process-only observation.

## Test plan

- Unit: version parsing, settings generation, hook/status schemas,
  normalization, deduplication, bounds, attention, capability and health.
- Contract: typed Claude extensions/usage and protocol 20.
- Integration: HTTP method/Host/Origin/token/content-type/body/session checks;
  WebSocket session update after accepted hooks.
- Browser: Activity semantic rendering and existing refresh workflows.
- Failure/recovery: unknown event, malformed/oversized input, stale token,
  duplicate event, observer release, PTY exit, unavailable hook.
- Security: prompt/tool/transcript/environment/token exclusion and no decision
  response fields.

## Dependencies

- Blocked by: PC-025, PC-028, PC-060.
- Blocks: PC-063, PC-064, PC-065.

## Evidence required

- Focused contract, observer, session-manager, HTTP boundary, web model, and
  rendering tests.
- Full `pnpm verify`.
- Full browser end-to-end suite.
- Exact tested commit and synchronized backlog/status/changelog.

## Open questions

- A packaged, non-destructive status-line companion command remains a PC-065
  packaging decision. PC-061 accepts and validates status snapshots but does
  not replace the operator's single configured status line.
