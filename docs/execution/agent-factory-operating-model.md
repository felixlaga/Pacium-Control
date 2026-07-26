# Continuous agent execution model

> Historical blueprint: this operating model is not the active implementation sequence. Use [master-plan.md](master-plan.md) and [first-build-plan.md](first-build-plan.md).

This document describes how to run Claude and Codex implementation agents continuously in this repository without turning speed into architectural entropy.

## Objective

Use parallel agents to increase throughput while keeping:

- one coherent product;
- one canonical architecture;
- reviewable changes;
- reproducible evidence;
- clean main-branch integration;
- honest status.

The system should behave like an excellent engineering organization, not a swarm of independent code generators.

## Roles in the implementation factory

### Human product/technical owner

- sets priority and accepts architectural/security risk;
- resolves ambiguous product decisions;
- approves ADRs and milestone exits;
- reviews the highest-risk changes;
- protects focus.

### Repository orchestrator

May be a dedicated Claude/Codex session. It:

- maintains the ready queue;
- checks dependencies;
- assigns tasks, branches, and worktrees;
- enforces WIP limits;
- requests plans and handoffs;
- routes reviews;
- integrates accepted work;
- keeps roadmap/status current;
- never marks work complete without evidence.

### Implementation worker

- owns one bounded issue and worktree;
- follows the approved plan;
- updates tests and docs;
- stops on decisions beyond authority;
- produces a complete handoff/review bundle.

### Reviewer

- is independent of the implementation attempt where practical;
- checks acceptance criteria, architecture, security, failure behavior, tests, and docs;
- may use another provider to reduce shared blind spots;
- requests revision with precise evidence.

### Integrator

- owns the integration branch/worktree;
- serializes merges;
- resolves or delegates conflicts;
- runs post-integration checks;
- records actual merged evidence.

## Queue states

```text
idea
→ needs_product
→ needs_design
→ needs_architecture
→ ready
→ assigned
→ in_progress
→ review_ready
→ revision_requested
→ accepted
→ integrating
→ integrated
→ verified
→ closed
```

Alternate states:

```text
blocked · superseded · cancelled
```

Only `ready` issues may be assigned automatically.

## Definition of ready

An issue is ready when:

- user/system problem is clear;
- scope and non-scope exist;
- acceptance criteria are testable;
- dependencies are met;
- relevant interfaces are stable;
- security/failure considerations are present;
- work fits one reviewable change or is split;
- required owner decisions are resolved;
- an implementation agent can begin without inventing product strategy.

## WIP limits

More agents do not always mean more throughput.

Suggested initial limits:

- one active change per shared interface owner;
- one integration at a time per target branch;
- no more than two or three workers touching the same subsystem before its contracts stabilize;
- one high-risk security/state change in review at a time;
- no new assignment when review backlog exceeds implementation capacity.

The orchestrator should optimize for **completed, integrated work**, not active sessions.

## Assignment packet

Every worker receives:

- issue and acceptance criteria;
- linked specs/ADRs;
- branch;
- worktree;
- base commit;
- allowed scope;
- dependencies;
- expected tests;
- required reviewers;
- stop/escalation conditions;
- time or context budget.

No worker receives “build the whole thing” as an actionable task.

## Work rhythm

### Start of shift

1. Pull current main or integration base.
2. Verify worktree and branch ownership.
3. Read issue, spec, ADRs, and recent related changes.
4. Produce/update implementation plan.
5. Confirm assumptions and stop conditions.

### During work

- commit coherent checkpoints;
- keep tests close to behavior;
- update plan when reality changes;
- emit questions early;
- avoid unrelated cleanup;
- record exact verification;
- preserve unknowns rather than guessing.

### End of shift or context window

1. Leave repository in a coherent state.
2. Commit or explicitly document uncommitted work.
3. Run the best available checks.
4. Produce handoff.
5. Record failures and incomplete acceptance criteria.
6. Recommend one next action.
7. Release or transfer ownership explicitly.

## Overnight operation

An overnight orchestrator may:

- assign already-ready low/medium-risk issues;
- route completed work to independent review;
- run deterministic tests and diagnostics;
- create follow-up bugs from evidence;
- prepare integration candidates;
- stop workers at approval boundaries.

It may not, without prior policy:

- approve high-risk host/infrastructure actions;
- change frozen architecture;
- broaden permissions;
- merge failing or weakly evidenced work;
- publish public releases;
- delete uncertain worktrees;
- resolve product ambiguity by inventing requirements.

The morning summary should include:

- integrated changes;
- review-ready changes;
- failures;
- decisions needed;
- state/architecture drift;
- test health;
- recommended priorities.

## Review matrix

| Change type               | Minimum review                                     |
| ------------------------- | -------------------------------------------------- |
| Local pure logic          | Independent code/test review                       |
| Shared schema/protocol    | Contract owner + affected consumer                 |
| Filesystem state/recovery | State owner + fault-test evidence                  |
| Terminal/broker           | Broker owner + security reviewer                   |
| Identity/authorization    | Security reviewer + negative tests                 |
| Provider adapter          | Adapter owner + version fixtures + real smoke test |
| Git/worktree/integration  | Git owner + destructive/failure review             |
| User-facing workflow      | Product/design review + browser evidence           |
| Deployment/migration      | Operations + rollback evidence                     |

## Merge discipline

- Rebase or update against current target before final review when required.
- Integration owner merges one candidate at a time.
- Run post-merge checks on the actual integration commit.
- Do not equate branch test success with integration success.
- Record a merge conflict as work, not as an invisible fix.
- Keep main releasable or clearly mark known broken states; never leave silent breakage.

## Agent memory and context

Canonical memory lives in:

- accepted docs and ADRs;
- issue and implementation plan;
- Git commits;
- handoff and review bundle;
- test evidence.

Do not rely on a long-lived chat transcript as the only project memory. An agent should be replaceable without losing the reasoning required to continue.

## Quality signals the orchestrator should watch

- rising review backlog;
- many active agents with few integrations;
- repeated architecture questions;
- duplicated utility implementations;
- failing main branch;
- weak or missing tests;
- large, mixed-scope pull requests;
- agents editing outside assigned worktrees;
- status claims unsupported by evidence;
- repeated context exhaustion before handoff;
- “temporary” bypasses accumulating.

## Stop-the-line conditions

Pause new assignments when:

- state integrity is uncertain;
- authorization boundary is violated;
- duplicate commands/decisions occur;
- main branch cannot install/test;
- broker/terminal privilege model is bypassed;
- agents are colliding in worktrees;
- implementation has diverged from accepted architecture;
- review capacity is saturated;
- a provider update invalidates compatibility assumptions.

Fix the system before increasing concurrency.

## Daily scorecard

A concise operating review may include:

```text
Ready issues: 8
In progress: 4
Review ready: 3
Integrating: 1
Blocked on human: 2
Main: green
State integrity: green
Security gates: green
Largest risk: tmux reconnect unknown-outcome handling
```

The goal is flow and confidence, not maximum agent count.
