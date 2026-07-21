# Screen specifications

## Global shell

### Header

- workspace switcher;
- global search;
- command palette trigger;
- connection/health summary;
- current user menu.

### Left rail

- Inbox with badge count;
- Active;
- Repositories;
- Runs;
- Agents;
- Review;
- Usage;
- Activity;
- Terminal;
- pinned repositories/runs;
- Settings for authorized users.

### Global indicators

- workspace paused;
- broker degraded;
- disconnected hosts;
- provider authentication problem;
- backup overdue.

Indicators should not consume permanent space when healthy.

## Inbox

### Purpose

Resolve human-dependent work quickly and safely.

### Sections

1. Blocking questions.
2. Approvals.
3. Failures needing intervention.
4. Review requests.
5. Non-blocking questions.

### List row

- type and severity icon;
- concise title;
- repository and run;
- requesting agent;
- assignee;
- waiting time;
- blocking indicator;
- recommendation marker;
- unread state.

### Inspector

For a question:

- full prompt;
- why it is being asked;
- recommended choice and reasoning;
- options and consequences;
- relevant files, diff, logs, commands, or artifacts;
- free-form note;
- answer keyboard shortcuts;
- history and related decisions.

For an approval:

- exact action;
- host and execution identity;
- repository/worktree;
- command or tool parameters;
- risk;
- reason;
- scope and duration;
- alternative proposed by agent;
- policy evaluation;
- deny/allow actions.

## Active

### Purpose

Show the operational pulse without requiring drill-down.

### Grouping

Default by state:

- Needs human.
- Working.
- Verifying.
- Waiting on dependency.
- Review ready.
- Stale or disconnected.

Alternative grouping by repository, run, host, or provider.

### Run row

- objective;
- repository;
- owner;
- agent count by state;
- plan progress;
- open questions/approvals;
- latest evidence;
- usage warning;
- last meaningful event.

## Repository page

### Overview

- active runs;
- agent count;
- branches and worktrees;
- open decisions;
- verification health;
- recent completion;
- repository usage;
- configured policies.

### Work

Tasks and runs, with dependency and ownership views.

### Changes

Changed files, commits, diff stats, review state, integration status.

### Decisions

Searchable question, approval, and decision register.

### Sessions

All associated sessions, including generic terminals.

### Settings

Roots, default branch, verification commands, role policy, naming, retention.

## Run page

### Header

- objective;
- state;
- repository or repositories;
- owner;
- created/updated time;
- pause/resume/cancel controls;
- open terminal and command palette actions.

### Summary strip

- tasks complete/total;
- active agents;
- waiting items;
- changed files/commits;
- checks;
- context and quota warnings.

### Main tabs

```text
Overview · Plan · Agents · Changes · Decisions · Review · Activity
```

### Overview

- objective and acceptance criteria;
- current phase;
- deterministic “since last checked” summary;
- current blockers;
- latest evidence;
- recommended operator action.

### Plan

Revision history, steps, dependencies, ownership, current state, and reasons for changes.

### Agents

Cards or table with role, provider, task, branch, worktree, state, freshness, context, usage, and quick actions.

### Changes

Commits, changed files, diff, tests, artifacts, integration state.

### Decisions

Questions, approvals, immutable answers, acknowledgement, application evidence.

### Review

Review bundle, reviewer comments, revisions, approval, integration, post-integration checks.

## Agent detail

- display name and immutable ID;
- role and provider;
- host and tmux target;
- repository, branch, worktree, base commit;
- current task and plan step;
- state, confidence, freshness;
- context and usage;
- recent meaningful events;
- prompts and acknowledgements;
- questions/approvals;
- terminal drawer;
- interrupt, pause, stop, restart-from-manifest actions under policy.

## Usage

Provider cards remain separate.

### Claude

- current model;
- context usage;
- five-hour and seven-day windows when available;
- reset times;
- session duration;
- session tokens;
- lines added/removed;
- unavailable fields explicitly marked.

### Codex

- current account/plan label where available;
- primary and secondary rate windows;
- reset times;
- token totals;
- context;
- current turn state.

### Cross-provider view

Show capacity alongside active task demand. Suggestions may recommend routing, but never imply quotas are directly equivalent.

## Activity

A dense chronological timeline with:

- actor;
- action;
- object;
- repository/run;
- result;
- confidence;
- evidence link;
- filter and search.

Raw terminal output is not copied wholesale into Activity.

## Settings

Sections:

- members and roles;
- repositories;
- hosts;
- provider execution identities;
- approval policies;
- session naming;
- notifications;
- retention and redaction;
- backup and restore status;
- system health;
- emergency controls.
