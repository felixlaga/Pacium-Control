# Handoffs and reviews

> Deferred blueprint: automated handoff and review workflows are not part of the initial local terminal and Pacium-mode roadmap.

## Handoff purpose

A handoff lets another agent or provider continue work without reconstructing context from terminal transcripts.

## Handoff packet

Required fields:

- source and destination;
- run and task;
- objective;
- constraints and acceptance criteria;
- repository;
- base commit;
- branch and worktree;
- current head commit;
- work completed;
- files changed;
- commands and checks run;
- check results;
- known failures;
- decisions that matter;
- open questions;
- assumptions;
- recommended next action;
- context/usage warning where relevant.

Use [the handoff template](../templates/agent-handoff.md).

## Handoff quality

A good handoff is:

- factual;
- bounded;
- reproducible;
- linked to evidence;
- explicit about uncertainty;
- small enough to consume;
- complete enough to act.

Avoid copying entire conversations. The destination can inspect linked history if needed.

## Provider changes

Before moving a task from Claude to Codex or vice versa:

1. freeze or stop concurrent edits in the old worktree;
2. produce a handoff;
3. decide whether destination continues the same branch/worktree or receives a new one;
4. record ownership transfer;
5. verify base/head state;
6. route unresolved questions;
7. start destination session;
8. preserve lineage.

Automatic provider fallback should not skip this process.

## Review bundle

A review bundle answers:

- What was requested?
- What decisions shaped the work?
- What changed?
- Why is it correct?
- What was tested?
- What remains uncertain?
- What should happen next?

Required sections:

1. Objective and acceptance criteria.
2. Scope and non-scope.
3. Plan/task outcome.
4. Human decisions and approvals.
5. Commits and diff summary.
6. Changed files.
7. Verification results.
8. Artifacts.
9. Security/operational impact.
10. Known limitations and failures.
11. Reviewer decision.
12. Integration and post-integration evidence.

## Review roles

### Worker self-check

The worker validates acceptance criteria and evidence before requesting review.

### Independent agent review

A separate agent may inspect the diff and tests. It should not share the worker’s assumptions blindly and may use another provider.

### Human review

A human reviewer focuses on product, architecture, risk, and evidence. The product should not force them to reread all agent reasoning.

### Integration review

After merge/rebase, run checks on the integration commit and update the bundle.

## Review decisions

- Approve.
- Approve with recorded waiver.
- Request revision.
- Reject/abandon.
- Split remaining scope into follow-up.
- Escalate security/architecture decision.

Every waiver names the missing evidence, reason, actor, and risk.

## Agent-generated summaries

Summaries are useful but clearly labeled. Claims link to:

- commit;
- diff;
- check;
- artifact;
- decision;
- event.

A summary without links cannot be the only basis for completion.

## Integration ownership

Integration is a separate role or task. The integrator:

- acquires the integration worktree/branch;
- validates source branch state;
- performs merge/rebase under policy;
- resolves or assigns conflicts;
- runs required checks;
- records integration commit;
- updates review bundle;
- releases ownership.

This prevents workers racing on a shared branch.
