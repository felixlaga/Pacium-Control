# PC-030: Evidence-labelled process and agent detection

## Problem

Pacium launches fixed Shell, Codex, and Claude Code presets but exposes only a
display-oriented command label. The UI cannot distinguish a confirmed
server-owned launch classification from later process, hook, native-provider,
terminal, or human observations. This blocks honest attention-state work and
makes the inspector’s “agent context” a placeholder.

## Outcome

Every terminal session carries a bounded agent classification with type,
display label, source, confidence, and observation time. The initial
implementation derives confirmed classifications only from the exact
server-owned launch preset used to create the PTY. The inspector explains this
evidence and explicitly separates it from activity or attention claims.

## Scope

- Add strict shared schemas for Shell, Codex, Claude Code, and unknown agent
  types.
- Add classification source, confidence, and observed-at evidence to every
  session summary.
- Derive initial classification from the server-owned launch preset at PTY
  creation.
- Advance the transport protocol because session summaries gain required wire
  fields.
- Show type and evidence in the selected-session inspector.
- Give session rows a concise accessible name that includes classification and
  process state.
- Add contract, launch-definition, session-manager, and rendered-UI tests.

## Non-scope

- Inferring “working,” “waiting,” “needs input,” or any other attention state.
- Inspecting arbitrary process trees or terminal output.
- Claude hooks, Codex App Server, provider versions, or native capabilities.
- User-defined launch presets.
- Attaching or adopting externally launched processes.
- Notifications, unread state, Git inspection, Pacium mode, or queue behavior.

## Acceptance criteria

- [ ] Every new session includes a strict classification with type, label,
      source, confidence, and observation time.
- [ ] Shell, Codex, and Claude Code fixed presets map deterministically to their
      matching types.
- [ ] Initial classification is labelled `launch_preset` and `confirmed`.
- [ ] A live process is never labelled “working” by this feature.
- [ ] The inspector exposes classification source and confidence without
      relying on color.
- [ ] Session-row accessible names include classification and process state.
- [ ] Unknown or extra classification fields fail protocol validation.
- [ ] Protocol compatibility changes are explicit and tested.
- [ ] The full repository verification gate passes.

## User experience

The selected-session inspector replaces the placeholder agent card with a
compact evidence block such as “Codex CLI · Launch preset · Confirmed.” Supporting
copy says that Pacium knows what it launched but has not yet observed provider
activity. Session rows remain visually calm while their accessible names include
the same classification and current process state.

## Architecture

- Systems and modules touched: shared protocol schemas, launch-preset
  definitions, session manager, inspector/session-row rendering, fixtures and
  tests.
- System of record: the immutable launch preset selected and resolved by the
  local server.
- State transitions: classification is created with the session and does not
  change in this slice.
- Protocol/schema impact: required session-summary fields advance the protocol
  version from 3 to 4.
- Relevant ADRs: ADR-0003, ADR-0010, ADR-0013, ADR-0014.

## Security and privacy

- Authorization: no new endpoint or browser mutation.
- Privilege: classification does not execute or inspect another command.
- Secrets/logging: executable paths, environment contents, terminal bytes, and
  provider credentials are not copied into classification evidence.
- Abuse/failure scenario: browser-supplied names or terminal output cannot set
  classification; only fixed server-owned preset definitions can.

## Reliability

- Idempotency: the same preset maps to the same type/source/confidence.
- Timeouts/retries: none.
- Restart behavior: direct PTY sessions still end with the local server;
  classification has no separate persistence.
- Unknown outcome: unsupported future presets must use an explicit unknown
  classification instead of guessing.
- Migration/rollback: incompatible clients fail the existing protocol-version
  handshake rather than accepting partial summaries.

## Test plan

- Unit: preset-to-classification mapping and strict schema validation.
- Contract: protocol-version mismatch and required session evidence.
- Integration: session creation and WebSocket session messages.
- Browser/rendering: selected inspector evidence and accessible session-row
  names.
- Failure/recovery: unknown and extra fields rejected; unavailable presets
  remain unlaunchable.
- Security: browser create payload cannot supply or override classification.

## Dependencies

- Blocked by: fixed launch presets and typed session summaries.
- Blocks: PC-031 attention reducer, PC-032 unread/notifications, provider
  observers, and agent filters.

## Evidence required

- Focused classification/schema/session/rendering test results.
- Full `pnpm verify`.
- Updated protocol documentation, status, backlog, and changelog.

## Open questions

- Process-observed classification for adopted or user-defined commands belongs
  to a future slice with an explicit evidence contract.
