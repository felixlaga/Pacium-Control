# ADR-0010: Use a provider-neutral core with rich provider adapters

- Status: Accepted
- Date: 2026-07-20

## Context

Claude Code and Codex have different events, approval semantics, usage windows, and control protocols. A Claude-only domain model creates lock-in; a lowest-common-denominator model discards useful capabilities.

## Decision

Define stable shared concepts:

- agent session;
- run/task/plan;
- prompt;
- question;
- approval;
- decision;
- handoff;
- review;
- usage snapshot;
- event and state confidence.

Implement rich Claude and Codex adapters with typed extension data and capability negotiation.

## Consequences

### Positive

- Shared UX and workflow.
- Cross-provider collaboration.
- Providers can evolve independently.
- Native capabilities remain available.
- Future CLI providers can integrate without redesigning the product.

### Negative

- Adapter contracts require careful semantics.
- Some UI is capability-dependent.
- Normalization errors can misrepresent provider state.
- Testing matrix grows.

## Validation

Run equivalent question, approval, work, and handoff scenarios across both providers. The UI must expose source/confidence and preserve provider-specific quota semantics.
