# Git and worktrees

## Principle

Every coding worker gets one branch and one Git worktree. This is the primary safety boundary for parallel code modification.

## Repository registration

A repository configuration records:

- canonical host and root;
- default/integration branch;
- remote identity;
- worktree root;
- naming rules;
- verification commands;
- paths or operations requiring stronger approval;
- allowed execution identities;
- retention and cleanup policy.

All paths are canonicalized. A repository must be under an allowed root.

## Assignment contract

When a task is assigned, record:

- repository ID;
- base branch and exact base commit;
- worker branch;
- worktree path;
- owning agent session;
- run and task IDs;
- created timestamp;
- cleanup eligibility;
- integration target.

The agent verifies the expected worktree and base commit before editing.

## Naming

Suggested branch pattern:

```text
pacium/<run-short>/<task-short>/<provider>-<worker>
```

Suggested worktree directory:

```text
<worktree-root>/<repo-short>/<run-id>/<task-id>-<agent-short>
```

Names should be deterministic, shell-safe, and collision-resistant. IDs remain authoritative.

## Ownership rules

- One active coding owner per worktree.
- Reviewers use read-only inspection or a separate review worktree when necessary.
- Orchestrator does not directly edit worker worktrees unless ownership is formally transferred.
- Integration occurs in a separate integration worktree or controlled branch context.
- Human emergency edits are recorded as ownership intervention.

## Evidence collection

Pacium derives evidence from Git rather than storing a duplicate commit database.

Evidence references may include:

- base and head commit;
- commit list;
- changed file list;
- diff statistics;
- patch or diff view generated on demand;
- author/execution identity;
- branch status;
- uncommitted changes;
- merge base;
- conflicts;
- signed or verified status where configured.

## Verification commands

Repositories define explicit commands such as:

- formatting check;
- type checking;
- unit tests;
- integration tests;
- build;
- security scan;
- project-specific smoke tests.

Commands are configuration controlled by repository owners, not arbitrary browser input. Results include:

- exact command profile/version;
- start/end time;
- exit status;
- bounded stdout/stderr or artifact reference;
- environment metadata safe for retention;
- commit/worktree tested.

A green check applies only to the commit and environment recorded.

## Integration flow

```text
Worker task review-ready
→ evidence bundle generated
→ reviewer approves or requests revision
→ integration task acquires target ownership
→ update/rebase/merge under policy
→ resolve conflicts explicitly
→ run post-integration verification
→ record integration commit and result
→ mark task/run integrated
```

Do not let several workers merge into the same branch concurrently without an integration queue or lock.

## Conflicts

Conflicts are first-class operational state, not generic command failures.

The UI should show:

- source branch and base;
- integration target;
- conflicting files;
- likely owning tasks;
- last successful verification;
- options: rebase worker, assign conflict-resolution task, abandon candidate, or ask human.

## Cleanup

A worktree is removable only when:

- task is completed, cancelled, or superseded;
- uncommitted changes are absent or explicitly preserved;
- commits are reachable from a retained branch or bundle;
- review and integration references are stored;
- no active session uses the directory;
- retention policy permits cleanup.

Cleanup is audited and reversible where practical through retained branches and snapshots.

## GitHub integration

GitHub is optional and comes after local Git correctness.

Potential capabilities:

- create draft pull request;
- attach review bundle summary;
- read check status;
- link issues;
- update PR description from deterministic evidence;
- record merge outcome.

Pacium must remain usable without GitHub availability.
