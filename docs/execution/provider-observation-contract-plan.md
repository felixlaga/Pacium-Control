# Implementation plan: provider observation contract

- Issue:
  [provider-observation-contract-issue.md](provider-observation-contract-issue.md)
- Owner: Codex
- Agent/session: primary implementation agent
- Branch: `codex/provider-observation-contract`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `cb62314e2c78da588051007366a4e56b483a94ac`
- Target milestone: Epic 5 / PC-060
- Status: In progress

## Objective

Introduce the smallest strict provider-observation contract that Claude Code
and Codex adapters can populate later, and connect it to the existing terminal
Activity inspector without claiming that live observation already exists.

## Existing behavior

- `SessionSummary` contains launch classification, repository evidence, and PTY
  process state, but no provider observer state.
- `deriveProcessAttention` correctly reports a live agent PTY as unknown because
  no provider observer is connected.
- Recent activity contains process, Git, and verification facts only.
- Claude Code hooks/status and Codex native runtime protocols are
  version-sensitive. Current vendor documentation supports capability
  detection and explicit degradation instead of version-string assumptions.

## Proposed behavior

Claude Code and Codex session summaries contain a version-1 observation
snapshot. Initially it reports an unavailable adapter, unknown capabilities,
no attention, no activities, and no diagnostics. Shell sessions contain
`null`. Recent activity exposes the snapshot as one additional evidence source.
Future adapters replace this initial value only with data that passes the same
strict contract.

## Architecture and boundaries

### Modules touched

- `packages/contracts/src/provider-observation.ts`: strict schemas, limits, and
  types.
- `packages/contracts/src/protocol.ts`: nullable session field and protocol
  increment.
- `apps/local-server/src/provider-observation.ts`: initial snapshot factory.
- `apps/local-server/src/session-manager.ts`: attach snapshot at session
  creation.
- `apps/web/src/attention-model.ts`: translate only explicit provider attention.
- `apps/web/src/recent-activity-model.ts`: provider facts/source projection.
- `apps/web/src/recent-activity.tsx`: existing source/card rendering consumes
  the projection without new controls.

### Data/state changes

- Entity/schema changes: `SessionSummary.providerObservation` is nullable.
- Commands/events: no new client command or server message family.
- Idempotency: schemas reject duplicate capability IDs and activity IDs.
- Migration: protocol 19 is a clean local client/server compatibility boundary;
  no persisted state migration.

### Protocol changes

- Increment `PROTOCOL_VERSION` from 18 to 19.
- Add one strict nullable provider snapshot to every session summary.
- Provider payloads never cross as raw arbitrary JSON.

### Authorization and privilege

- No new browser authority.
- No provider approval response or prompt submission is represented.
- The local server remains the only producer of session snapshots.

## Sequence

1. Add and exhaustively test the provider-observation schemas and bounds.
2. Add the session-summary field and protocol fixtures.
3. Add the initial server snapshot factory and session-manager tests.
4. Project explicit provider attention while preserving reducer precedence and
   staleness.
5. Add provider activities and observer health to Recent activity.
6. Synchronize backlog, status, README, and changelog.
7. Run focused tests, full verification, and browser end-to-end tests.

## Failure model

| Failure point | Expected state | Recovery |
| ------------- | -------------- | -------- |
| Adapter absent | Health is `unavailable`; PTY remains usable | Install/connect in later provider issue |
| Unsupported capability | Capability is `unsupported` or `unknown`; no inferred event | Upgrade or use terminal fallback |
| Invalid snapshot | Contract rejects the entire value | Keep last valid snapshot or unavailable default |
| Stale attention | UI reports stale provider evidence | Await a fresh valid provider observation |
| Diagnostic contains secret-like key | Contract rejects the diagnostic | Adapter emits a safe bounded code/message |
| Browser reconnect | Server resends current process-local snapshot | Existing session list/update flow |
| Local-server restart | Direct PTY follows existing ended-session contract | Relaunch terminal; no transcript replay |

## Compatibility

- Supported versions: contract version 1; provider CLI versions are recorded
  but not declared supported by this issue.
- Fallback behavior: process attention and raw terminal operation remain
  available.
- Rollback: revert protocol/session field and Activity projection together.

## Test plan

- Unit: all schemas, bounds, uniqueness, provider-extension matching, default
  factory, attention mapping, source summary/facts.
- Property/fault: malformed timestamps, stale ordering, duplicate IDs, sensitive
  keys, oversized arrays/strings, unknown keys.
- Contract: valid and invalid `SessionSummary` and server-message fixtures.
- Integration: Claude/Codex/shell creation and PTY exit behavior.
- Browser: Activity inspector markup for unavailable provider and shell.
- Security: no nested raw data, prompt/output/environment/token fields, or
  browser mutation path.
- Performance: snapshot has fixed array/string bounds; no polling or background
  work is added.

## Documentation changes

- Update PC-060 in the implementation backlog with exact verified scope.
- Update `STATUS.md`, `README.md`, and `CHANGELOG.md` after verification.
- Record provider-version support as still pending PC-061/PC-062.

## Rollout

- Development: focused tests after each contract/server/web slice.
- Integration: full monorepo verification and end-to-end suite.
- Canary: localhost manual launch inspection if browser automation reveals a
  visual regression.
- Production: not a release claim; repository remains an executable local
  development slice.

## Open questions

- None. PC-061 and PC-062 will choose supported live transports from current
  provider capabilities rather than expanding this contract speculatively.

## Approval

- Product: bounded by accepted PC-060 backlog entry.
- Architecture: follows ADR-0003 and ADR-0010 within current deferred-scope
  constraints.
- Security: observation-only, bounded, no secrets, no raw provider payloads.
