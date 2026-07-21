# Testing strategy

## Philosophy

Pacium controls long-running processes, source code, and privileged actions. Testing must cover failure timing, authorization, concurrency, and recovery—not only happy-path UI behavior.

## Test pyramid

### Unit tests

Use for:

- schema validation;
- state transitions;
- authorization predicates;
- naming and path validation;
- idempotency logic;
- event projection reducers;
- policy matching;
- provider normalization;
- risk classification helpers.

### Property and fault tests

Use for filesystem state:

- arbitrary command sequences;
- process termination at each durable step;
- partial event tails;
- duplicate commands;
- stale revisions;
- corrupt files;
- disk-full simulation;
- snapshot/restore equivalence;
- projection rebuild.

Invariants should include:

- no two immutable decisions for one idempotency key;
- revisions never move backward;
- committed references resolve or are explicitly external;
- projections equal replayed truth;
- recovery is deterministic.

### Contract tests

For:

- web-to-state commands;
- web-to-broker RPC;
- broker-to-host protocol;
- provider hook/App Server payloads;
- event-stream cursors;
- terminal grant and lease semantics.

Store versioned fixtures from supported provider/tmux versions with sensitive data removed.

### Integration tests

Use real:

- filesystem;
- tmux server in isolated socket;
- PTY behavior;
- Git repository and worktrees;
- system process restart;
- Tailscale-like trusted header boundary in a controlled environment;
- provider CLI smoke tests where credentials and cost policy permit.

### Browser tests

Critical journeys:

- sign in and authorization denial;
- session discovery/classification;
- terminal observation/control/lease transfer;
- question answer and conflict;
- approval details and confirmation;
- run navigation;
- reconnect from event cursor;
- mobile Inbox;
- keyboard-only operation;
- emergency pause.

### Security tests

- spoofed identity headers;
- bypass of trusted proxy;
- CSRF;
- cross-origin WebSocket;
- expired/reused terminal grant;
- revoked membership during stream;
- lease race;
- path traversal/symlink escape;
- unauthorized repository/session enumeration;
- broad approval-policy matching;
- terminal output injection;
- secret logging scan.

### Recovery tests

- API restart during command;
- broker restart during active terminals;
- host disconnect during operation;
- provider adapter failure;
- tmux server loss;
- restore from backup;
- previous-release rollback;
- CLI version incompatibility.

## Test environments

### Hermetic CI

No real credentials. Uses fake providers, isolated tmux/Git fixtures, and temporary state.

### Integration VPS

Disposable or dedicated environment with real tmux, Tailscale policy, and optional provider test identities.

### Production canary

A small, noncritical repository/run used after deployment to verify the full path.

## Determinism

Tests should control:

- clock;
- ID generation;
- filesystem paths;
- random backoff;
- provider fixtures;
- event order;
- process exit points.

Avoid arbitrary sleep when waiting for events; use observable conditions and deadlines.

## Performance tests

Representative scenarios:

- thousands of entity files;
- millions of historical events partitioned by date/workspace;
- 50 active sessions;
- several terminal viewers;
- high-frequency provider events;
- Inbox and Active projection rebuild;
- startup and recovery time;
- snapshot and restore duration.

Targets should be set from actual intended workload and recorded in release criteria.

## Release gates

A release candidate runs:

- clean install;
- formatting/lint/type checks;
- unit/property/contract tests;
- integration tests;
- production build;
- state migration/recovery tests;
- security checks;
- dependency/secret scan;
- smoke test;
- documentation link and status validation.

A failed required gate is not converted into a warning without explicit documented waiver.
