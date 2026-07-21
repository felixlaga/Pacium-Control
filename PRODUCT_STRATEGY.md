# Product strategy

## Positioning

Pacium Control is a private operations console for teams that run coding agents through CLI tools on infrastructure they control.

It is not an IDE, a chat wrapper, a general autonomous-agent platform, or a terminal multiplexer. It sits above those tools and provides the operating layer: visibility, human decisions, safe control, evidence, and recovery.

### Category statement

> For technical founders and engineering teams operating multiple coding agents, Pacium Control is the private control plane that turns scattered CLI sessions into an observable, steerable, and reviewable system of work.

### Primary promise

Operate more parallel coding work with less cognitive load and greater confidence.

## Initial user

The initial user is a highly technical operator who:

- uses Claude Code and Codex CLI frequently;
- keeps long-running sessions in tmux;
- coordinates work across several repositories;
- delegates through a meta/orchestrator pattern;
- tolerates imperfect tooling because the underlying agents are valuable;
- cares deeply about speed, control, privacy, and inspectability;
- is currently the routing layer for questions, approvals, status, and recovery.

This user does not need to be convinced that coding agents matter. They need the operational burden reduced.

## Secondary users

### Team operator

A teammate who needs to inspect runs, answer assigned questions, steer allowed sessions, and review evidence without receiving unrestricted shell access.

### Reviewer

A technical lead who primarily sees review bundles, diffs, tests, decisions, and risk rather than terminal streams.

### Infrastructure owner

The person responsible for hosts, credentials, Tailscale policy, backups, session isolation, and recovery.

### Observer

A founder, product lead, or engineer who needs read-only awareness of progress and decisions.

## Jobs to be done

### When I return after being away

Help me understand what changed, what succeeded, what failed, what is blocked, and what needs me—without reading every terminal pane.

### When an agent needs a decision

Give me the minimum complete context, a recommendation, and clear options so I can answer in seconds.

### When work appears stuck

Tell me whether the agent is thinking, waiting, blocked, disconnected, rate-limited, or simply idle, and give me a safe intervention path.

### When I delegate parallel work

Keep branches, worktrees, ownership, dependencies, and provider sessions organized so agents do not corrupt each other’s work.

### When I review a result

Show the objective, decisions, diff, commits, checks, artifacts, risks, and unresolved items as one evidence bundle.

### When something goes wrong

Let me recover without losing sessions, history, decisions, or control.

## The wedge

The first product wedge is the **human-decision loop** around existing tmux sessions:

1. discover sessions;
2. display meaningful names and state;
3. receive a structured question;
4. answer it rapidly;
5. deliver and acknowledge the answer;
6. show resumed work;
7. link completion to evidence.

This loop provides immediate value and forces the architecture to solve identity, state, reliability, transport, UX, and audit correctly.

## Expansion sequence

### Phase A — Personal control plane

One operator, one host, existing tmux sessions, structured Inbox, terminal drawer, and basic run views.

### Phase B — Team operating console

Tailscale identity, roles, repository scopes, shared observation, assigned decisions, control leases, and review bundles.

### Phase C — Provider-native operations

Claude hooks, Codex App Server, live plans, approvals, usage, context pressure, and richer state confidence.

### Phase D — Distributed execution fabric

Several hosts, local connectors, resource awareness, run templates, restart manifests, and policy-driven placement.

### Phase E — Organizational intelligence

Patterns across runs, recurring failure detection, decision memory, quality analytics, and capacity planning—without compromising inspectability or human control.

## Differentiation

Pacium Control should differentiate through depth in five areas:

1. **Operational truth:** not merely chat transcripts, but live process, Git, plan, decision, and evidence state.
2. **Human attention design:** questions and approvals that are fast, contextual, assigned, and closed-loop.
3. **CLI-native control:** works with the tools advanced users already trust.
4. **Private infrastructure:** tailnet-only by default, with explicit privilege boundaries.
5. **Provider collaboration:** Claude and Codex can participate in the same workflow without pretending they are identical.

## Feature hierarchy

### Tier 1 — Must make the product useful

- Session discovery and naming.
- Read-only live activity.
- Structured prompt delivery.
- Questions, approvals, decisions, acknowledgement.
- Run, repository, agent, and task views.
- Terminal escape hatch.
- Tailscale identity and RBAC.
- Git worktree and evidence integration.

### Tier 2 — Must make the product trusted

- Idempotency and recovery.
- Audit history.
- Explicit status confidence.
- Stale-agent detection.
- Verification gates.
- Backups and restore.
- Provider usage visibility.
- Security hardening.

### Tier 3 — Must make the product scale

- Multi-host connectors.
- Templates and policies.
- Provider-aware routing suggestions.
- Review bundles and summaries.
- Mobile Inbox.
- Saved views and command palette.

### Tier 4 — Only after the core is excellent

- Historical analytics.
- Organization-wide benchmarks.
- Automated capacity optimization.
- Sophisticated policy recommendations.
- External product integrations.

## Non-goals as strategy

Pacium Control will not initially:

- invent a new general-purpose agent runtime;
- host models;
- replace GitHub or Git;
- replace tmux;
- become a browser IDE;
- expose public internet access by default;
- offer a shared credential proxy for personal provider subscriptions;
- automate every decision;
- optimize for nontechnical users;
- support every terminal application equally before the Pacium workflow is strong.

These constraints preserve focus.

## Success metrics

The product should measure outcomes, not activity vanity metrics.

### North-star metric

**Verified work completed per hour of human operator attention.**

This is difficult to measure perfectly, but it expresses the correct optimization target.

### Leading indicators

- Median time from question creation to answer.
- Percentage of blocking questions answered without opening a terminal.
- Percentage of answers acknowledged by the requesting agent.
- Time from run start to first verified artifact.
- Percentage of completed runs with required evidence.
- Number of active agents per operator without increased failure rate.
- Percentage of interventions performed through structured controls.
- Stale-agent detection precision.
- Recovery time after web, broker, or host disruption.
- Operator-reported confidence in run state.

### Guardrail metrics

- Unauthorized terminal-control attempts.
- Duplicate prompt or decision delivery.
- Worktree collision incidents.
- Lost or corrupt state events.
- False “complete” states.
- Human interruptions per completed task.
- Percentage of actions with missing attribution.

## Product quality bar

The initial release should feel narrow but inevitable. Every visible state should be intentional. Every error should suggest recovery. Every action should have clear scope and feedback. The product should never rely on the operator remembering an invisible convention.

A funded-looking product is not one with many features. It is one where the product thesis, interaction model, system boundaries, and execution discipline all agree.
