# Product strategy

## Positioning

Pacium Control is a clean local terminal workspace for developers who run several CLI coding agents.

It combines real terminals, session organization, attention states, and Git inspection. Pacium mode adds Meta, Orchestrator, and the queue.

## Initial user

The initial user:

- works locally with Claude Code, Codex, shells, and Git;
- runs several sessions across repositories;
- wants fewer terminal windows and less manual checking;
- values keyboard speed, privacy, inspectability, and clean design;
- already uses a Meta/Orchestrator/queue workflow or wants to.

## Primary jobs

### Manage terminals

Launch, group, switch, split, rename, pin, interrupt, relaunch, and close without hunting across applications.

### Know what needs attention

See which agent is waiting, failed, finished, stale, or needs input.

### Inspect work

View repository, branch, changed files, diff, commits, and verification beside the terminal.

### Operate Pacium

Keep Meta and Orchestrator close, surface the queue, answer clearly, and see what happened next.

## Wedge

The wedge is not the queue alone. It is a terminal workspace good enough to use every day:

```text
launch terminals
→ organize sessions
→ notice attention
→ inspect work
→ act without switching applications
```

Pacium mode compounds that value for the specialized workflow.

## Differentiation

1. Real local terminals, not a fake chat shell.
2. Agent attention without claiming more semantic certainty than exists.
3. Git context beside the work.
4. Clean, Linear-inspired interaction discipline.
5. Focused Meta/Orchestrator/queue mode.
6. Optional tmux durability without making tmux mandatory.
7. Local-first operation without accounts or cloud dependencies.

## Release sequence

1. Real local terminal.
2. Multi-session workspace.
3. Agent attention and Git inspection.
4. Pacium mode and queue decisions.
5. Native Claude/Codex enrichment.
6. Optional tmux and packaged release.

## Success metrics

### Primary

- Percentage of coding-agent sessions run through Pacium during the pilot.
- Median time to find the session needing attention.
- Number of active sessions manageable without confusion.
- Percentage of agent work inspected without switching applications.

### Pacium

- Percentage of queue items understood and answered from Pacium mode.
- Duplicate or conflicted decision count.
- Time from queue item appearance to answer.
- Percentage of decisions linked to observable resulting activity.

### Quality guardrails

- duplicate terminal input;
- lost or leaked processes;
- unbounded terminal memory;
- false confirmed status;
- unsafe non-loopback listener;
- cross-origin terminal-control attempt;
- notification volume per useful intervention;
- keyboard/focus defects.

## Explicit deferral

Remote, multi-user, multi-host, public SaaS, generalized workflow management, automatic worktree orchestration, and organization analytics are not part of the initial strategy.
