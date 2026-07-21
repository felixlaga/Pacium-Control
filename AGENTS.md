# Agent operating contract

This file is mandatory reading for every Claude, Codex, or other implementation agent working in this repository.

## Current truth

This repository is a **documentation-only blueprint**. There is no product code yet. Do not claim a feature is implemented, tested, deployed, or production-ready unless the corresponding code and evidence exist in the current branch.

Read [STATUS.md](STATUS.md) before starting work.

## Mission

Build Pacium Control into a private, reliable operating console for CLI coding agents running in tmux. The product must make agent work observable, steerable, reviewable, and recoverable while keeping the human in control.

## Read order

Before implementing a new area, read:

1. [README.md](README.md)
2. [PRINCIPLES.md](PRINCIPLES.md)
3. [ARCHITECTURE.md](ARCHITECTURE.md)
4. [SECURITY.md](SECURITY.md)
5. The relevant detailed specification under `docs/`
6. All ADRs related to the change
7. The issue and implementation plan for the work

Do not infer architecture from file names alone.

## Non-negotiable constraints

1. **CLI-only providers.** No Claude or Codex desktop application integration.
2. **No application database.** Do not add SQLite, PostgreSQL, Redis, LevelDB, an ORM, or a hosted datastore.
3. **tmux remains the runtime.** Do not invent a replacement process/session engine.
4. **One authoritative state writer.** All central entity and event mutations flow through the state coordinator.
5. **Tailnet-only production ingress.** Do not expose the application publicly by default.
6. **Verified identity, not IP authorization.** Never model a Tailscale IP as a permanent person.
7. **Broker privilege boundary.** The web/API process must not receive direct tmux socket access.
8. **One worktree per coding worker.** Never assign concurrent writers to one checkout.
9. **Questions and approvals are distinct.** Do not flatten them into one generic “request.”
10. **Evidence-backed completion.** An agent’s prose claim is not sufficient evidence.
11. **Terminal is secondary.** Do not make raw terminal output the primary product experience.
12. **Honest status.** Distinguish designed, implemented, validated, and production-proven behavior.

A change to any of these constraints requires an ADR and explicit approval from the project owner.

## How to work

### Start from an issue

Every implementation change should have:

- a problem statement;
- scope and non-scope;
- acceptance criteria;
- security and failure considerations;
- test plan;
- linked specification or ADR;
- dependencies.

Use [the issue template](docs/templates/issue.md).

### Write an implementation plan

Before nontrivial code, create or update an implementation plan using [docs/templates/implementation-plan.md](docs/templates/implementation-plan.md).

A good plan identifies:

- system boundaries touched;
- state transitions;
- concurrency risks;
- failure points;
- tests;
- migration or compatibility behavior;
- documentation changes.

### Build vertical slices

Prefer a narrow end-to-end path over a broad layer with no real consumer.

Good:

```text
Create question → persist atomically → display in Inbox → answer → deliver → acknowledge
```

Weak:

```text
Create 40 database-style repository classes for future entities
```

### Keep changes reviewable

One pull request should have one coherent purpose. Avoid drive-by refactors. Separate schema changes, behavior changes, and cosmetic changes when that improves review.

### Update the contract

If implementation reveals a false assumption, update the relevant spec or propose an ADR. Do not silently diverge from the blueprint.

## State rules

- Entity IDs are immutable and globally unique.
- Every entity has `schemaVersion`, `revision`, `createdAt`, and `updatedAt` where applicable.
- Commands carry idempotency keys.
- Events are append-only.
- Materialized projections are rebuildable and never authoritative.
- Multi-file mutations use the transaction journal.
- Writes use temporary files, durability barriers where required, and atomic rename.
- Corrupt or unknown data is quarantined; it is not silently discarded.
- Remote hosts never write central state directly.
- Secrets are not stored in entity files or events.

## Security rules

- Validate authorization at the action boundary, not only in the UI.
- Treat tmux socket access as full control of that tmux server.
- Use narrow, short-lived terminal grants and leases.
- Validate WebSocket origin and authentication independently.
- Self-host browser terminal assets; no analytics or session replay on terminal routes.
- Redact secrets before durable logging.
- Separate operator identity, requesting agent, and provider execution identity.
- Destructive actions need explicit scope and confirmation.
- Development auth must fail closed in production configuration.

## Git and worktree rules

- Every coding worker receives one branch and one worktree.
- Record the base commit at assignment time.
- Do not modify another worker’s worktree.
- Do not rewrite shared branch history without explicit integration policy.
- Do not delete a worktree until commits and evidence are preserved and the run permits cleanup.
- Integration is a separate task owned by the orchestrator or designated integrator.

## User experience rules

- Show the reason, owner, and consequence of every actionable item.
- Pair color with text or icon; color alone is never semantic.
- Keep focus and keyboard behavior predictable.
- Preserve deep links and browser navigation.
- Surface freshness and confidence for status.
- Errors must state what happened, what survived, and what the user can do.
- Do not expose internal identifiers as the primary label.
- Optimize mobile for decisions, not terminal-heavy work.

## Testing expectations

Every behavior change should be covered at the lowest useful level and at least one boundary level.

Required categories as applicable:

- unit tests for pure logic;
- contract tests for broker/provider protocols;
- property or fault-injection tests for filesystem state;
- integration tests with real tmux;
- browser tests for critical workflows;
- security tests for authorization and terminal grants;
- restart/recovery tests;
- clean-install and production-build tests.

Use [the testing strategy](docs/execution/testing-strategy.md).

## Definition of done

A task is done only when:

- acceptance criteria are met;
- tests pass;
- failure behavior is tested;
- security implications are addressed;
- docs are updated;
- limitations are recorded;
- no unrelated generated artifacts or environment traces are committed;
- a reviewer can reproduce the result.

See [docs/execution/definition-of-done.md](docs/execution/definition-of-done.md).

## Communication protocol

When handing work to another agent, use [the handoff template](docs/templates/agent-handoff.md). Include:

- objective;
- branch and worktree;
- base commit;
- work completed;
- files changed;
- tests run and exact results;
- unresolved issues;
- assumptions;
- recommended next action.

Never hand off with only “continue from here.”

## Prohibited behavior

- Do not fabricate test results or implementation status.
- Do not add placeholder production behavior without clearly marking and tracking it.
- Do not bypass security checks to make a demo pass.
- Do not add broad shell-execution endpoints.
- Do not parse arbitrary shell strings where a typed operation can exist.
- Do not use terminal scraping as the sole source of provider truth when a native adapter is available.
- Do not silently swallow state corruption or failed delivery.
- Do not introduce a database because filesystem implementation feels unfamiliar.
- Do not optimize for theoretical scale before measuring the real workload.
- Do not commit secrets, tokens, machine-specific paths, dependency caches, or generated build output.

## When uncertain

Prefer the choice that is:

1. safer;
2. more inspectable;
3. more reversible;
4. narrower in privilege;
5. easier to test under failure;
6. aligned with the explicit product philosophy.

If uncertainty affects a frozen decision or public contract, write an ADR rather than guessing.
