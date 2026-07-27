# Milestone 3 — Pacium mode

## Goal

Operate the existing Meta, Orchestrator, worker, and queue workflow from the terminal workspace.

## Current status

PC-040 through PC-050 are implemented as a bounded localhost compatibility
loop. Pacium mode preserves the General terminal workspace, pins exact Meta and
Orchestrator bindings, targets one exact live PTY, observes and classifies one
whole-source queue item, records immutable question/approval decisions,
delivers through explicit configured compatibility methods, reconciles
transport artifacts and human lifecycle labels, and presents exact configured
workers plus current objective/plan and recent decision evidence.

This does not create generalized runs/tasks, infer agent work, parse multiple
items, or prove that a decision caused later Git or terminal activity.
Provider-native events and any stronger correlation belong to PC-060 onward.

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
9. Resulting terminal or Git activity is linked only when a future accepted
   source supplies explicit correlation; PC-050 deliberately makes no causal
   link from process, transport, or Git proximity.

## Demo

Meta or Orchestrator creates a real queue item. The operator opens Pacium mode,
inspects it, records a separate answer or approval outcome, deliberately
delivers it, and reviews transport plus explicit human-labelled lifecycle
evidence without manually editing queue files. The Control-context inspector
then reconstructs the current objective, plan, and recent decisions without
claiming provider acknowledgement or resulting work.
