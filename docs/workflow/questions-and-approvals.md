# Questions and approvals

## Why they are separate

A question asks for judgment. An approval asks for authority to execute a concrete action. Combining them weakens both user experience and security.

Examples:

**Question**

> Should we ship the backward-compatible two-stage migration or accept a maintenance window?

**Approval**

> Allow `terraform apply -target=module.staging` on `pacium-vps` for this run?

The first is a product/technical choice. The second grants operational permission.

## Question contract

A high-quality question includes:

- concise title;
- original requester;
- repository, run, task, and agent;
- why it is being asked now;
- blocking or non-blocking;
- clear prompt;
- options;
- recommendation;
- consequences and tradeoffs;
- evidence links;
- assignee or role;
- expiration or urgency if relevant.

### Question quality rules

- Options should be mutually understandable, not false precision.
- Include “ask for more context” or free-form response where appropriate.
- Do not make the recommended option visually indistinguishable from a preselected answer.
- Preserve the original request if meta rewrites it.
- One question should represent one decision where practical.
- A blocking flag must reflect actual dependency state.

## Question lifecycle

```text
open
→ enriched (optional)
→ answered
→ delivered
→ acknowledged
→ applied
```

Alternate exits:

```text
expired · superseded · cancelled · unable_to_apply
```

### Answered

An immutable human decision exists.

### Delivered

The adapter or bridge accepted the decision for transport.

### Acknowledged

The requesting workflow confirmed receipt.

### Applied

The workflow recorded an action or evidence tied to the decision.

Do not skip states merely to make the UI look faster.

## Decision immutability

A decision is never edited in place. If the human changes direction:

1. create a new decision;
2. link it as superseding the prior decision;
3. show whether prior work had already been applied;
4. route the new decision;
5. preserve both in history.

## Approval contract

An approval request includes:

- exact operation type;
- command or structured tool action;
- host;
- repository/worktree;
- requesting agent;
- execution identity;
- reason;
- risk level;
- expected side effects;
- requested duration/scope;
- safer alternative where known;
- current policy evaluation;
- provider callback/deadline.

## Approval actions

- **Deny** — do not execute.
- **Allow once** — valid only for this exact request.
- **Allow narrowly for this run** — creates or references a constrained temporary policy.
- **Edit and allow** — human narrows command/parameters before authorization.
- **Use another method** — rejects action and requests an alternative.
- **Escalate** — reassign to a higher-authority approver.

## Risk levels

Suggested categories:

### Low

Read-only or easily reversible operation within assigned worktree.

### Medium

Write operation within repository or local development environment with bounded impact.

### High

Infrastructure change, destructive command, network/security change, credential use, deployment, data migration, broad filesystem access, or action outside assigned worktree.

Risk classification assists policy but never replaces exact context.

## Approval policies

A run-scoped policy may allow a narrow class such as:

```text
Repository: checkout-api
Worktree: current worker only
Operation: run configured unit tests
Duration: this run
Risk ceiling: low
```

Avoid policies like:

```text
Allow all shell commands for all agents
```

Policies have revisions, owners, expiry, and audit history. A policy may authorize a request only if every constraint matches.

## Timeouts

Provider approval callbacks may have deadlines. The UI should show remaining time and distinguish:

- provider request expired;
- Pacium approval still recorded;
- action not executed;
- agent needs to re-request.

A late approval must not be applied to a different or changed command.

## Multiple humans

- An item is assigned to a user or role.
- First valid immutable answer wins unless workflow requires quorum.
- Other viewers receive immediate state update.
- Conflicting submissions return the existing decision.
- Reassignment and delegation are audited.
- High-risk approval may later support two-person policy, but is not an initial requirement.

## Legacy naming

The UI says “Needs me,” not `NEEDS-FELIX`, for all users. Compatibility files may retain names during migration, but domain schemas use user IDs and roles.
