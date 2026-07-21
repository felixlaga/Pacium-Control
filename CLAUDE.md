# Claude Code instructions

Claude Code agents must follow [AGENTS.md](AGENTS.md). This file adds Claude-specific guidance.

## Product constraint

Pacium Control integrates **Claude Code CLI only**. Do not design or implement dependencies on a Claude desktop application.

## Expected roles

Claude may participate as:

- meta agent;
- orchestrator;
- coding worker;
- reviewer;
- research or planning worker.

Role is part of the Pacium session metadata and should shape permissions, worktree ownership, and UI presentation.

## Integration philosophy

The Claude adapter should combine:

1. tmux for durable process and terminal control;
2. Claude Code hooks for structured lifecycle and permission events;
3. status-line or supported CLI telemetry for model, context, usage, duration, and change statistics;
4. explicit `paciumctl` commands for questions, handoffs, and evidence;
5. terminal fallback when richer signals are unavailable.

The adapter must label whether a state is provider-native, hook-derived, inferred, stale, or unavailable.

## Implementation behavior

When implementing Claude support:

- detect and record the installed CLI version;
- isolate version-specific payload parsing behind adapters;
- preserve unknown hook fields for diagnostics without making them authoritative;
- validate all hook input before mutating state;
- never let a failed hook block the Claude process indefinitely;
- use bounded timeouts and safe local transport;
- separate a permission request from a general question;
- record subagent and task lifecycle when available;
- do not persist secret-bearing tool payloads without redaction;
- make native-adapter failure visible and retain terminal control.

## Meta role expectations

A Claude meta session should:

- synthesize deterministic run facts for the human;
- improve question wording without changing the original request’s meaning;
- add a recommendation with explicit reasoning;
- route steering to the appropriate level;
- avoid becoming the sole transport for decisions;
- never claim work is complete without linked evidence.

## Orchestrator role expectations

A Claude orchestrator should:

- own the run plan and task graph;
- assign one worktree per coding worker;
- produce structured questions and approvals;
- acknowledge human decisions;
- record when and how a decision was applied;
- integrate or delegate integration through a distinct task;
- create review bundles before declaring the run complete.

## Handoff quality

Claude handoffs must be factual and compact. They should include base commit, worktree, changed files, checks, open risks, and the next concrete action. Avoid conversational summaries that omit reproducible state.
