# First 30 days

This sequence assumes a small expert team using agents heavily. Calendar timing may change, but dependency order should remain.

## Days 1–3 — Repository and decisions

### Goals

- Establish the actual monorepo.
- Pin runtime and package manager.
- Convert blueprint backlog items PC-001 through PC-015 into GitHub issues.
- Confirm owners for state, broker, web, security, Claude, and Codex.
- Run focused tmux/provider research spikes without merging product code prematurely.

### Deliverables

- Clean clone with one `install`, `dev`, `test`, `build`, and `verify` path.
- CI skeleton.
- Shared IDs, command/event envelopes, and entity schema package.
- Supported-version research plan.
- No-database dependency guard.

### Decision gate

Do not begin several UI workflows until core schemas and state-machine names are reviewed.

## Days 4–8 — Filesystem truth engine

### Goals

- Build single-writer state coordinator.
- Prove atomic entity writes and event append.
- Add expected revisions and idempotency.
- Add transaction journal and crash recovery.

### Deliverables

- Workspace/user/repository/run/question/decision fixtures.
- Fault-injection matrix.
- Event cursor subscription.
- Integrity checker and quarantine.
- Projection rebuild.

### Demonstration

Create and answer a question, kill at multiple mutation points, recover deterministically, and replay the same result.

### Stop condition

If crash recovery is ambiguous, pause feature expansion.

## Days 9–12 — Snapshots, backup, and API boundary

### Goals

- Snapshot and restore.
- Define API-to-state command boundary.
- Add local development identity.
- Build first application event stream.

### Deliverables

- Restore into empty state.
- Clean-restart tests.
- Minimal API health/state endpoints.
- Static web shell against real state, not fake mutable local state.

## Days 13–17 — Broker and tmux discovery

### Goals

- Build Unix-socket broker.
- Integrate tmux control mode.
- Discover sessions/windows/panes.
- Assign stable Pacium IDs and metadata.

### Deliverables

- Broker capability report.
- Dedicated test tmux server.
- Session registry and classification UI.
- Broker restart reconciliation.
- Security tests proving web process lacks tmux access.

### Demonstration

Start, rename, and close tmux sessions outside Pacium; watch the UI reconcile correctly.

## Days 18–21 — Terminal observation and control

### Goals

- PTY terminal stream.
- Read-only observation.
- Terminal grant and exclusive write lease.
- Per-pane input arbitration.
- Structured prompt delivery.

### Deliverables

- Terminal drawer.
- Two-browser observation/control transfer test.
- Reconnect and revocation tests.
- Strict terminal CSP/assets.
- Local attach fallback.

### Demonstration

Observe one session from two users, transfer control, send a multiline prompt, restart broker/API, and prove the tmux process survives without duplicate input.

## Days 22–25 — Tailscale identity and application RBAC

### Goals

- Configure production-shaped Tailscale Serve ingress.
- Map verified users.
- Add workspace/repository/session policy.
- Add secure application sessions and revocation.

### Deliverables

- Unknown tailnet user denial.
- Viewer/operator/approver/owner matrix.
- Terminal observe/write separation.
- Public reachability test.
- Development-auth fail-closed check.

## Days 26–30 — First real Pacium loop

### Goals

- Implement structured question creation.
- Build Inbox and inspector.
- Answer immutably.
- Deliver to orchestrator bridge.
- Receive acknowledgement.
- Show application evidence.
- Begin legacy queue observation.

### Deliverables

- Real question/answer/acknowledgement vertical slice.
- Mobile-capable question card.
- Activity chain.
- Per-user unread cursor.
- Run shell with objective, sessions, question, and evidence.
- Pilot report.

### Day-30 demonstration

A real orchestrator session asks a multiple-choice question. Felix answers in Pacium Control. The answer is delivered exactly once, acknowledged, applied, and linked to a resulting event or Git change. No SSH or manual queue-file editing is required.

## Work deliberately deferred beyond day 30

- Complete run/task planning system.
- Approval policies beyond basic exact-action approval.
- Full Git worktree automation.
- Claude native hooks/status.
- Codex App Server.
- Cross-provider handoffs.
- Multi-host.
- Advanced usage and analytics.
- GitHub pull requests.

Deferral is not lack of ambition. It protects the first trusted operational loop.

## Day-30 review questions

- Is the state engine trusted under failure?
- Is terminal control safe enough for team use?
- Can the operator answer without terminal context?
- Does acknowledgement close the loop?
- Which data remains ambiguous?
- What surprised users?
- Which frozen decision needs evidence-based reconsideration?
- Is the next milestone ready, or should the first loop be deepened?
