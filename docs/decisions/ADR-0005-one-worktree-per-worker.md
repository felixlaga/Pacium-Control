# ADR-0005: Assign one branch and worktree per coding worker

- Status: Accepted
- Date: 2026-07-20

## Context

Claude and Codex may work simultaneously. Sharing one checkout creates race conditions, overwritten files, mixed uncommitted state, ambiguous ownership, and unreliable review evidence.

## Decision

Every coding worker receives:

- one task;
- one repository;
- one branch;
- one Git worktree;
- one recorded base commit;
- one active ownership record.

Integration happens through a separate task/worktree/owner.

## Consequences

### Positive

- Safe parallel edits.
- Clear ownership and evidence.
- Easy comparison of candidate solutions.
- Provider handoffs can preserve lineage.
- Failures do not contaminate another worker’s checkout.

### Negative

- More disk usage.
- Worktree cleanup and branch lifecycle need tooling.
- Repositories with unusual worktree constraints need handling.
- Integration conflicts still require explicit resolution.

## Alternatives considered

- Shared worktree with coordination messages: too fragile.
- Agents editing sequentially in one checkout: prevents useful parallelism.
- Container copy per task without Git worktrees: duplicates repositories and weakens branch integration.

## Validation

Assignment must reject duplicate active ownership. Cleanup must refuse dirty or active worktrees. Integration and conflict scenarios must be exercised end to end.
