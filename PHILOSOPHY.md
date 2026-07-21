# Philosophy

Pacium Control is built on a specific view of how humans and coding agents should work together. This philosophy should shape product decisions, architecture, copy, and engineering tradeoffs.

## 1. Build a cockpit, not a terminal theme

A terminal is an excellent primitive and a poor management interface. It exposes everything with almost no hierarchy. It is optimized for direct manipulation by one expert at one moment, not supervision of many concurrent actors over time.

Pacium Control must transform raw activity into operational meaning:

- terminal bytes become agent activity;
- prompts become durable commands;
- interruptions become questions or approvals;
- branches become work ownership;
- commits and checks become evidence;
- stalled output becomes a detectable state;
- human answers become immutable decisions.

The raw terminal remains available because abstractions leak. It should not dominate routine work.

## 2. Preserve capable tools; add the missing control layer

Claude Code, Codex, tmux, Git, Tailscale, and the shell are already powerful. Pacium Control should not rebuild them badly.

- tmux owns process continuity and terminal sessions;
- Git owns source history and merge mechanics;
- the filesystem owns inspectable coordination state;
- provider CLIs own model interaction;
- Tailscale owns private networking and machine identity;
- Pacium Control owns orchestration visibility, human interaction, policy, and safe control.

A clear division of responsibility keeps the system simpler and more trustworthy.

## 3. Human attention is the premium resource

The product should not notify humans merely because something happened. It should route only work that needs judgment, permission, or review.

Every interruption must answer:

- Why am I seeing this?
- Is work blocked?
- What does the system recommend?
- What are the consequences?
- What evidence should I inspect?
- Who will act on my answer?

The measure of success is not notification volume. It is the speed and quality of consequential decisions.

## 4. Authority must remain explicit

Autonomy without boundaries is operational debt. Every agent action should occur within a clear scope:

- repository;
- branch and worktree;
- host;
- task;
- allowed tools;
- permission policy;
- time or usage budget;
- escalation path.

The product should make authority visible and revocable. “Auto mode” is not a blanket override; it is a set of narrow, inspectable permissions.

## 5. Evidence outranks confidence

An agent saying “done” is an assertion. A diff, commit, test result, artifact, and satisfied acceptance criterion are evidence.

Pacium Control should prefer deterministic facts and then use models to explain those facts. Summaries must link to their sources. Review pages should distinguish:

- observed facts;
- agent claims;
- human decisions;
- inferred status;
- unavailable data.

The interface must never make uncertain state look certain.

## 6. Make failure calm and recoverable

Long-running agent systems will fail in mundane ways: network loss, expired credentials, stale sessions, crashed processes, corrupted output, conflicting branches, exhausted quotas, and ambiguous prompts.

The product should assume failure and design for it:

- processes survive browser disconnects;
- web and broker restarts do not kill tmux sessions;
- state writes are atomic;
- actions are idempotent;
- session manifests enable reconstruction;
- degradation is visible;
- recovery steps are explicit;
- no failure silently becomes data loss.

Reliability is a product feature because trust collapses quickly when operators cannot explain a failure.

## 7. Keep the system inspectable

A small, expert team should be able to understand Pacium Control without a proprietary database console or hidden cloud service.

State lives in readable files. Events are append-only. Git history is real. tmux sessions can still be attached from a shell. The broker exposes a narrow protocol. Backups can be inspected and restored with ordinary tools.

Inspectability is not nostalgia. It is a method for preserving agency under pressure.

## 8. Be provider-plural, not provider-agnostic in the shallow sense

Claude and Codex have different strengths, protocols, limits, and failure modes. Pacium Control should normalize the concepts that are truly common while preserving provider-specific capabilities.

The domain model should support both:

- a unified `AgentSession`, `Task`, `Question`, `Approval`, and `UsageSnapshot`;
- provider-specific details such as Claude hooks or Codex turn events.

Lowest-common-denominator integrations create mediocre products. Provider lock-in creates strategic fragility. The correct design has a stable core and rich adapters.

## 9. Optimize for legibility under load

A beautiful empty dashboard is not the challenge. The challenge is five repositories, twenty agents, eleven open decisions, multiple failures, and a quota reset approaching.

The interface should remain calm through:

- strong hierarchy;
- stable naming;
- consistent states;
- restrained color;
- progressive disclosure;
- keyboard control;
- personal unread cursors;
- clear ownership;
- dense but readable tables and timelines.

Visual polish is functional when it reduces cognitive load.

## 10. The product is workflow-opinionated, not intelligence-opinionated

Pacium Control should strongly shape how work is isolated, questioned, approved, reviewed, and evidenced. It should not dictate how the meta agent reasons or how the orchestrator decomposes every task.

The system provides contracts and rails, not a new universal planner.

## 11. Build the narrow truth before the broad vision

The first excellent product is not a giant dashboard. It is one reliable loop:

```text
Agent asks → human understands → human decides → agent acknowledges → work resumes → evidence appears
```

Every milestone should deepen or widen a loop that already works. Avoid building breadth on top of unproven control semantics.

## 12. Earn automation

Automation should be introduced only after the system can observe, explain, and reverse the corresponding manual action. The sequence is:

1. make it visible;
2. make it controllable;
3. make it reliable;
4. make it policy-driven;
5. then automate it.

This prevents accidental complexity from masquerading as intelligence.
