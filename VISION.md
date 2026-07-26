# Vision

Coding agents are already capable, but using several of them still means juggling terminal windows, remembering which repository each session owns, checking for prompts, and reconstructing what changed.

Pacium Control makes that local work legible.

## Product vision

The operator opens one calm workspace and sees:

- every active shell and coding-agent session;
- which session is working, waiting, finished, failed, or needs input;
- which repository and branch it belongs to;
- what files changed;
- which checks ran;
- which session deserves attention now.

The terminal remains immediate and fully usable. Pacium adds hierarchy, attention, context, and evidence around it.

## Pacium vision

For the specialized Pacium workflow, the same workspace gains:

- Meta and Orchestrator as pinned primary sessions;
- a compact worker view;
- the queue;
- clear questions and approvals;
- decisions and resulting activity.

Pacium mode should make the existing workflow easier without forcing it into a generalized project-management system.

## North-star interaction

The operator launches Claude Code and Codex in different repositories, moves between them by keyboard, notices that one needs input, answers it, inspects another agent’s diff, and returns to the active terminal without changing applications.

In Pacium mode, Meta and Orchestrator remain one keystroke away and the queue is visible beside the work.

## Long-term direction

First earn daily personal use:

1. excellent local terminal;
2. excellent multi-session management;
3. trustworthy agent attention;
4. useful Git context;
5. focused Pacium mode;
6. native provider enrichment;
7. optional durability and packaging.

Remote or team operation may be considered later, but it is not the product Pacium must prove first.
