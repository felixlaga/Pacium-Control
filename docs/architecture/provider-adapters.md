# Provider adapters

## Objective

Provider adapters add rich Claude Code and Codex telemetry and control without changing the provider-neutral product model or depending on desktop applications.

## Adapter contract

Each adapter should expose capabilities such as:

- launch profile support;
- attach to existing session;
- adapter health;
- provider session/thread identity;
- prompt submission or steering;
- interrupt/cancel;
- lifecycle events;
- plan/task events;
- tool/command events;
- question/approval events;
- usage and context snapshots;
- completion/failure;
- terminal fallback availability.

Capabilities are negotiated. The UI does not assume every provider/version supports every feature.

## Status confidence

Every normalized state includes:

```text
source: native | hook | terminal | process | human
confidence: confirmed | high | medium | low
observedAt
staleAfter
adapterHealth
```

Examples:

- Codex App Server reports active turn: native/confirmed.
- Claude hook reports tool start: hook/high.
- Pane output changed recently: terminal/low for “working.”
- Process exists but no output: process/low for “alive,” not “working.”

## Claude Code adapter

### Components

- CLI process inside tmux;
- hook receiver or `paciumctl` bridge;
- status-line ingestion;
- tmux terminal adapter;
- optional monitoring/telemetry integration where supported.

### Normalized events

Potential event families:

```text
claude.session.started
claude.prompt.submitted
claude.tool.started
claude.tool.completed
claude.permission.requested
claude.subagent.started
claude.subagent.completed
claude.task.created
claude.task.updated
claude.waiting_for_input
claude.completed
claude.failed
claude.usage.updated
```

Exact availability depends on installed CLI version and must be capability-tested.

### Hook safety

- Hooks send validated local payloads.
- Hook execution is bounded and cannot indefinitely block Claude.
- Unknown fields are preserved only in bounded diagnostics.
- Secret-bearing payloads are redacted before durable storage.
- Failed ingestion is visible in adapter health.
- Permission responses fail closed when uncertainty affects authorization.

### Conversation display

Do not promise perfect semantic reconstruction of arbitrary TUI output. Build the clean view from:

- prompts Pacium sent;
- structured hook events;
- provider completion summaries;
- plan/task data;
- bounded cleaned terminal excerpts;
- raw terminal fallback.

## Codex adapter

### Native mode

Launch or connect to a local Codex App Server process through a protected local transport. It should not be browser-accessible.

Potential normalized events:

```text
codex.thread.started
codex.turn.started
codex.plan.updated
codex.agent.message
codex.command.started
codex.command.completed
codex.approval.requested
codex.waiting_for_input
codex.turn.completed
codex.thread.failed
codex.usage.updated
codex.rate_limit.updated
```

### tmux fallback

An ordinary Codex CLI session remains controllable through terminal and structured prompt delivery. The UI labels plan and state inference accordingly.

### Steering semantics

Submitting a new prompt, steering an active turn, and interrupting a turn are distinct operations. The adapter should expose them separately and allow the UI to explain consequences.

## Provider-neutral translation

Examples:

| Provider event | Pacium event/state |
|---|---|
| Claude permission hook | `approval.requested` |
| Codex approval event | `approval.requested` |
| Claude subagent start | `agent.child_started` or task activity |
| Codex plan update | plan revision or step update |
| CLI process exit | session lifecycle event |
| usage payload | provider-specific `UsageSnapshot` |

Retain raw provider type/version in extension metadata for debugging.

## Adapter versioning

- Record provider CLI version per session.
- Version parsers and protocol contracts.
- Maintain fixture payloads for supported versions.
- Fail with a clear unsupported-version state rather than guessing.
- Separate capability detection from version string checks where possible.
- Include compatibility checks in installation diagnostics.

## Authentication

Provider credentials remain under the execution Unix identity or approved credential store. Pacium stores:

- execution identity reference;
- provider/account label safe for display;
- authentication health;
- expiry or reauthentication warning where available.

It does not store access tokens in central state.

## Collaboration

Cross-provider collaboration uses:

- shared run and task objects;
- isolated branches/worktrees;
- handoff packets;
- Git evidence;
- orchestrator routing;
- normalized questions and approvals.

Adapters do not communicate by injecting ad hoc text into one another’s terminals unless the orchestrator explicitly chooses a prompt as the transport.
