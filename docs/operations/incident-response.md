# Incident response

## Incident principles

1. Protect people, credentials, source, and state first.
2. Preserve evidence.
3. Prefer reversible containment.
4. Keep tmux sessions/worktrees alive unless they are part of the threat.
5. Communicate facts and uncertainty separately.
6. Record every emergency action.

## Severity

### SEV-0 — Active security compromise or destructive control loss

Examples:

- unauthorized shell/terminal control;
- provider credentials exposed;
- public access to privileged endpoints;
- agent executing destructive actions beyond authorization;
- state tampering with uncertain scope.

### SEV-1 — Critical workflow or state integrity failure

Examples:

- duplicate decisions/prompts causing harmful work;
- state coordinator unable to recover;
- terminal leases not enforceable;
- broad authorization bypass;
- production restore required.

### SEV-2 — Major degradation

Examples:

- broker unavailable while sessions continue;
- provider adapters broadly broken;
- host disconnected;
- backup overdue;
- Inbox delivery significantly delayed.

### SEV-3 — Limited defect

Examples:

- one session classification issue;
- display inconsistency;
- noncritical adapter field unavailable.

## First response

### For suspected security compromise

1. Invoke workspace emergency pause if safe.
2. Revoke affected users, host agents, terminal grants, and policies.
3. Isolate affected host/tmux domain if necessary.
4. Rotate provider and infrastructure credentials.
5. Preserve state, logs, journal, versions, and relevant process metadata.
6. Avoid destroying worktrees or history before evidence capture.
7. Establish incident lead and timeline.

### For state integrity failure

1. Stop new state mutations.
2. Keep read-only access if safe.
3. Snapshot/copy current directory without “fixing” it first.
4. Run integrity report.
5. Identify last verified snapshot/backup.
6. Choose repair, replay, or restore.
7. Validate in staging before activation.

### For broker/terminal failure

1. Confirm tmux sessions continue through local shell.
2. Disable new terminal grants if authorization is uncertain.
3. Restart or roll back broker.
4. Reconcile sessions and unknown operations.
5. Communicate whether any input outcome is uncertain.

## Communication template

```text
Incident: <short title>
Severity: <SEV>
Started: <UTC time>
Status: investigating | contained | recovering | resolved
Impact: <users/repos/hosts/actions affected>
Known facts: <facts only>
Unknowns: <explicit uncertainty>
Containment: <actions taken>
Next update: <condition or time>
Incident lead: <person>
```

## Evidence preservation

Collect as appropriate:

- release/version identifiers;
- state revision and integrity report;
- journal entries;
- audit event ranges;
- broker/provider versions;
- host health;
- authorization/policy revisions;
- bounded redacted logs;
- affected session/worktree/commit metadata;
- firewall/Tailscale configuration state.

Do not copy secrets into the incident document.

## Recovery

Recovery requires:

- containment remains effective;
- affected credentials are rotated;
- state is validated;
- unknown command outcomes are resolved;
- sessions/worktrees are reconciled;
- critical smoke tests pass;
- monitoring/alerts are active;
- stakeholders know remaining limitations.

## Postmortem

Use [the postmortem template](../templates/incident-postmortem.md).

A good postmortem includes:

- impact;
- timeline;
- detection;
- contributing conditions;
- why controls failed or were absent;
- what went well;
- corrective actions with owners and deadlines;
- architectural/documentation changes;
- verification that corrections work.

Avoid assigning blame to an individual or agent. Focus on system conditions and decision quality.
