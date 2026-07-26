# Milestone 2 — Agent visibility and work inspection

## Goal

Let the operator supervise several coding agents and understand their work without continuously reading terminal output.

## Scope

### Agent attention

- classify shell, Claude Code, Codex, and unknown processes;
- working, waiting, needs-input, finished, failed, stale, and unknown states;
- source, confidence, observed time, and stale threshold;
- unread markers and quiet notifications;
- concise recent activity.

### Repository context

- canonical repository discovery from session working directory;
- branch, commit, and worktree status;
- changed files and diff statistics;
- inline diff viewer;
- recent commits;
- configured verification commands with bounded output;
- refresh after relevant filesystem or process events.

### UI

- session rows optimized for scanning;
- status icon plus text;
- inspector tabs for Overview, Changes, Activity, and Terminal details;
- filters for workspace, repository, agent, and attention state;
- predictable peek/inspector behavior.

## Non-scope

- autonomous code review;
- commits, rebases, pushes, or pull requests;
- cross-agent task orchestration;
- provider quota unification;
- Pacium queue.

## Acceptance criteria

1. The source and confidence of every agent state are visible.
2. Process existence alone cannot produce a confirmed “working” state.
3. Needs-input and failure states are discoverable without opening the terminal.
4. Notifications fire only for configured attention states.
5. Git information matches direct Git inspection.
6. Repository paths are canonicalized and bounded.
7. Verification commands come from explicit local configuration.
8. Terminal operation continues when Git inspection fails.
9. Diff rendering handles binary, large, renamed, and deleted files safely.

## Demo

Run several agents, leave one waiting, make another fail, complete a third with changes, and identify all three outcomes from the workspace before opening their terminals.
