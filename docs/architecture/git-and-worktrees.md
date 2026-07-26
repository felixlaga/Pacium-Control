# Git inspection

## Objective

Show what each terminal or coding agent is changing without turning the initial product into a full Git client.

## Repository discovery

For a session cwd:

1. Resolve the canonical path.
2. Ask Git for the repository root.
3. Match a configured repository or offer local registration.
4. Record only Pacium metadata; Git remains authoritative.

## Initial read model

- repository root and display name;
- branch or detached state;
- HEAD commit;
- worktree status;
- changed files;
- additions/deletions;
- diff on demand;
- recent commits;
- configured verification results.

Refresh is event-informed and debounced. A failed Git read does not affect terminal operation.

## Diff safety

- Bound file and total diff size.
- Mark binary files.
- Handle renamed, deleted, untracked, and conflicted files.
- Treat paths and diff text as untrusted.
- Never render diff content as application HTML.
- Preserve line endings and encoding diagnostics where possible.

## Verification

Verification commands are explicit local presets. Results include:

- preset name and command identity;
- cwd;
- start/end time;
- exit status;
- bounded output;
- observed branch/commit/worktree state;
- cancellation or timeout.

A result applies only to the recorded repository state.

## Mutations

The initial inspector does not expose arbitrary Git commands, commit, rebase, merge, push, or pull-request actions. Those require separate issues, UX, failure handling, and security review.

## Worker worktrees

Pacium mode may observe workers already using Git worktrees. Concurrent coding agents still follow the repository-wide one-worker/one-worktree rule, but automatic worktree creation is deferred.
