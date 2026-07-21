# Terminal experience

The terminal is essential and deliberately secondary.

## Product role

The terminal exists for:

- direct observation when structured state is insufficient;
- exceptional commands;
- troubleshooting and recovery;
- unfamiliar or generic sessions;
- verifying the exact CLI state;
- maintaining user trust in the abstraction.

It should not be required for ordinary questions, approvals, steering, status, or review.

## Entry points

- terminal drawer from a run or agent;
- session directory in the Terminal workspace;
- command palette;
- “Open raw session” from an error or degraded adapter state;
- local attach command fallback.

## Read-only by default

Opening a terminal begins in observation mode. The user sees output but cannot type. This prevents accidental interference and allows many viewers.

The header shows:

```text
Checkout API · Orchestrator · Claude
host: pacium-vps · tmux: pacium/checkout-orchestrator
Watching · Felix has control · lease expires in 04:32
```

## Write lease

One human writer per pane by default.

Lifecycle:

1. User requests control.
2. Server authorizes against session, repository, host, and role.
3. If free, lease is granted for a short duration.
4. Activity renews the lease up to policy limits.
5. Other users can request transfer.
6. Owner may take over with explicit reason.
7. Lease expires on inactivity, disconnect, revocation, or policy change.
8. Agent/system prompt delivery is serialized independently by broker.

The terminal should never accept input after the UI believes the lease is gone.

## Connection states

- Connecting.
- Live, read-only.
- Live, control granted.
- Reconnecting.
- Broker unavailable.
- Host disconnected.
- Session ended.
- Authorization revoked.

Each state explains what happened to the underlying session. For example:

> Broker disconnected. The tmux session is expected to continue. Reconnecting…

## Scrollback

- Use bounded in-memory or broker-side scrollback.
- Do not retain all terminal output indefinitely by default.
- Search operates within retained scrollback.
- Secret redaction may replace sensitive spans with visible markers.
- Copy events are local to the user and are not recorded as terminal content.

## Links and terminal metadata

Treat terminal-generated hyperlinks, titles, escape sequences, and clipboard operations as untrusted.

- Disable or confirm risky link protocols.
- Sanitize displayed titles.
- Do not allow terminal output to inject application HTML.
- Avoid automatic clipboard writes.

## Multiline prompts

Structured prompts should not be implemented by fragile shell quoting. The broker should use a literal buffered-input strategy appropriate for tmux/provider behavior and record a payload hash.

Raw terminal paste should use bracketed paste when supported and warn for very large or suspicious content.

## Local fallback

Every session detail page may provide a copyable attach command for an authorized user with local shell access. This preserves recoverability if the browser terminal fails.

The command should be generated from trusted host/session metadata and never contain credentials.

## Terminal-only sessions

General sessions may have no provider or Pacium run. They still receive:

- stable identity;
- host and tmux metadata;
- labels and saved views;
- access policy;
- read/write lease;
- activity and audit;
- local attach instructions.

Do not force Pacium workflow concepts onto arbitrary terminals.
