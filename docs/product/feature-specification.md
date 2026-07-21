# Feature specification

This document defines the major product capabilities at a level suitable for epic planning. Detailed acceptance criteria belong in implementation issues.

## 1. Identity and membership

The system recognizes verified Tailscale users and maps them to Pacium memberships.

Required capabilities:

- first-party display of verified login and device context;
- explicit workspace membership;
- workspace and repository roles;
- owner-controlled invitations or allowlisting;
- immediate revocation;
- development identity mode that cannot be enabled accidentally in production;
- audit of role and policy changes.

## 2. Host registry

Hosts are first-class resources with:

- stable identity;
- display name;
- tailnet name/address;
- operating system and architecture;
- agent/broker versions;
- allowed repository roots;
- tmux server identities;
- capabilities;
- health and last contact;
- trust and enrollment status.

## 3. Session registry

Sessions are discovered from tmux and enriched with Pacium metadata.

Required capabilities:

- immutable Pacium ID independent of tmux name;
- role, provider, repository, run, owner, branch, worktree;
- live/stale/disconnected state with confidence;
- canonical naming and color/icon semantics;
- unclassified-session workflow;
- attach, observe, steer, interrupt, stop, and archive actions under policy.

## 4. Terminal

Required capabilities:

- xterm-compatible terminal rendering;
- read-only observation for authorized viewers;
- one active human writer by default;
- expiring control lease with visible owner;
- explicit request/takeover flow;
- resize, reconnect, copy, search, and scrollback;
- secure WebSocket grants;
- no third-party scripts on terminal route;
- local attach command as fallback.

## 5. Prompt delivery

Required capabilities:

- structured target selection;
- idempotency key;
- per-pane serialization;
- multiline-safe delivery;
- queued, delivered, observed, acknowledged, failed states;
- retry rules that do not duplicate input;
- audit actor, target, payload hash, and timestamps;
- templates for common steering actions.

## 6. Runs and tasks

Required capabilities:

- objective, scope, owner, repositories, and acceptance criteria;
- meta, orchestrator, worker, reviewer roles;
- task dependencies and status;
- plan revisions;
- branch and worktree association;
- run pause, resume, cancel, complete, archive;
- evidence and decision timeline;
- run templates.

## 7. Questions

Required capabilities:

- blocking or non-blocking;
- assignee user or role;
- context and reason;
- multiple-choice options plus free-form response where allowed;
- meta recommendation and consequences;
- relevant files, diff, logs, commands, or artifacts;
- answer shortcuts;
- immutable decision;
- acknowledgement and application lifecycle;
- expiration and supersession.

## 8. Approvals

Required capabilities:

- concrete requested action;
- host, repository, worktree, tool, and command context;
- risk classification;
- reason and alternative;
- deny, allow once, allow narrowly for run, edit and allow, request another method;
- policy evaluation;
- provider callback delivery;
- execution result linked to approval;
- no silent broadening of scope.

## 9. Git and worktrees

Required capabilities:

- repository registration and allowed roots;
- one branch/worktree per coding worker;
- deterministic naming;
- base commit recording;
- status, changed files, diff stats, commits;
- verification commands;
- integration queue;
- conflict detection and resolution workflow;
- optional GitHub pull request creation;
- cleanup only after safe conditions are met.

## 10. Review bundles

Required capabilities:

- objective and acceptance criteria;
- tasks and plan completion;
- human decisions;
- commits and diff;
- checks and artifacts;
- known failures and limitations;
- security-sensitive changes;
- agent narrative clearly labeled;
- reviewer decision and requested revisions;
- post-integration verification.

## 11. Activity and summaries

Required capabilities:

- append-only attributable event timeline;
- per-user unread cursors;
- deterministic “since last checked” facts;
- optional meta-generated narrative linked to evidence;
- filters by repository, run, agent, actor, event type, severity;
- retention and redaction policy.

## 12. Provider adapters

### Claude Code

- CLI launch and tmux association;
- hooks for lifecycle, tools, permissions, tasks, subagents, completion;
- status-line ingestion for model, session, context, usage, duration, lines changed;
- terminal fallback;
- explicit adapter health.

### Codex

- CLI launch and tmux association;
- optional local App Server transport;
- turn, plan, message, approval, usage, and rate-limit events;
- steering and interruption;
- terminal fallback;
- explicit adapter health.

## 13. Usage and capacity

Required capabilities:

- provider-separated quotas and reset windows;
- context usage per session;
- run-level budget policy;
- warnings and suggested routing;
- `unavailable` distinct from zero;
- no false universal cost metric.

## 14. Multi-host

Required capabilities:

- outbound enrollment and mutual authentication;
- host capability and version reporting;
- session and repository discovery;
- command routing;
- health and disconnect state;
- safe reconciliation after reconnect;
- host-scoped authorization;
- no direct remote writes to central state.

## 15. Administration

Required capabilities:

- members and roles;
- hosts and enrollment;
- repository policy;
- provider execution identities;
- approval policies;
- retention;
- backup status;
- emergency pause;
- audit export;
- system diagnostics.
