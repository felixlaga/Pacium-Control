# ADR-0008: Separate current entities from append-only events

- Status: Accepted
- Date: 2026-07-20

## Context

The product needs fast current views and an attributable history. Replaying all events for every request is inefficient, while storing only current JSON loses decision and audit history.

## Decision

Maintain:

- current entity JSON files as authoritative current coordination state;
- append-only JSONL events as authoritative history;
- transaction journal to keep them consistent;
- rebuildable projections for Inbox, Active, search, and usage.

Events and entities are both first-class outputs of a committed command.

## Consequences

### Positive

- Fast current-state reads.
- Durable event/audit history.
- Rebuildable views.
- Clear per-user cursors and “since last checked.”
- No need to reconstruct everything from terminal transcripts.

### Negative

- Mutation code must preserve entity/event consistency.
- Schema evolution covers two representations.
- Event retention and compaction require policy.

## Alternatives considered

- Pure event sourcing: unnecessary replay and migration complexity initially.
- Current files only: insufficient audit and decision history.
- One monolithic log/state file: contention, corruption, and scaling concerns.

## Validation

Fault tests must prove no committed mutation produces irreconcilable entity/event state. Projections must rebuild from authoritative files.
