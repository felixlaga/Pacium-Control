# Milestone 0 — Foundations and truth

## Goal

Create a repository and state foundation that later agents can trust. No UI polish can compensate for unreliable identity, events, or crash recovery.

## Scope

### Repository

- Choose supported runtime/toolchain versions.
- Establish monorepo structure and package boundaries.
- Add formatting, linting, type checking, testing, clean-build, and release commands.
- Add fixtures and local development profiles.
- Add CI with no private registries or machine paths.

### Contracts

- ID format and validation.
- Core entity schemas.
- State machines.
- Command envelope.
- Event envelope.
- Error taxonomy.
- version negotiation conventions.

### State coordinator

- state directory initialization;
- single-writer enforcement;
- atomic entity read/write;
- append-only event files;
- global/workspace revision allocation;
- expected-revision conflicts;
- idempotency records;
- multi-file transaction journal;
- crash recovery;
- in-memory indexes;
- event subscriptions;
- snapshots;
- integrity validation;
- backup/restore primitives;
- quarantine.

### Test infrastructure

- deterministic clock and ID fixtures;
- filesystem fault injection;
- process-kill harness;
- fixture state trees;
- clean temporary directories;
- no-database dependency check;
- migration/version fixtures.

## Explicit non-scope

- real tmux control;
- production Tailscale auth;
- provider adapters;
- polished UI;
- multi-host;
- Git automation beyond fixtures.

## Acceptance criteria

1. A fresh clone installs and runs using documented commands.
2. The state coordinator creates and reads representative entities.
3. Events are append-only, ordered, and streamable from a cursor.
4. A duplicate command with the same idempotency key returns the original result.
5. A duplicate key with a different payload is rejected.
6. Stale expected revisions return a typed conflict.
7. Fault injection at every transaction step yields a recoverable state.
8. A partially written event tail is detected.
9. Projections can be deleted and rebuilt.
10. A snapshot validates with hashes and restores into an empty directory.
11. Corrupt entities are quarantined and affected operations fail closed.
12. No application database dependency is present.
13. Documentation states exact durability limitations.
14. CI reproduces the clean-clone workflow.

## Demo

A command-line or test-driven demonstration should:

1. initialize empty state;
2. create workspace, user, repository, run, question;
3. answer question;
4. kill the process during a second mutation;
5. restart and recover;
6. replay events;
7. rebuild an Inbox projection;
8. create snapshot;
9. restore snapshot elsewhere;
10. verify identical authoritative state.

## Exit evidence

- CI run link or recorded output;
- fault-injection matrix;
- snapshot/restore manifest;
- dependency scan;
- benchmark for representative state size;
- known limitations.
