# Agent lifecycle

## Purpose

Agent state should reflect meaningful operational reality, not merely whether a tmux session exists.

## Lifecycle states

### Starting

Launch requested; tmux/provider process is being created or attached.

### Working

Recent meaningful provider, tool, task, or terminal activity supports active progress.

### Waiting on agent

The session is waiting for another task, agent, integration, or dependency.

### Waiting on human

An open blocking question or approval prevents progress.

### Verifying

The agent or system is running checks or gathering evidence.

### Review ready

Assigned work and required local evidence are prepared for review.

### Idle

Session is alive and intentionally not assigned active work.

### Completed

The session’s assigned task or role has ended successfully. The process may remain for inspection.

### Failed

The provider/process/task failed and requires action or retry.

### Disconnected

The host, tmux server, or adapter cannot currently be reached.

### Stale

The session appears alive but has not produced a meaningful signal within the expected period.

### Stopped

The underlying process/session is known to have ended.

## State sources

State is computed from several signals:

- provider-native lifecycle;
- hooks;
- task state;
- open questions/approvals;
- process existence;
- tmux session existence;
- terminal output recency;
- command execution;
- host heartbeat;
- human override.

A precedence model should prevent low-confidence terminal activity from overriding a confirmed provider wait state.

## Freshness

Each state has:

- observed time;
- source;
- confidence;
- stale threshold;
- explanation.

Example:

```text
Working
Confirmed by Codex active turn 8 seconds ago
```

or:

```text
Possibly working
Inferred from terminal output 22 seconds ago; native adapter unavailable
```

## Heartbeats

Heartbeats prove connectivity, not progress. A process heartbeat can keep `alive` fresh while task activity becomes stale.

Track separately:

- host connected;
- broker connected;
- tmux target exists;
- provider adapter connected;
- meaningful work event;
- prompt/approval wait.

## Stale detection

Thresholds may vary by state and task type. Long model thinking or builds should not be flagged with the same threshold as an interactive prompt.

Stale detection considers:

- expected operation duration;
- last tool/command start;
- provider turn status;
- terminal changes;
- CPU/process hints where safe;
- open dependencies;
- prior false positives.

The product should show why it marked an agent stale and let users suppress expected long work.

## Intervention ladder

From least to most disruptive:

1. Request status.
2. Ping or send structured clarification.
3. Inspect terminal.
4. Interrupt current turn/process.
5. Pause task and preserve state.
6. Restart provider session from manifest.
7. Reassign task with handoff.
8. Stop tmux session.
9. Quarantine worktree or execution identity.

The UI should recommend the least disruptive action supported by evidence.

## Child agents and subagents

Provider subagents may be represented as:

- child `AgentSession` objects when independently meaningful;
- task activity when short-lived and provider-local;
- nested events in the parent session.

The choice should depend on whether the child has distinct ownership, worktree, decisions, or review evidence. Avoid flooding the fleet view with ephemeral internals.

## Session end

Ending an agent session does not automatically complete a task. On exit:

- capture exit reason;
- preserve branch/worktree;
- finalize adapter events;
- identify uncommitted changes;
- update task state according to evidence;
- release terminal lease;
- keep manifest and history;
- prompt for recovery or cleanup if needed.
