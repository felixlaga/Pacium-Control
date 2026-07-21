# Vision

## The future Pacium Control is building

Software teams are moving from writing every line manually to directing systems that can plan, implement, verify, and revise work in parallel. The limiting factor is no longer merely model intelligence. It is the operator’s ability to understand and control many concurrent streams of work without losing trust.

Today, serious coding-agent workflows often live in terminal tabs, tmux panes, loosely named sessions, shared queue files, and private context held in one person’s head. The agents may be capable, but the operating environment is fragile. Important questions arrive without context. Permissions are buried in terminal output. It is hard to tell what is alive, what is blocked, what changed, what was verified, and what the human already decided.

Pacium Control makes that system legible.

It is a private operations console where a team can:

- see all active agent work across repositories and hosts;
- understand plans, tasks, dependencies, and progress;
- answer human questions and permission requests rapidly;
- steer the meta agent, orchestrator, or individual workers;
- inspect diffs, commits, checks, and review bundles;
- understand provider usage and context pressure;
- recover from stuck or disconnected sessions;
- retain the terminal as a precise, low-level escape hatch.

The ambition is not to make terminal output prettier. It is to create the **operating system for human-directed software production**.

## The product promise

At any moment, Pacium Control should answer five questions:

1. **What is happening?**
2. **Why is it happening?**
3. **What needs a human?**
4. **What changed, and what proves it?**
5. **How do we safely alter or stop the work?**

If the product cannot answer one of those questions, it is not yet complete.

## The north-star interaction

The operator enters through a calm Inbox rather than a wall of terminal text. Only consequential decisions are elevated. Each item includes the recommendation, consequences, affected repository, run, files, risk, and waiting time.

The operator can answer with one keystroke. The decision becomes immutable history. The requesting agent acknowledges it. The UI then shows when and how it was applied.

When the operator wants context, the run view exposes the plan, agents, worktrees, activity, changes, tests, usage, and open risks. When the operator wants to intervene, a command palette routes an instruction to the correct layer. When structured controls are insufficient, the terminal drawer opens immediately with a clear control lease and audit trail.

## The strategic wedge

Pacium Control begins with a narrow, high-value use case:

> A technical founder or engineering lead operating Claude Code and Codex CLI agents through tmux on private infrastructure.

That user already has capable agents and a working process. The pain is operational. Pacium Control can create value without asking them to replace their models, repositories, terminal tools, or orchestration logic.

The wedge expands naturally:

1. One operator, one VPS, several sessions.
2. A small team sharing visibility and decisions.
3. Multiple repositories and hosts.
4. Standardized run templates, reviews, and policies.
5. A durable internal platform for agent-assisted engineering.
6. Eventually, a product for other high-agency software teams.

## What makes the product defensible

The defensibility is not a chat interface. It is the accumulated operational model:

- reliable control of long-running CLI sessions;
- a rigorous domain model for runs, tasks, questions, approvals, handoffs, and evidence;
- provider-neutral observability across different agent CLIs;
- a deeply refined human-attention workflow;
- secure remote operation on infrastructure the team controls;
- historical data about what work patterns succeed, where agents stall, and which decisions matter.

Over time, Pacium Control can become the place where the team’s operational intelligence compounds.

## The end state

In the mature product, a team can start a complex objective, watch a coordinated system of Claude and Codex workers execute it across isolated worktrees, answer only the decisions that require human judgment, review evidence-backed outcomes, and ship with confidence.

The human remains accountable. The agents remain replaceable. The system remains inspectable.
