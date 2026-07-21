# Operator runbook

This runbook defines routine operational actions once the product exists.

## Check system health

Review:

- web/API;
- state coordinator and integrity;
- broker;
- tmux server;
- provider adapters;
- hosts;
- backup age;
- disk capacity;
- event-stream lag.

Investigate degraded components before restarting blindly.

## Classify an unknown session

1. Verify host and tmux target.
2. Inspect bounded terminal output only if authorized.
3. Assign workspace.
4. Assign generic or Pacium role.
5. Associate repository/run where known.
6. Choose provider and execution identity.
7. Apply canonical display name.
8. Confirm access scope.

Do not attach unrelated sensitive shells to a broadly accessible workspace.

## Resolve a stale agent

1. Read state explanation and freshness sources.
2. Check open question/approval/dependency.
3. Request structured status.
4. Inspect terminal if needed.
5. Check host/provider health.
6. Use least-disruptive intervention.
7. If restarting, preserve worktree and create lineage from manifest.
8. Record outcome.

## Transfer terminal control

1. Confirm target session and current controller.
2. Request control or owner takeover with reason.
3. Wait for server confirmation.
4. Verify “Terminal input active.”
5. Perform action.
6. Release control deliberately.

Never assume closing the drawer immediately releases control; verify lease state.

## Revoke a user

1. Suspend/revoke workspace membership.
2. Invalidate application sessions.
3. Revoke terminal grants and leases.
4. Review outstanding questions/approvals assigned to the user.
5. Transfer ownership where needed.
6. Review execution identities separately.
7. Record reason and offboarding reference.

## Rotate provider credentials

1. Pause new launches using the execution identity.
2. Identify active sessions and likely impact.
3. Authenticate/rotate under execution Unix user.
4. Verify CLI health without desktop application.
5. Resume launch policy.
6. Record identity label and rotation time, not secret.

## Pause a workspace

Use when coordination must stop without destroying sessions.

Expected effects:

- no new run starts;
- no new structured prompts;
- no integration actions;
- no new policy-derived approvals;
- observation and Inbox remain;
- sessions continue unless separately stopped.

Record reason and incident/change link.

## Handle low disk

1. Pause state-heavy actions if writes are at risk.
2. Preserve a small recovery reserve if configured.
3. Inspect logs, temporary files, old build artifacts, and safe caches.
4. Do not delete authoritative events or worktrees ad hoc.
5. Trigger backup before retention/compaction when possible.
6. Follow documented state archive policy.
7. Validate integrity after cleanup.

## Broker restart

1. Announce terminal interruption if users are active.
2. Confirm tmux sessions exist locally.
3. Restart broker.
4. Check capability and tmux rediscovery.
5. Reconcile pending/unknown operations.
6. Confirm terminal leases/streams are re-established safely.
7. Run canary prompt only if necessary.

## Restore state

Follow [backup and restore](backup-and-restore.md). Never overwrite the only copy of current state. Restore into staging and validate first.

## Emergency stop of one session

1. Confirm immutable session ID, host, run, worktree, and process.
2. Prefer graceful provider interrupt/stop.
3. Capture relevant state and uncommitted changes.
4. Stop tmux pane/session only with explicit authorization.
5. Release leases and update task/run state.
6. Create recovery or reassignment action.

## Daily operator checklist

- Inbox blockers are assigned.
- No high-risk approval is stale.
- Stale/disconnected agents are understood.
- Provider capacity has no surprise threshold.
- Review-ready work has an owner.
- Backup is current.
- No workspace is paused unintentionally.
- No unknown terminal controller remains.
