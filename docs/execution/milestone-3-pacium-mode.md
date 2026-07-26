# Milestone 3 — Pacium mode

## Goal

Operate the existing Meta, Orchestrator, worker, and queue workflow from the terminal workspace.

## Scope

### Workspace mode

- General/Pacium toggle;
- Pacium configuration per workspace;
- pinned Meta and Orchestrator sessions or presets;
- explicit prompt target;
- compact worker/session group;
- current objective and optional plan context;
- recent decisions and resulting activity.

### Queue compatibility

- configure known queue files;
- watch and parse supported formats conservatively;
- store source path, content hash, observation revision, and session context;
- display original text and parsing confidence;
- separate questions, approvals, failures, and review requests;
- deduplicate across restart and file rewrite;
- answer with immutable local decision metadata;
- deliver through an explicit configured compatibility mechanism;
- record delivered, acknowledged, applied, failed, unknown, and conflicted states where observable.

### UX

- queue list and inspector in the right panel;
- keyboard answer flow;
- reason, source, requesting session, consequence, and evidence;
- clear separation between terminal focus and queue shortcuts;
- errors that explain which files and sessions were untouched.

## Non-scope

- generalized runs, tasks, and policies;
- automatic worker launch and worktree allocation;
- organization roles;
- provider-native approvals beyond the queue adapter;
- remote queue access.

## Acceptance criteria

1. Pacium mode does not destroy General-mode layout or session context.
2. Meta and Orchestrator are visually distinct and easy to target.
3. Queue observation never mutates source files.
4. Answers are delivered at most once for one decision identity.
5. Ambiguous rewrites or competing answers create conflicts.
6. Questions cannot authorize approval actions.
7. Original queue text remains inspectable.
8. Queue parse and delivery failures leave source files and terminals intact.
9. Resulting terminal or Git activity can be linked when observable.

## Demo

Meta or Orchestrator creates a real queue item. The operator opens Pacium mode, inspects it, answers, observes delivery and acknowledgement, and sees the resulting activity without manually editing queue files.
