# ADR-0011: Use one authoritative central state writer

- Status: Accepted
- Date: 2026-07-20

## Context

Filesystem persistence becomes unsafe if API workers, provider hooks, broker processes, and remote hosts all mutate entity files independently.

## Decision

All central coordination mutations flow through one state coordinator. Other processes submit typed commands or observations. Remote hosts never write the central state directory directly.

The coordinator serializes committed revisions, validates expected versions, journals multi-file changes, and publishes events.

## Consequences

### Positive

- Simple ordering and concurrency model.
- Reliable idempotency.
- Easier journal recovery.
- Clear authorization and audit boundary.
- No distributed filesystem locking.

### Negative

- One process is a write-availability dependency.
- Active-active web writers are not supported.
- Throughput is bounded by one coordinator, though likely ample initially.
- Failover requires deliberate design.

## Alternatives considered

- Per-entity lock files from many writers: stale-lock and recovery complexity.
- Shared network filesystem: does not solve semantic concurrency.
- Distributed database/consensus: disproportionate to initial scale.

## Validation

Load and recovery tests must demonstrate expected throughput and safe restart. If availability becomes insufficient, a future leader/failover design requires a superseding ADR.
