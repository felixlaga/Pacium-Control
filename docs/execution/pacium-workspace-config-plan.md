# Implementation plan: Server-owned Pacium workspace configuration

- Issue: [PC-040](pacium-workspace-config-issue.md)
- Owner: Felix
- Agent/session: Codex `/root`
- Branch: `codex/pacium-workspace-config`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `91292056d8ddffa99b8416471dd781a6377a78de`
- Target milestone: Milestone 3
- Status: In progress

## Objective

Create the smallest durable server-owned configuration contract that can
support Meta, Orchestrator, workers, repositories, queue compatibility,
objective/plan sources, delivery selection, and existing verification presets.
Make replacement atomic and conflict-safe while granting no queue, prompt,
terminal, file-content, or process authority.

## Existing behavior

The local server currently owns runtime configuration, a fixed Shell/Codex/
Claude launch catalog, and an optional external read-only verification catalog.
Protocol 9 authenticates and bounds terminal, Git, history, and verification
messages. The browser has a decorative Pacium toggle but no Pacium config,
workspace entity, role binding, queue source, worker slot, objective/plan
source, or delivery definition.

No local data directory or application-owned atomic JSON store exists yet.
Browser-local settings and terminal layouts are deliberately not authoritative
server configuration.

## Proposed behavior

### Durable document

The server owns this conceptual version-1 file:

```json
{
  "schemaVersion": 1,
  "revision": 4,
  "workspace": {
    "id": "primary",
    "label": "Pacium",
    "repositories": [
      {
        "id": "pacium",
        "label": "Pacium Control",
        "root": "/canonical/repository",
        "verificationPresetIds": ["verify"]
      }
    ],
    "roles": {
      "meta": {
        "type": "launch_preset",
        "launchPreset": "codex",
        "repositoryId": "pacium"
      },
      "orchestrator": {
        "type": "session",
        "sessionId": "00000000-0000-4000-8000-000000000000"
      }
    },
    "workers": [],
    "queueSources": [
      {
        "id": "needs-felix",
        "label": "Needs Felix",
        "path": "/canonical/queue/NEEDS-FELIX",
        "format": "plain_text",
        "requestingRole": "orchestrator",
        "deliveryMethodId": "answers"
      }
    ],
    "deliveryMethods": [
      {
        "id": "answers",
        "label": "Answer file",
        "type": "answer_file",
        "path": "/canonical/queue/PACIUM-ANSWERS"
      }
    ],
    "context": {
      "objective": {
        "format": "plain_text",
        "path": "/canonical/context/OBJECTIVE"
      },
      "plan": null
    }
  }
}
```

Meta, Orchestrator, and each named worker use exactly one binding:

```text
session(sessionId)
launch_preset(launchPreset, repositoryId?)
```

Session IDs are explicit and never inferred from names. A session can occupy at
most one configured role/worker slot. Launch-preset bindings describe a future
launch choice rather than claiming a live session. The fixed launch catalog
owns valid preset IDs.

Repositories are existing canonical directories. Each verification reference
must exist for the exact same canonical root in the already loaded external
verification catalog; no executable definition is copied into `pacium.json`.

Queue, context, and answer targets are path metadata only. Existing leaves must
be regular non-symlink files. Missing leaves are accepted only when their
immediate parent exists and canonicalizes; the normalized path uses that
canonical parent. Source and answer paths must be unique and disjoint. Queue
sources reference either one explicit delivery ID or `null` for observe-only.
Delivery definitions are limited to `answer_file` and `role_prompt`; neither is
executed by PC-040.

### Limits

- one workspace;
- 128 KiB serialized file and WebSocket-safe normalized response;
- 64-character lowercase identifiers;
- 120-character labels;
- 4,096-character absolute paths without controls;
- 32 repositories and queue sources;
- 64 worker slots;
- 16 delivery methods and verification references per repository;
- two context sources;
- safe-positive-integer revisions;
- no unknown object keys.

### Data directory and file lifecycle

`PACIUM_DATA_DIR`, when present, must be absolute and contain no controls. The
macOS-first default is
`<canonical-home>/Library/Application Support/Pacium Control`. Inspecting an
absent config creates nothing.

The first accepted replace creates only the dedicated directory with mode
`0700`, then writes `pacium.json` through a same-directory unpredictable
exclusive temporary file with mode `0600`. The store writes normalized JSON,
syncs and closes the temporary file, atomically renames it, syncs the directory,
and removes a known leftover temporary file after failure where safe. Existing
data directories and config files must be owned by the current user, have no
group/other permission bits, and not be symlinks.

Every get rereads the bounded file. Missing is `unconfigured`; valid is `ready`;
invalid JSON, schema, version, permissions, or filesystem shape is `error` with
no partial content. Corrupt files are not renamed, overwritten, deleted, or
auto-migrated.

Replace carries the complete workspace and `expectedRevision`. The server
rereads current state, requires revision 0 only when missing, blocks replacement
of corrupt state, validates live sessions and all catalog/path references,
normalizes the document, increments once, atomically writes, rereads, and
returns the accepted result. A lost response is recovered with get.

### Protocol and browser state

Protocol 10 adds:

```text
pacium.config.get(requestId)
pacium.config.replace(requestId, expectedRevision, workspace)
pacium.config(requestId, observation)
```

The observation is strict:

```text
unconfigured: revision 0, workspace null, error null
ready: positive revision, normalized workspace, error null
error: revision null, workspace null, bounded error
```

Replace inputs contain only typed configuration metadata. There are no command,
argument, executable, environment, timeout, signal, terminal bytes, queue
content, objective/plan content, answer content, or verification-command
fields.

Browser transport and reducer state support idle/loading/loaded/replacing while
retaining the last accepted observation. Only a matching request may advance
state. Disconnect drops pending intent without inventing success; reconnect get
reconstructs server truth. No UI reads or mutates this state until PC-041/42.

## Architecture and boundaries

### Modules touched

- `config.ts`: data-directory selection only.
- New shared Pacium workspace contract types in protocol 10.
- New server workspace normalizer: schema, graph/reference, catalog, live
  session, canonical path, and data-directory containment validation.
- New atomic Pacium config store with injected filesystem operations for fault
  tests.
- `SessionManager`: read-only live-session existence query if not already
  exposed.
- WebSocket hub: get/replace dispatch and bounded response.
- Browser transport/reducer: request identity and accepted observation.
- Server startup: construct and inject one store without coupling it to PTY
  startup success.

### Data/state changes

- Entity/schema changes: one version-1 `pacium.json`; no other durable file.
- Commands/events: get and complete replace; no domain event journal.
- Idempotency: optimistic revision makes duplicate replacement conflict after
  the first accepted write.
- Migration: no prior file exists; unsupported versions degrade Pacium only.

### Protocol changes

- Increment `PROTOCOL_VERSION` from 9 to 10.
- Add strict public workspace, repository, binding, worker, queue-source,
  delivery, context-source, and observation schemas.
- Add exact cross-field refinements for unique IDs, references, session-slot
  uniqueness, and source/answer separation where expressible in shared
  contracts.
- Server-only canonical and catalog/live-session validation occurs after the
  transport schema.
- Final normalized response passes the existing serialized-message limit;
  unsafe excess degrades to one bounded error observation.

### Authorization and privilege

- Existing exact Origin and ephemeral token authorize each request.
- Only the local server resolves the data-file location and writes it.
- Browser paths are candidates, not authority. Server canonicalization and
  cross-reference validation precede persistence.
- Session bindings must name a currently known session at replacement time.
  Restart may make a persisted direct-session binding unresolved; later
  presentation must label it missing rather than infer a replacement.
- Launch preset and verification IDs resolve only against server-owned catalogs.
- No configured source or delivery is opened for content or used for terminal
  input/execution.

## Sequence

1. Commit the PC-040 issue and this implementation plan separately.
2. Add protocol-10 workspace leaf schemas and bound tests.
3. Add role/worker binding, repository, queue, delivery, context, and complete
   workspace graph invariants in small commits.
4. Add strict config observation/get/replace contracts and message-bound tests.
5. Add data-directory resolution and permission/containment tests.
6. Add canonical repository and metadata-file path normalization.
7. Add catalog, delivery-reference, source/answer, and live-session validation.
8. Add versioned file reading with missing/ready/corrupt outcomes.
9. Add atomic exclusive temporary write, sync, rename, directory sync, modes,
   and fault-injection tests.
10. Add expected-revision replacement and reread verification.
11. Add SessionManager and WebSocket get/replace orchestration with PTY-survival
    and response-bound tests.
12. Add browser transport and per-connection config reducer tests.
13. Add integration fixtures for create, replace, conflict, restart, corrupt
    preservation, and reference drift.
14. Add configuration documentation and synchronize architecture/status/debt.
15. Run all repository and browser gates.
16. Fast-forward and push the small coherent commit series to `dev`.

## Failure model

| Failure point                    | Expected state                                       | Recovery                                   |
| -------------------------------- | ---------------------------------------------------- | ------------------------------------------ |
| Data directory unset/absent      | Deterministic default; no file created on get        | Future setup sends first replace           |
| Missing config                   | Unconfigured revision 0                              | Replace with expected revision 0           |
| Unsafe directory mode/owner      | Pacium config error; terminals survive               | Repair dedicated directory metadata        |
| Invalid/oversized/unknown schema | Preserve file; bounded Pacium config error           | Repair or move file outside Pacium         |
| Unsupported version              | Preserve file; no migration guess                    | Use supported version or future migrator   |
| Invalid/cyclic reference         | Reject before write; prior revision remains          | Correct complete replacement               |
| Missing live session             | Reject session binding; process state unchanged      | Choose a live session or preset binding    |
| Missing launch/check preset      | Reject reference; external catalogs unchanged        | Correct catalog or reference               |
| Missing queue/context leaf       | Accept only through existing canonical parent        | Later watcher reports absence honestly     |
| Existing symlink/non-file leaf   | Reject before write                                  | Configure a safe regular/missing leaf      |
| Source equals answer target      | Reject before write                                  | Use a separate answer path                 |
| Stale expected revision          | Conflict; no write                                   | Get current revision and review full state |
| Temporary open/write/sync fails  | Prior config remains authoritative                   | Fix filesystem and retry after get         |
| Atomic rename fails              | Prior config remains; known temp cleanup attempted   | Inspect filesystem and retry after get     |
| Directory sync fails post-rename | Return durability error with uncertain latest state  | Get and inspect before any retry           |
| Response lost                    | Browser keeps prior revision                         | Get; never replay replace blindly          |
| Browser disconnects              | Store/PTY unaffected                                 | Reconnect and get                          |
| Server restart                   | Reread config; direct session refs may be unresolved | Later UI relaunches or rebinds explicitly  |

## Compatibility

- Supported versions: protocol-10 browser/server pair; config schema version 1;
  current macOS-first Node.js 24/POSIX filesystem target.
- Fallback behavior: General terminal, Git, history, Activity, and Checks
  surfaces work when Pacium config is absent or invalid.
- Rollback: remove protocol/store wiring together and preserve or move
  `pacium.json`; no repository, queue, terminal, verification, or provider state
  needs migration.

## Test plan

- Unit: every scalar/array/file bound, strict objects, Unicode/control text,
  identifiers, revisions, unique graph IDs, dangling/duplicate references,
  session-slot uniqueness, and serialized response ceiling.
- Property/fault: extra keys, traversal-looking names, invalid UTF-8 JSON,
  symlink swaps, permission/owner mismatch, missing parent, duplicate canonical
  paths, data-dir overlap, oversized normalized output, and injected filesystem
  failures at every atomic step.
- Contract: all leaf/union/workspace/observation states, get/replace messages,
  forbidden authority/content fields, invalid cross-field states, and protocol
  mismatch.
- Integration: create revision 1, replace N+1, duplicate/stale conflict, restart
  reread, corrupt/unsupported preservation, external rewrite, path drift,
  missing session/preset, exact permissions, and no source-content reads.
- Browser: transport serialization, loading/replacing retention, accepted
  response, stale/cross-request rejection, disconnect interruption, error, and
  reconnect get.
- Security: Origin/token, one resolved state target, canonical paths, source/
  answer separation, repository containment, no command/terminal/content
  fields, no logging, message bound, and PTY survival.
- Performance: 128 KiB file ceiling, fixed record ceilings, no polling/watchers,
  one complete reread per operation, one complete atomic write per accepted
  replacement, and no effect on terminal I/O.

## Documentation changes

- Add a Pacium workspace configuration reference with schema, limits, examples,
  ownership, atomicity, path rules, unsupported behavior, and recovery.
- Update protocol, filesystem-state architecture, security, README, status,
  backlog, issue, plan, and changelog.
- Record UI editing, toggle, role pinning/launch, queue observation/delivery,
  context reads, worker resolution, multi-workspace, migration, and backups as
  incomplete.

## Rollout

- Development: explicit temporary data directories, repositories, queue
  parents, context parents, and external verification catalog fixtures.
- Integration: contract, normalizer, store, fault, session, WebSocket, browser
  reducer, and complete gate suites.
- Canary: localhost development only; no real queue or answer target is read or
  written.
- Production: none; project remains pre-release.

## Open questions

- The packaged launcher must finalize cross-platform default data-directory
  conventions and repair/backup UX before release.
- A future PC-042 settings surface decides whether role binding is configured
  through existing-session selection, preset launch, or both in one flow.

## Approval

- Product: defines only configuration needed by concrete Pacium consumers and
  leaves the terminal dominant.
- Architecture: one server-owned versioned JSON file, complete replacement,
  optimistic revision, atomic write, and no generalized state engine.
- Security: canonical metadata paths and references grant no read, watch, write,
  prompt, terminal, verification, or execution capability.
