# Codex instructions

Codex agents must follow [AGENTS.md](AGENTS.md). This file adds Codex-specific guidance.

## Product constraint

Pacium Control integrates **Codex CLI only**. Do not design or implement dependencies on a Codex desktop application.

## Integration modes

The preferred design supports two modes behind one adapter interface:

### Native CLI App Server mode

A local Codex App Server process provides structured turns, plans, messages, approvals, usage, and rate-limit events. It is launched and supervised as a CLI-side component and is never exposed directly to the browser or public network.

### tmux fallback mode

An ordinary Codex CLI session runs inside tmux. Pacium provides terminal control and inferred status when native events are unavailable.

The UI must make the active mode and confidence visible.

## Implementation behavior

When implementing Codex support:

- pin and detect compatible CLI protocol versions;
- keep App Server transport local to the broker or adapter;
- authenticate any non-stdio transport;
- normalize shared concepts without discarding Codex-specific details;
- capture plan revisions and turn lifecycle;
- distinguish steering an active turn from sending a new terminal prompt;
- route approval requests through the Pacium approval model;
- preserve provider reset windows and rate-limit semantics separately from Claude;
- expose adapter health and fallback state;
- never silently auto-approve because a callback failed.

## Worker expectations

A Codex coding worker should:

- operate only in its assigned worktree;
- verify the base commit before changes;
- keep task scope narrow;
- record commands and checks that support the result;
- stop and ask when a decision exceeds granted authority;
- produce a structured handoff and review evidence;
- avoid modifying orchestration state except through supported Pacium commands.

## Collaboration with Claude

Claude and Codex communicate through provider-neutral tasks, decisions, handoffs, Git evidence, and orchestrator routing—not by treating each other’s terminal transcript as a protocol.

Useful patterns include:

- Claude plans, Codex implements, Claude reviews;
- Codex prototypes, Claude evaluates tradeoffs;
- both produce isolated candidate implementations for orchestrator comparison;
- one provider continues from a complete handoff when the other reaches capacity.

Never move an in-progress task between providers without recording a handoff packet.
