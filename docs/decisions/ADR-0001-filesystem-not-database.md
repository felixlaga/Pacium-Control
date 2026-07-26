# ADR-0001: Use filesystem state, not an application database

- Status: Accepted
- Date: 2026-07-20
- Owners: Product owner, technical lead

> ADR-0015 supersedes the generalized state-coordinator, transaction-journal, projection, snapshot, and backup scope below. The no-database and inspectable-filesystem decision remains accepted.

## Context

Pacium Control begins as a private system for one small team on a primary VPS. Its durable coordination data consists of relatively small entities—runs, tasks, questions, approvals, decisions, policies, and events. Live session truth already belongs to tmux, and code history belongs to Git.

A database would add a service, migration system, backup surface, operational dependency, and hidden inspection layer before the product demonstrates a need for them.

## Decision

Store authoritative coordination state as:

- one validated JSON file per current entity;
- append-only JSONL event segments;
- a transaction journal for multi-file mutations;
- rebuildable projections and in-memory indexes;
- checksummed snapshots and encrypted backups.

One state coordinator is the authoritative writer.

Do not add SQLite, PostgreSQL, Redis, LevelDB, an ORM, a hosted document store, or an embedded database under another name.

## Consequences

### Positive

- State is inspectable with ordinary tools.
- Deployment and backup are simple.
- No database service or native driver.
- The architecture fits a one-host/small-team workload.
- Recovery can be tested through files and manifests.
- The product preserves alignment with tmux/Git/filesystem-native operation.

### Negative

- The team must implement atomic writes, journaling, indexing, validation, and recovery carefully.
- Ad hoc querying is less convenient than SQL.
- Multiple web writers are not supported.
- Large historical analytics may require exported or rebuilt indexes.
- Filesystem semantics and disk-full behavior require explicit testing.

## Alternatives considered

### SQLite

Operationally simple, but still introduces database schemas/migrations and hides state behind SQL tooling. Rejected for the initial architecture.

### PostgreSQL

Strong concurrency and querying, but unnecessary operational weight for the target deployment.

### Git as the coordination store

Excellent for code and versioned documents, poor for high-frequency leases, events, and mutable run state.

### Shared Markdown files

Readable but weak for identity, concurrency, lifecycle, idempotency, and audit.

## Validation

Milestone 0 must prove:

- crash recovery at every transaction step;
- idempotency;
- startup and query performance at representative size;
- backup/restore on a clean machine;
- projection rebuild;
- disk-full and corruption behavior.

## Reconsideration trigger

Reconsider only if measured workload, availability, or query requirements cannot be met through partitioning, snapshots, indexes, and workspace separation. Any replacement requires a migration/rollback plan and a superseding ADR.
