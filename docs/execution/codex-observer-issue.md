# Implement the Codex native observer

## Problem

Pacium launches Codex in a direct PTY, but Codex sessions still expose only
process evidence. The operator cannot reliably distinguish an active turn,
tool work, a plan update, an approval, a question, completion, usage, or a
runtime failure without reading terminal text.

The current Codex App Server is the supported rich-client interface for
streamed runtime events. Its WebSocket transport is explicitly experimental,
and its messages can contain prompts, agent text, commands, diffs, paths, tool
payloads, and credentials that Pacium must forward to the terminal client
without storing or rendering as observer metadata.

## Outcome

A supported Codex CLI launched by Pacium keeps its terminal UI in the direct
PTY while connecting through a session-scoped, authenticated loopback bridge
to a private App Server child over JSONL stdio. Pacium forwards protocol
messages unchanged and projects only bounded event type, identity, status,
usage, and timing metadata into the existing provider snapshot and Activity
inspector.

## Scope

- Detect the installed Codex CLI version and required `app-server`,
  `--remote`, and remote-token capabilities with fixed executable calls.
- Register only Pacium-launched Codex sessions.
- Generate one random 256-bit bridge token per session and pass it only through
  that PTY's bounded environment.
- Launch one exact `codex app-server --listen stdio://` child per connected
  observed session.
- Bridge one authenticated Codex TUI WebSocket to the child's JSONL stdin and
  stdout without modifying valid messages.
- Bound frame, line, queue, connection, child-process, and shutdown behavior.
- Normalize thread/turn/item/plan/usage/error notifications plus approval and
  user-input server requests.
- Keep questions and approvals distinct.
- Preserve exact provider thread, turn, and item identifiers only within
  existing contract bounds.
- Project capability, health, source, confidence, freshness, activity, and
  attention through protocol 21.

## Non-scope

- Starting turns, sending prompts, steering, interrupting, answering questions,
  approving actions, or responding to any App Server request.
- Parsing agent messages, commands, command output, diffs, plans, question
  text, approval reasons, or tool payloads.
- Attaching to externally launched Codex sessions or a shared App Server
  daemon.
- Public, tailnet, or browser access to the provider bridge.
- Persisting raw frames, JSONL, provider credentials, observations, or
  transcripts.
- Declaring the experimental WebSocket protocol stable across Codex versions.
- Replacing the direct PTY with a browser-native Codex chat client.

## Acceptance criteria

- [x] Unsupported or unavailable App Server capability leaves the ordinary
      direct Codex launch unchanged and observer-unavailable.
- [x] A supported Pacium-created Codex session receives an exact local bridge
      URL and the name of a session-scoped token environment variable; the
      token never appears in argv or provider snapshots.
- [x] The bridge requires one live registered session, exact loopback Host,
      no Origin, exact UUID path, a valid bearer token, and bounded text
      WebSocket frames.
- [x] Exactly one active TUI connection can own a session bridge, and browser
      or remote-shaped upgrades are rejected.
- [x] The private App Server child receives and emits newline-delimited
      messages unchanged; malformed or oversized lines fail closed without raw
      logging or unbounded buffering.
- [x] Thread, turn, item, plan, usage, error, approval, and question fixtures
      produce honest source-labelled activity, attention, health, freshness,
      and capability evidence.
- [x] Prompts, agent text, plans, commands, output, diffs, paths, questions,
      approval reasons, tool payloads, auth data, and raw frames never enter
      provider snapshots or browser facts.
- [x] App Server exit, transport loss, duplicate events, provider-ID drift,
      PTY exit, close, and local-server shutdown release resources and report
      bounded failure or stale evidence honestly.
- [x] The observer never emits a JSON-RPC response or decision on behalf of the
      operator.
- [x] Shell and Claude launch/observation behavior is unchanged.
- [x] Browser refresh preserves current process-local Codex evidence while the
      PTY and local server remain alive.

## User experience

The Codex terminal remains the primary surface and behaves like the ordinary
Codex TUI. Activity moves from Unavailable to Ready only after authenticated
native evidence. Short facts include “Turn started,” “Tool started,” “Plan
updated,” “Approval requested,” “Question asked,” “Usage updated,” “Turn
completed,” and “Provider failure observed,” with Native source and confirmed
confidence.

If capability probing, the private App Server, or the bridge fails, the
observer row explains the bounded failure while Pacium preserves honest PTY
process state. No approval or question action is added.

## Architecture

- Systems and modules touched: provider contract, Codex capability probe,
  observer/normalizer, child-process transport, HTTP upgrade routing, session
  lifecycle, PTY environment, Activity projection and tests.
- Systems of record: App Server events own provider truth; the direct PTY owns
  terminal/process truth; the bridge and provider snapshot are disposable.
- State transitions: unavailable -> bridge prepared -> App Server connected ->
  native event/ready -> attention/activity updates -> transport failure or
  session completion.
- Protocol/schema impact: protocol 21 adds bounded Codex usage fields.
- Relevant ADRs: ADR-0003, ADR-0010, ADR-0012, ADR-0013, ADR-0014, ADR-0015.

## Security and privacy

- Authorization: independent random bearer token per Codex session; never the
  browser bootstrap token or a Codex upstream credential.
- Privilege: only the fixed installed Codex executable and fixed App Server
  argv are spawned with the local user's existing authority.
- Secrets/logging: bridge frames, JSONL lines, prompts, output, environments,
  tokens, and payloads are not logged or persisted.
- Abuse/failure scenario: browser/remote upgrades, extra clients, binary or
  oversized frames, oversized JSONL, malformed JSON, response spoofing, child
  floods, and cross-thread events are rejected, bounded, ignored, or fail the
  observer without inventing provider state.

## Reliability

- Idempotency: bounded native event fingerprints suppress duplicate Activity
  facts.
- Timeouts/retries: capability probes are bounded; App Server startup and
  connection have bounded deadlines; no hidden provider-request retry or
  response is introduced.
- Restart behavior: bridge children, tokens, and observations disappear with
  the local server; direct PTYs retain the existing server-restart limitation.
- Unknown outcome: missing or unsupported native evidence remains unavailable
  or stale, never terminal-inferred.
- Migration/rollback: protocol 21 is the client/server boundary; disabling the
  adapter restores the current direct Codex launch.

## Test plan

- Unit: capability/version parsing, token/settings preparation, strict native
  schemas, normalization, deduplication, bounds, attention and usage.
- Contract: typed Codex usage extension and protocol 21.
- Integration: upgrade Host/Origin/path/token/frame checks, exact bidirectional
  forwarding, child exit/backpressure, WebSocket session updates, cleanup.
- Browser: existing Activity semantics, terminal independence, refresh and
  responsive workflows.
- Failure/recovery: unsupported capability, spawn failure, malformed/oversized
  messages, duplicate/foreign IDs, disconnect, PTY exit and shutdown.
- Security: raw prompt/agent/plan/command/output/diff/path/question/approval/
  credential exclusion and no generated JSON-RPC decisions.

## Dependencies

- Blocked by: PC-025, PC-028, PC-060.
- Blocks: PC-063, PC-064, PC-065.

## Evidence required

- Generated-schema provenance for the tested Codex CLI version.
- Focused contract, normalizer, child bridge, session-manager, HTTP upgrade,
  web model, and semantic rendering tests.
- Full `pnpm verify`.
- Full browser end-to-end suite.
- Exact tested commit and synchronized backlog/status/changelog.

## Open questions

- The App Server WebSocket surface is experimental. PC-064 must own explicit
  unsupported-version and degraded-capability presentation rather than
  silently assuming forward compatibility.

## Completion evidence

- Codex CLI `0.145.0` supplied the generated JSON schema and exact capability
  evidence used by the fixture-driven adapter. Capability support is probed at
  startup rather than inferred from that version.
- Focused contract, normalizer, observer, bridge, session lifecycle, HTTP
  upgrade, reconnect, and Activity tests passed, including content exclusion,
  exact forwarding, one-client authorization, oversized input, child exit, PTY
  release, and browser refresh.
- `pnpm verify` passed 121 test files and 766 tests plus all formatting, lint,
  type-check, and production-build gates.
- `pnpm test:e2e` passed all 14 Chromium workflows.
- No real-provider prompt was sent and no user Codex configuration was changed,
  so a manual live-provider canary remains an explicit external gate.
