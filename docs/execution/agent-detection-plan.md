# Implementation plan: Evidence-labelled agent detection

- Issue: [PC-030](agent-detection-issue.md)
- Owner: Felix
- Agent/session: Codex `/root`
- Branch: `codex/agent-detection`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `7f18c70`
- Target milestone: Milestone 2
- Status: In progress

## Objective

Turn Pacium’s server-owned fixed launch choice into explicit, portable agent
classification evidence and consume it in the existing inspector without
claiming activity or attention that has not been observed.

## Existing behavior

- The local server resolves one fixed Shell, Codex, or Claude Code preset before
  launching a PTY.
- Session summaries expose `launchPreset` and `commandLabel`, but neither field
  states the classification source, confidence, or observation time.
- The inspector repeats preset and executable data, then shows an unimplemented
  agent-context placeholder.
- Protocol version 3 requires fixed preset fields but no classification.

## Proposed behavior

Add an `AgentClassification` object to launch-preset definitions and every
session summary. The fixed definitions map Shell, Codex, and Claude Code to
matching types with `launch_preset` source and `confirmed` confidence. Session
creation stamps `observedAt` with the same server time as `createdAt`.

Advance the protocol to version 4, update strict fixtures, and render a compact
evidence block in the selected-session inspector. Session rows gain a bounded
accessible name that combines the existing display name with classification and
process state. No attention field or “working” label is introduced.

## Architecture and boundaries

### Modules touched

- `packages/contracts/src/protocol.ts`: classification schemas and protocol 4
  session summary.
- `apps/local-server/src/launch-presets.ts`: deterministic server-owned
  classification definitions.
- `apps/local-server/src/session-manager.ts`: session evidence creation.
- `apps/web/src/app.tsx`: row name and selected-session evidence consumer.
- `apps/web/src/styles.css`: compact evidence styling.
- Existing contract, preset, server, manager, and rendered component tests.

### Data/state changes

- Entity/schema changes: one required bounded classification object on each
  live session summary.
- Commands/events: no new message family; existing session-bearing messages use
  protocol 4.
- Idempotency: classification is immutable for the session in this slice.
- Migration: no durable session records exist; incompatible browser/server
  pairs fail the version handshake.

### PTY/process lifecycle

- Classification is resolved before PTY creation from the same fixed preset
  definition.
- PTY spawn, process groups, input, resize, signals, reconnect, and close are
  unchanged.
- Process liveness remains `processState`; it does not alter classification or
  imply attention.

### Reconnect and failure behavior

- Reconnect/list/update/exit messages repeat the immutable classification.
- An unavailable preset cannot launch and therefore cannot create a
  classification-bearing session.
- Future unsupported preset types use explicit unknown evidence only after a
  compatible schema change.

### Security boundary

- The browser cannot send classification fields.
- No environment, token, executable arguments, terminal bytes, or provider
  payload enters classification.
- The server remains the only authoritative writer.

## Sequence

1. Commit the issue and plan separately.
2. Add strict classification schemas and protocol tests.
3. Add classifications to fixed server launch definitions and tests.
4. Stamp classification into session summaries and update manager/integration
   fixtures.
5. Render inspector evidence and accessible session-row names with semantic
   tests.
6. Synchronize status, backlog, issue evidence, and changelog.
7. Run full verification, merge to `dev`, and push.

## Failure model

| Failure point                   | Expected state                               | Recovery                          |
| ------------------------------- | -------------------------------------------- | --------------------------------- |
| Client/server version differs   | Handshake rejects protocol mismatch          | Reload matching build             |
| Classification missing/extra    | Strict schema rejects the session message    | Fix authoritative server contract |
| Preset executable unavailable   | Launch stays disabled; no session is created | Install CLI or choose Shell       |
| Process exits                   | Process state changes; classification stays  | Relaunch from retained preset     |
| UI cannot enrich provider state | Launch evidence remains visible              | Use terminal; add observer later  |

## Compatibility

- Supported versions: protocol 4 only after this change.
- Fallback behavior: no guessed classification from terminal output.
- Rollback: browser and server must roll back together to protocol 3.

## Test plan

- Unit: strict schemas and preset classification mapping.
- Contract: required object, enum bounds, extra-key rejection, protocol version.
- Integration: session creation/list/update/exit retain identical evidence.
- Browser/rendering: evidence text and accessible row name.
- Security: create messages reject browser-supplied classification.
- Performance: fixed small object; no polling or process scanning.

## Documentation changes

- Protocol/current status and implementation backlog.
- PC-030 issue evidence and plan result.
- Changelog entry.

## Rollout

- Development: focused tests after each contract/server/UI commit.
- Integration: full `pnpm verify`; no provider credentials required.
- Production: no release artifact yet.

## Open questions

- Provider-native capability and version evidence remains Milestone 4.
- Process-observed classification for adopted commands remains a later
  explicitly scoped contract.

## Approval

- Product: gives the inspector useful truth without false activity semantics.
- Architecture: fixed launch definitions remain server-owned and
  provider-neutral.
- Security: no new input, command, filesystem, or network surface.
