# Events and audit

## Event model

Events answer “what happened?” Entities answer “what is true now?”

An event is immutable and append-only. It should be meaningful at the domain level rather than a copy of every internal function call.

## Event envelope

Conceptual fields:

```text
eventId
schemaVersion
globalRevision
workspaceRevision
type
occurredAt
recordedAt
actor
requestingAgent
executionIdentity
workspaceId
repositoryId
runId
entityRefs
causationId
correlationId
traceId
payload
integrity
```

Not every field is present on every event.

## Event categories

### Human

- question answered;
- approval resolved;
- prompt submitted;
- terminal control acquired/transferred/revoked;
- run paused/resumed/cancelled;
- policy changed;
- review approved/revision requested;
- emergency control invoked.

### Agent/provider

- session started/stopped;
- task started/completed;
- plan revised;
- tool/command started/completed;
- question/approval requested;
- decision acknowledged/applied;
- provider usage updated;
- adapter degraded.

### Git

- worktree created/removed;
- commit observed;
- verification completed;
- review bundle generated;
- integration attempted/completed/failed;
- conflict detected.

### Host/system

- host enrolled/connected/disconnected;
- broker started/degraded;
- state recovery performed;
- backup completed/failed;
- restore validated;
- security configuration changed.

## Audit versus activity

Activity is a product projection over events. Audit is the security and accountability interpretation.

Not every ephemeral signal belongs in durable history. Examples of non-durable telemetry:

- every terminal byte;
- every cursor move;
- every heartbeat;
- high-frequency token deltas;
- transient UI selection.

Durable events should preserve consequential transitions and enough context for explanation.

## Attribution

Where relevant, record three identities:

```text
Requested by: human or agent
Authorized by: human or policy revision
Executed by: provider/Unix execution identity
```

Example:

```text
Requested by checkout-orchestrator
Approved by felix@pacium.com
Executed by claude-seat-felix on pacium-vps
```

## Correlation

A user action may produce several events. Correlation and causation IDs link:

- answer command;
- decision creation;
- delivery attempt;
- acknowledgement;
- application;
- resulting commit or command.

The run timeline can present this as one understandable chain while retaining individual facts.

## Ordering

The state coordinator allocates a monotonically increasing central revision. Provider `occurredAt` may precede `recordedAt`; both should be retained. Remote host events use source sequence numbers for deduplication and central revisions for committed order.

Do not rely on wall-clock timestamps alone for ordering.

## Schema evolution

- Every event type has a versioned schema.
- Readers support a defined compatibility window.
- Migrations may transform snapshots/projections while retaining original event segments.
- Unknown event versions do not crash unrelated state; they surface degraded history and diagnostics.
- Event types are stable public contracts inside the repository.

## Redaction

When sensitive payload content cannot be retained:

- store a hash or bounded metadata;
- record that redaction occurred and why;
- keep actor, target, time, result, and policy context;
- avoid rewriting historical event files merely to hide secrets—design retention and secret avoidance first.

A confirmed secret leak requires incident response and controlled compaction or replacement with an auditable migration.

## Retention

Suggested initial policy:

- decisions, approvals, role/policy changes, and run completion evidence: long-term;
- domain activity: configurable months or years;
- verbose provider tool details: shorter;
- terminal scrollback: short and bounded;
- raw diagnostics: short, encrypted where sensitive.

Retention is workspace policy and must not silently delete required audit evidence.

## User unread cursors

Per-user cursors refer to event revisions by workspace, repository, and run. They do not mutate shared events.

“Since last checked” uses these cursors to select deterministic facts and then optionally asks meta to summarize them.
