# Implementation master plan

## Objective

Turn this blueprint into a trustworthy daily-use product through a sequence of end-to-end vertical slices. The plan is optimized for parallel agent execution without allowing architectural fragmentation.

## Operating rule

At all times, the main branch should represent an honest, runnable state. A milestone may be incomplete, but merged behavior must be real, tested, documented, and discoverable.

## Stage 1 — Establish the engineering substrate

### Outcomes

- clean monorepo and development environment;
- shared contracts;
- filesystem state coordinator;
- fixtures and test harnesses;
- first production-shaped service startup;
- verification evidence in CI.

### Why first

Every later workflow depends on durable IDs, events, idempotency, restart behavior, and a disciplined repository. Building UI first would create false progress and force persistence semantics to be retrofitted.

## Stage 2 — Prove one-host tmux control

### Outcomes

- discover sessions;
- classify and name them;
- stream read-only terminal;
- control through an expiring lease;
- deliver a structured prompt exactly once;
- survive process restarts.

### Why second

tmux and PTY behavior are the highest technical uncertainty. The team should validate them before committing to a broad interface.

## Stage 3 — Complete the human-decision loop

### Outcomes

- structured question;
- assigned Inbox item;
- one-keystroke answer;
- immutable decision;
- delivery;
- acknowledgement;
- application evidence.

### Why third

This is the product wedge and forces identity, authorization, state, streaming, UX, and agent transport to work together.

## Stage 4 — Model coordinated work

### Outcomes

- repositories;
- runs;
- plans;
- tasks;
- agent roles;
- worktree ownership;
- deterministic evidence;
- review bundles.

### Why fourth

Once decisions and control are reliable, the product can shift from session management to work management.

## Stage 5 — Add provider-native depth

### Outcomes

- Claude hooks/status;
- Codex App Server;
- provider-specific usage;
- normalized state confidence;
- provider-neutral handoffs;
- adapter degradation and fallback.

### Why fifth

Native integration should enrich a working product, not become a prerequisite for basic visibility and control.

## Stage 6 — Expand to multiple hosts

### Outcomes

- host enrollment;
- outbound command/event channel;
- remote broker;
- disconnect reconciliation;
- local-machine support;
- restart manifests.

### Why sixth

Multi-host semantics are easier once single-host commands, events, idempotency, and recovery are proven.

## Stage 7 — Harden for continuous operation

### Outcomes

- security audit;
- backup and restore drills;
- performance and soak tests;
- diagnostics and support bundles;
- polished mobile Inbox;
- policy and notification refinement;
- release operations.

## Parallel workstreams

Parallelism is valuable only when interfaces are stable.

### Safe early parallelism

- state schemas and fault-test harness;
- design system and static screen prototypes against fixtures;
- tmux control-mode spike;
- PTY terminal spike;
- Tailscale identity configuration research;
- provider payload fixture collection;
- documentation and threat-model refinement.

### Unsafe early parallelism

- several teams inventing separate domain models;
- UI and API independently defining question lifecycle;
- broker and web both implementing authorization;
- provider adapters writing state directly;
- Git automation before worktree ownership rules exist.

## Integration cadence

Use short branches and weekly or more frequent integration. Each workstream maintains:

- current objective;
- interface contract;
- owner;
- branch/worktree;
- demo path;
- known risks;
- next integration point.

## Decision checkpoints

### Checkpoint A — State engine

Before Milestone 1, demonstrate crash recovery, idempotency, snapshots, and no-database compliance.

### Checkpoint B — tmux control

Before expanding UI, demonstrate safe read/write separation, restart behavior, and prompt delivery.

### Checkpoint C — human-decision loop

Before provider-native work, use the product to answer and acknowledge real workflow questions for a sustained pilot.

### Checkpoint D — worktree and review

Before automatic parallel task routing, demonstrate that task ownership and integration prevent collisions.

### Checkpoint E — multi-host

Before enrolling production laptops/servers, pass disconnect and reconciliation tests in a disposable environment.

## Delivery artifacts

Every milestone produces:

- runnable release candidate;
- demo script;
- acceptance evidence;
- updated architecture and operations docs;
- known limitations;
- migration/rollback notes;
- next-milestone risk update.

## Anti-plan

Do not spend the first months on:

- a universal workflow builder;
- advanced analytics;
- public multi-tenancy;
- Kubernetes;
- dozens of provider integrations;
- perfect historical transcript parsing;
- automatic model selection;
- custom desktop applications;
- speculative scale architecture.

Build the narrow operating loop so well that daily use becomes obviously better than tmux alone.
