# Milestone 4 — Git execution and review

## Goal

Make parallel code modification safe and completion evidence-based.

## Scope

- repository registration and validation;
- worktree root policy;
- branch/worktree creation;
- ownership and transfer;
- base commit recording;
- Git status/diff/commit collection;
- verification command profiles;
- check execution and artifacts;
- task evidence requirements;
- review bundle generation;
- reviewer assignments and decisions;
- integration worktree/queue;
- conflicts;
- post-integration verification;
- cleanup;
- optional GitHub draft pull requests.

## Acceptance criteria

1. Every coding worker has a unique branch and worktree.
2. Assignment fails if the requested worktree is already actively owned.
3. Agent verifies base commit before editing.
4. Review bundle links objective, decisions, commits, diff, checks, artifacts, and limitations.
5. A task cannot become accepted without required evidence or an authorized waiver.
6. Checks are tied to exact commit/worktree and environment metadata.
7. Integration is serialized through an explicit owner/task.
8. Conflicts produce structured state and recovery options.
9. Post-integration checks update the review bundle.
10. Cleanup refuses active, dirty, or unpreserved worktrees.
11. GitHub unavailability does not block local review.
12. Repository paths cannot escape configured roots.

## Demo

- Start one run with Claude and Codex workers.
- Create isolated worktrees from one base.
- Produce non-overlapping changes and review bundles.
- Integrate one branch.
- Intentionally create a conflict with the second.
- Assign and resolve conflict as a task.
- Run post-integration checks.
- Approve review and safely clean worktrees.
