# Product definition

## Product name

**Pacium Control**

## Tagline

**Run the work. See the truth. Keep the human in control.**

## Definition

Pacium Control is a private web-based operating console for CLI coding agents running in tmux. It gives technical teams a shared, structured view of work while preserving the terminal as a low-level control surface.

The product turns several existing primitives into one coherent operating model:

| Existing primitive | Pacium meaning |
|---|---|
| tmux session | durable agent session |
| pane output | live activity and fallback terminal |
| prompt sent with `send-keys` | attributable, idempotent command |
| shared queue file | assigned question or approval |
| branch/worktree | task ownership and isolation |
| commit/diff/check | evidence |
| Claude/Codex status | normalized agent state |
| human answer | immutable decision |

## Core objects

### Workspace

A security and navigation boundary. The Pacium workspace contains the startup-specific workflow; a generic workspace can expose unrelated terminal sessions.

### Repository

A configured Git repository with allowed roots, verification commands, branch conventions, and access policy.

### Run

A coordinated unit of work with an objective, participants, plan, tasks, decisions, evidence, and lifecycle.

### Agent session

A provider-backed or generic terminal session associated with a host, tmux target, role, run, repository, branch, and worktree.

### Task

A bounded piece of work assigned to one agent with explicit acceptance criteria and dependencies.

### Question

A request for human judgment or direction. Questions offer context, recommendation, and options.

### Approval request

A request for permission to execute a concrete action. Approvals include risk, scope, command/tool details, duration, and policy implications.

### Decision

The immutable human response to a question or approval, with attribution and delivery lifecycle.

### Evidence

A fact that supports progress or completion: commits, diffs, checks, artifacts, logs, screenshots, or recorded waivers.

## Product surfaces

### Inbox

The personal queue of questions, approvals, failures, and review requests that need this user.

### Active

All work currently starting, running, waiting, verifying, blocked, or ready for review.

### Repositories

A repository-centric view of runs, agents, branches, worktrees, changes, and recent outcomes.

### Runs

The primary unit of coordinated work, combining plan, participants, activity, decisions, evidence, and terminal access.

### Agents

A fleet view showing role, provider, repository, current task, state, freshness, context, quota, and control actions.

### Review

Evidence bundles ready for human verification, integration, or release.

### Usage

Provider-specific limits, context pressure, reset windows, run budgets, and consumption trends.

### Activity

An attributable timeline of human, agent, Git, host, policy, and system events.

### Terminal

The raw escape hatch, exposed through a secure browser terminal and local attach instructions.

## User promise by surface

| Surface | Promise |
|---|---|
| Inbox | “Only show me what needs my judgment.” |
| Active | “Tell me what is happening right now.” |
| Repository | “Show me ownership and change in this codebase.” |
| Run | “Explain this objective from plan to evidence.” |
| Agent | “Show what this actor is doing and how certain we are.” |
| Review | “Let me verify outcomes, not read stories.” |
| Usage | “Warn me before capacity becomes a surprise.” |
| Activity | “Make every consequential action explainable.” |
| Terminal | “Give me precise control when abstractions are insufficient.” |

## Product modes

### Pacium mode

Opinionated around meta, orchestrator, worker, reviewer, questions, approvals, handoffs, and repository runs.

### General mode

A reusable host and tmux control plane for unrelated sessions. It provides session discovery, labels, terminal access, saved views, and audit without requiring the Pacium workflow.

The two modes share infrastructure and security but not all product semantics.

## Maturity model

### Level 0 — Terminal inventory

Sessions can be found and attached.

### Level 1 — Structured control

Prompts, leases, questions, and decisions are durable and attributable.

### Level 2 — Operational workflow

Runs, tasks, plans, agents, and evidence form one coherent system.

### Level 3 — Provider-native awareness

Claude and Codex contribute rich state, approvals, plans, and usage.

### Level 4 — Distributed operations

Several hosts and teams operate under shared policy and recovery procedures.

### Level 5 — Compounding intelligence

Historical patterns improve planning, escalation, review, and capacity without hiding the underlying evidence.
