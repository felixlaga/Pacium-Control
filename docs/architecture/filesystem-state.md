# Filesystem state

## Decision

Pacium Control uses no application database. Durable coordination state is stored as readable JSON entity files and append-only JSONL event streams managed by one authoritative state coordinator.

This is not “write random JSON from every process.” The filesystem layer must provide transactional discipline, integrity validation, recovery, and stable schemas.

## Goals

- inspectable with ordinary tools;
- easy to back up and restore;
- no database service or native driver;
- deterministic restart behavior;
- safe under concurrent requests through one writer;
- idempotent commands;
- append-only audit history;
- portable between machines;
- capable of serving a small team with thousands of runs and many events.

## Non-goals

- arbitrary multi-process writes;
- cross-region active-active replication;
- unbounded analytical queries over raw events;
- pretending POSIX filesystems provide distributed transactions;
- storing provider conversations or all terminal output forever.

## Directory layout

```text
state/
├── meta/
│   ├── format-version.json
│   ├── instance.json
│   ├── revision
│   └── last-clean-shutdown.json
├── entities/
│   ├── workspaces/
│   ├── users/
│   ├── memberships/
│   ├── hosts/
│   ├── repositories/
│   ├── runs/
│   ├── agents/
│   ├── tasks/
│   ├── plans/
│   ├── questions/
│   ├── approvals/
│   ├── decisions/
│   ├── prompts/
│   ├── leases/
│   ├── handoffs/
│   ├── reviews/
│   ├── usage/
│   └── policies/
├── events/
│   ├── global/YYYY/MM/DD.jsonl
│   └── workspaces/<workspace-id>/YYYY/MM/DD.jsonl
├── projections/
│   ├── inbox/
│   ├── active/
│   ├── search/
│   └── usage/
├── journal/
│   ├── prepared/
│   └── committed/
├── snapshots/
├── locks/
├── quarantine/
└── tmp/
```

## Entity file contract

A canonical entity file should be:

- UTF-8 JSON;
- deterministic key order for stable diffs where practical;
- newline terminated;
- validated against a versioned schema;
- named only from a validated immutable ID;
- written with restrictive permissions;
- free of secrets.

Example shape:

```json
{
  "schemaVersion": 1,
  "id": "run_01J...",
  "revision": 42,
  "workspaceId": "ws_01J...",
  "state": "active",
  "createdAt": "2026-07-20T12:00:00.000Z",
  "updatedAt": "2026-07-20T13:14:22.410Z"
}
```

This example is documentation, not an implementation commitment to exact field syntax.

## Single-writer model

Only the state coordinator mutates `entities`, `events`, `journal`, and authoritative metadata.

Other components:

- submit commands;
- receive committed results;
- may read through coordinator APIs or read-only snapshots;
- do not write files directly.

This removes most lock complexity and gives one ordered revision stream.

## Atomic single-entity write

Conceptual sequence:

1. Validate command, authorization context, and expected revision.
2. Allocate next revision and event IDs.
3. Serialize new entity into `tmp` on the same filesystem.
4. Flush file contents where durability is required.
5. Atomically rename over the entity path.
6. Append event record.
7. Flush event file according to configured durability mode.
8. Update in-memory index.
9. Return committed result.

Implementation must define crash semantics between entity replacement and event append. Multi-step journal records can make recovery deterministic.

## Multi-entity transaction journal

A mutation such as answering a question may update the question lifecycle, create an immutable decision, append several events, and update projections.

Use a transaction manifest:

```text
transaction ID
command ID and idempotency key
preconditions and expected revisions
new entity payload hashes
planned event IDs
state: prepared | committed | applied
```

Recovery rules:

- `prepared` with no authoritative changes: abort and remove temporary files;
- partially applied prepared transaction: finish or roll back according to manifest;
- `committed` transaction missing projection updates: rebuild projections;
- unknown/corrupt journal: quarantine and fail closed for affected writes.

The implementation must be fault-injection tested at every durable step.

## Events

Events are append-only JSON lines. A line contains one complete event. A partially written final line after crash is detected and quarantined or truncated only under a documented recovery procedure.

Event files rotate by date and optionally size. Event IDs and revisions provide ordering across files.

## Idempotency

Commands that can be retried carry an idempotency key scoped to actor/action/target. The state coordinator stores recent command results or a durable idempotency record.

Examples:

- answering a question after mobile reconnect;
- queueing a prompt after API timeout;
- acknowledging a decision;
- acquiring a terminal lease;
- host event resend after reconnect.

The same key with a different payload is an error.

## Optimistic concurrency

Mutable entities use expected revisions. A stale update returns a conflict with the current revision and enough information to refresh. Immutable decisions do not get edited; a superseding record is created.

## Indexes and projections

In-memory indexes are rebuilt on startup from entity files and may be checkpointed as disposable projections.

Possible indexes:

- entities by workspace/repository/run;
- active agents by state;
- Inbox items by assignee;
- open questions and approvals;
- sessions by host/tmux target;
- idempotency keys;
- event cursor by workspace;
- search tokens.

Any projection can be deleted and rebuilt from authoritative state.

## Snapshots and backups

A snapshot captures a consistent revision boundary and includes:

- format metadata;
- authoritative entities;
- events required since prior retained snapshot;
- manifest with file hashes and sizes;
- policies and configuration safe for backup;
- no provider secrets.

Backups can be encrypted with a standard external tool and copied off-host. Restore occurs into a staging directory, validates the manifest and schemas, then atomically switches the active state path or performs a documented service stop/swap/start procedure.

## Validation and quarantine

Startup checks:

- owner and permissions;
- no symlink traversal;
- format version support;
- valid JSON and schema versions;
- ID/path agreement;
- reference integrity;
- monotonic revisions;
- journal recovery;
- event final-line integrity;
- snapshot metadata.

Unknown or corrupt files move to `quarantine` with an incident record. The system should prefer explicit degraded mode over silent data loss.

## Scale strategy without a database

Before reconsidering the architecture:

- partition events by workspace/date;
- keep current entities separate from history;
- maintain in-memory indexes;
- compact or archive old event segments after verified snapshots;
- paginate through indexes, not directory scans per request;
- isolate workspaces or large repositories into separate state domains if needed;
- measure actual latency, memory, and recovery time.

A future storage change requires evidence, migration design, and an ADR.
