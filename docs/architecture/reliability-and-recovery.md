# Reliability and recovery

## Reliability objective

The control plane may fail without destroying the work it controls. Pacium should make failure state explicit and provide deterministic recovery.

## Failure domains

### Browser

Failure: tab closes, network changes, device sleeps.

Expected result:

- tmux sessions continue;
- structured commands already committed are not duplicated;
- terminal lease expires or follows short grace policy;
- reconnect resumes event stream from cursor;
- unsent local input is clearly distinguished from committed action.

### Web/API

Failure: process crash or restart.

Expected result:

- tmux and providers continue;
- state coordinator recovers journal;
- idempotency prevents duplicate commands;
- browser reconnects;
- broker reconciles subscriptions;
- no “success” response is fabricated for uncertain operations.

### State directory

Failure: partial write, disk full, permission change, corrupt file.

Expected result:

- atomic writes prevent partial entity replacement;
- journal enables recovery;
- startup validation detects inconsistency;
- affected writes fail closed;
- corrupt data is quarantined;
- last verified snapshot and backup provide recovery path;
- UI exposes degraded mode.

### Broker

Failure: broker crash or upgrade.

Expected result:

- tmux sessions continue;
- terminal streams disconnect visibly;
- broker restarts and rediscovers;
- pending operations reconcile by operation ID;
- unsafe uncertain input is not blindly replayed.

### tmux server

Failure: tmux process exits or host reboots.

Expected result:

- sessions are offline;
- manifests explain prior state;
- Git worktrees and filesystem coordination state remain;
- operator can recreate supported sessions;
- run state does not falsely remain “working.”

### Provider CLI

Failure: process exits, authentication expires, adapter breaks.

Expected result:

- session state becomes failed or disconnected with reason;
- terminal evidence is retained within policy;
- worktree remains untouched;
- task can be restarted or handed off;
- provider-native adapter may degrade independently of terminal.

### Host agent/network

Failure: remote host disconnects.

Expected result:

- central shows last-known state and freshness;
- commands are not sent into a void indefinitely;
- reconnection reconciles sessions and event sequence;
- laptop failure does not affect VPS sessions.

## Idempotency strategy

Idempotent operations include:

- create/answer/acknowledge decisions;
- queue prompts;
- acquire/release leases;
- start run from template;
- create worktree;
- report provider events;
- remote host command and event delivery.

The same key and payload return the prior committed result. The same key with a different payload is rejected.

## Unknown outcomes

Some operations can become uncertain, especially terminal input or remote commands during disconnect.

Use an explicit `unknown` state. Provide evidence and safe operator choices:

- inspect terminal;
- query current provider state;
- mark observed success;
- retry with a new deliberate command;
- cancel follow-up.

Never convert unknown to failed merely for UI simplicity.

## Session manifests

A manifest records enough to explain and recreate a session:

- role/provider;
- host and execution identity;
- repository/worktree/branch/base commit;
- run/task;
- launch profile and compatible CLI version;
- environment keys by name, not secret values;
- tmux layout;
- last known provider session reference;
- restart policy;
- human notes.

Restarting from a manifest creates a new process attempt and records the lineage.

## Backup objectives

Initial targets should be explicit and measured, for example:

- coordination state recovery point: no more than one completed backup interval plus current local state;
- restoration time: practical for one operator on a replacement VPS;
- audit/decision retention: long-term;
- terminal scrollback: not guaranteed beyond configured bounds.

These are product decisions, not promises until tested.

## Recovery drills

Required before production confidence:

- kill API during entity mutation;
- kill broker during prompt delivery;
- restart broker with active tmux sessions;
- corrupt a projection and rebuild;
- corrupt one entity and exercise quarantine;
- fill disk in a test environment;
- restore snapshot and events to an empty directory;
- reboot VPS and reconstruct session state;
- disconnect/reconnect remote host;
- revoke user during terminal control;
- expire provider authentication mid-run.

Record outcomes, timing, and corrective issues.

## Graceful degradation

The UI should expose which layers remain available:

```text
Structured state: healthy
Broker: degraded
Terminal: unavailable
Claude hooks: unavailable
tmux sessions: last observed alive 18s ago
Git evidence: healthy
```

A single generic red banner is insufficient.
