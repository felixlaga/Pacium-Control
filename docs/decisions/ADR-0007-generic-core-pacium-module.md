# ADR-0007: Separate the generic control core from the Pacium workflow module

- Status: Accepted
- Date: 2026-07-20

## Context

The operator wants Pacium-specific meta/orchestrator workflows and also wants to use the application for unrelated terminal sessions and future purposes.

Hardcoding every session into the Pacium run model would make the product less reusable and force irrelevant concepts onto generic terminals.

## Decision

Build:

### Generic core

- hosts;
- tmux servers/sessions/windows/panes;
- terminal streams and leases;
- labels, identities, access policy;
- activity and saved views.

### Pacium module

- repositories;
- runs;
- meta/orchestrator/worker/reviewer roles;
- tasks and plans;
- questions, approvals, decisions;
- worktrees, evidence, handoffs, reviews, usage.

A workspace mode determines available semantics and navigation.

## Consequences

### Positive

- General terminal use remains possible.
- Core infrastructure can be reused.
- Pacium UX stays opinionated.
- Unknown sessions can exist before classification.

### Negative

- Domain relationships must allow sessions without runs.
- UI/navigation has conditional surfaces.
- Some features have generic and Pacium variants.

## Validation

A generic session must be observable and controllable without fake run/task objects. A Pacium worker must satisfy stronger repository/run/worktree constraints.
