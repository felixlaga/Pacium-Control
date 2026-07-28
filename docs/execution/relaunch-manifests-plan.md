# Implementation plan: Secret-free relaunch manifests

- Issue: PC-065
- Owner: Pacium Control
- Agent/session: Codex
- Branch: `codex/relaunch-manifests`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `120222ade51718aba8e0c10e566c4b8bd2333fe3`
- Target milestone: Milestone 4 — Native agent enrichment
- Status: In progress

## Objective

Replace browser-reconstructed relaunches with durable, bounded,
server-authoritative manifests that support explicit recovery and exact
successor lineage without persisting secrets or pretending that a direct PTY
survived local-server restart.

## Existing behavior

`SessionManager.create` retains preset, cwd, repository observation, and
classification only in the in-memory `SessionSummary`. The web
`relaunchSessionInput` helper copies preset/cwd/name/dimensions into another
`session.create` message. Closing or restarting the local server loses that
launch record. PC-024 explicitly deferred durable manifests, custom environment
replay, and provider resume identifiers.

The accepted reliability specification requires relaunch from a saved manifest
with clear lineage. ADR-0015 permits optional minimal versioned JSON state and
forbids complete environments, provider credentials, and terminal transcripts.
The existing Pacium and queue stores establish private, validated, atomic-write
patterns.

## Proposed behavior

The server authors one version-1 manifest before considering a launch
successful. It contains the immutable process-attempt session ID, optional
predecessor, display name, preset/provider/runtime classification, fixed preset
executable and arguments, canonical cwd, repository reference observed at
launch, environment allowlist key names, optional provider resume evidence, and
timestamps.

The private bounded catalog loads independently from live sessions. A typed
relaunch accepts only manifest ID plus cols/rows. The manager revalidates the
stored cwd and currently available server preset, persists a successor
manifest, launches a fresh PTY, and returns its new session. Provider observer
updates may add one matching bounded resume reference, but relaunch remains a
fresh provider process.

The browser receives manifests through an explicit list snapshot and
create/update events. Ended session actions and a compact Recovery group open
one confirmation dialog with retained facts and exact consequences.

## Architecture and boundaries

### Modules touched

- `packages/contracts`: strict manifest/state/protocol schemas.
- `apps/local-server/relaunch-manifest-store`: private load/upsert and atomic
  bounded replacement.
- `apps/local-server/session-manager`: manifest authorship, provider resume
  evidence, server-owned relaunch, and lineage.
- `apps/local-server/ws-hub` and startup: list/relaunch dispatch and store load.
- `apps/web/transport` and application state: typed messages and recovery state.
- `apps/web/session-actions` plus focused recovery components/models: preview
  and confirmation.

### Data/state changes

- Entity/schema changes: add `RelaunchManifest` version 1 and a bounded
  `relaunch-manifests.json` document.
- Commands/events: `relaunch.manifest.list`, `session.relaunch`,
  `relaunch.manifest.list`, and manifest-created/updated publication.
- Idempotency: no automatic WebSocket retry; one accepted request produces one
  successor ID. Repeated explicit requests are distinct attempts.
- Migration: absent state means no recovery records. Invalid or unsupported
  state fails startup visibly and is never replaced.

### Protocol changes

- Increment protocol 21 to 22.
- Add a strict manifest object to each session summary.
- Add strict client list/relaunch messages and server list/change events.
- Reject all unknown fields so browsers cannot submit launch facts.

### Authorization and privilege

- Existing authenticated WebSocket boundary applies.
- Only the server catalog resolves a manifest ID to command, cwd, environment
  key names, provider, and predecessor.
- Relaunch invokes the existing fixed PTY factory and preset catalog only.

## Sequence

1. Add the manifest/state schemas and contract tests.
2. Implement private bounded atomic persistence and fault/security tests.
3. Author manifests on create and extract optional provider resume evidence.
4. Add server-owned relaunch and exact lineage with manager tests.
5. Add list/relaunch WebSocket contracts and integration tests.
6. Replace browser reconstruction with typed transport and manifest state.
7. Add the confirmation preview and recovery group with component/browser tests.
8. Run focused and full gates, synchronize docs, and capture exact-head evidence.

## Failure model

| Failure point                              | Expected state                                       | Recovery                                      |
| ------------------------------------------ | ---------------------------------------------------- | --------------------------------------------- |
| Manifest file absent                       | Empty recovery catalog                               | New launches create it                        |
| State invalid/unsupported/unsafe           | Startup fails; bytes untouched                       | Operator repairs or moves file                |
| Catalog write fails before spawn           | No PTY and no successor claim                        | Fix data directory; retry explicitly          |
| Preset unavailable                         | No PTY; source manifest retained                     | Install/configure provider; retry             |
| Cwd missing or changed                     | No PTY; bounded path error                           | Restore path or start a new session elsewhere |
| PTY spawn fails after manifest reservation | Reserved attempt marked failed and retained honestly | Retry explicitly from predecessor             |
| Provider ID unavailable                    | Resume reference stays null                          | Fresh relaunch remains available              |
| Disconnect after request                   | No automatic retry or completion claim               | Reconnect and inspect session/manifest lists  |

## Compatibility

- Supported versions: protocol 22 only; manifest/state schema version 1.
- Fallback behavior: terminal creation and operation do not depend on provider
  resume evidence. No provider observer means a null resume reference.
- Rollback: the prior server ignores the standalone manifest file; no repository
  or provider state is modified.

## Test plan

- Unit: schemas, bounds, secret-shaped exclusions, ordering, pruning, preview
  derivation, and resume extraction.
- Property/fault: duplicate IDs, over-capacity catalogs, interrupted atomic
  replacement, hostile permissions, symlinks, and unsupported schema.
- Contract: protocol 22 strict message/event parsing.
- Integration: create -> store -> restart -> list -> relaunch -> successor,
  unavailable preset, invalid cwd, spawn failure, and provider update.
- Browser: recovery group, dialog details, source ended action, Escape/cancel,
  focus restoration, and newly created session selection.
- Security: unknown relaunch fields rejected; tokens, values, observer args,
  terminal bytes, and prompts absent from serialized state.
- Performance: bounded 100-manifest catalog and no terminal-byte writes.

## Documentation changes

- Update implementation backlog, STATUS, README, changelog, and milestone exit
  evidence.
- Record automatic provider resume and tmux durability as deferred.

## Rollout

- Development: focused contract/store/manager/component suites.
- Integration: full `pnpm verify` with the pinned repository toolchain.
- Canary: Chromium recovery/relaunch workflow plus direct serialized-state
  inspection.
- Production: no release claim; PC-070 through PC-076 remain required.

## Open questions

- None for this slice.

## Approval

- Product: authorized by the owner's instruction to continue PC-065 and the
  remaining roadmap.
- Architecture: conforms to direct-PTY authority and ADR-0015 minimal state.
- Security: server-owned launch resolution and key-name-only environment
  metadata; no automatic resume.
