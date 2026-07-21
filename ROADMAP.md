# Roadmap

The roadmap is ordered by operational risk and learning value, not visual excitement. Each milestone must leave a working, demonstrable vertical slice.

## Milestone 0 — Foundations and truth

**Goal:** establish the repository, domain contracts, filesystem state engine, and verification discipline.

Deliverables:

- Monorepo and local developer experience.
- Shared domain schemas and IDs.
- Single-writer filesystem state coordinator.
- Atomic entity writes and JSONL event append.
- Transaction journal and recovery.
- In-memory indexes rebuilt from disk.
- Command idempotency.
- State inspection, validation, snapshot, backup, and restore tools.
- Fake tmux/provider fixtures for deterministic tests.
- CI gates and release evidence format.

Exit criteria:

- A clean clone installs and runs locally.
- State survives forced process termination at defined failure points.
- Duplicate commands do not duplicate decisions or prompts.
- A snapshot restores into an empty directory and passes integrity checks.
- No database dependency exists, direct or transitive by design intent.

See [Milestone 0](docs/execution/milestone-0-foundations.md).

## Milestone 1 — Secure tmux control plane

**Goal:** prove safe observation and control of real tmux sessions on one host.

Deliverables:

- Non-root broker process.
- tmux control-mode discovery and event ingestion.
- Session metadata and canonical naming.
- Read-only xterm terminal stream.
- Exclusive, renewable terminal write leases.
- Per-pane serialized input and idempotent prompt delivery.
- Tailscale Serve identity ingestion.
- Workspace and repository RBAC.
- Basic web shell: navigation, sessions, activity, terminal drawer.

Exit criteria:

- Browser and API restarts do not terminate tmux sessions.
- Two users can observe; only one can control a pane.
- Unauthorized users cannot enumerate or attach to hidden repositories.
- Reconnect does not resend a prompt.
- The web process has no tmux socket access.

See [Milestone 1](docs/execution/milestone-1-control-plane.md).

## Milestone 2 — Pacium operating workflow

**Goal:** make the web app the primary interface for the meta/orchestrator loop.

Deliverables:

- Repositories, runs, tasks, plans, and agent cards.
- Pacium workspace and generic terminal workspace.
- Structured questions and multiple-choice answers.
- Separate structured approvals with risk context.
- Immutable decisions, acknowledgement, and applied states.
- `FELIX-QUEUE` and `NEEDS-FELIX` migration adapter.
- Evidence timeline from Git and verification commands.
- “Since I last checked” summaries with source links.
- Inbox, Active, Repositories, Runs, Agents, Review, Activity views.
- Keyboard-first command palette and mobile Inbox.

Exit criteria:

- A normal question-and-steer cycle requires no SSH or terminal parsing.
- Every answer has actor, timestamp, run, target, and lifecycle state.
- A run page can explain objective, ownership, progress, blockers, changes, and evidence.
- Existing legacy queue workflows continue during migration.

See [Milestone 2](docs/execution/milestone-2-pacium-workspace.md).

## Milestone 3 — Claude and Codex native adapters

**Goal:** enrich the shared model with provider-native state while retaining CLI sessions and terminal fallback.

Deliverables:

- Claude Code hook receiver and CLI launch profile.
- Claude status-line usage/context ingestion.
- Claude permission and question bridge.
- Claude subagent/task lifecycle events.
- Codex App Server adapter launched and supervised as a CLI process.
- Codex turn, plan, message, approval, usage, and rate-limit events.
- Normalized provider state and confidence model.
- Provider-neutral handoff packets.
- Cross-provider run patterns.

Exit criteria:

- Claude and Codex operate simultaneously in separate worktrees.
- Native adapter loss visibly degrades to terminal/inferred state.
- Provider-specific usage is never collapsed into a misleading unified quota.
- Approvals cannot be silently granted by an adapter failure.

See [Milestone 3](docs/execution/milestone-3-provider-integrations.md).

## Milestone 4 — Git execution and review system

**Goal:** make parallel implementation safe and review outcomes evidence-backed.

Deliverables:

- Worktree creation and ownership.
- Branch naming and lifecycle.
- Task-to-worktree enforcement.
- Changed files, diff stats, commits, checks, and artifacts.
- Review bundles.
- Integration queue and conflict handling.
- Optional GitHub pull-request publication.
- Reviewer role and independent verification workflows.

Exit criteria:

- No two coding workers share a mutable worktree.
- Completed tasks produce a review bundle or an explicit no-change outcome.
- Integration failures remain recoverable and attributable.
- “Complete” cannot be displayed without required verification or a recorded waiver.

See [Milestone 4](docs/execution/milestone-4-git-and-review.md).

## Milestone 5 — Multi-host and operational hardening

**Goal:** operate reliably across a VPS and additional machines.

Deliverables:

- Outbound host agent and host-local broker.
- Host registration, trust, health, and capabilities.
- Local-machine session discovery.
- Resource-aware placement suggestions.
- Restart manifests.
- Encrypted off-host backups and restore drills.
- Stale-agent, disconnected-host, and credential-expiry detection.
- Emergency pause and break-glass procedures.
- Comprehensive production diagnostics.

Exit criteria:

- A host disconnect is visible and does not corrupt central state.
- Reconnection reconciles observed and recorded sessions safely.
- A production backup restores on a separate machine.
- A VPS reboot recovery drill succeeds with documented operator actions.

See [Milestone 5](docs/execution/milestone-5-multi-host-hardening.md).

## Milestone 6 — Product excellence

**Goal:** make the system feel inevitable, fast, and trustworthy under daily use.

Deliverables:

- Refined information density and responsive behavior.
- Personal unread cursors and saved views.
- Notification policy and digesting.
- Run templates and approval policies.
- Usage/capacity planning.
- Search across runs, decisions, agents, and evidence.
- Accessibility review.
- Performance budgets and long-running soak tests.
- Security audit and threat-model review.

Exit criteria:

- Daily operation occurs primarily through structured views.
- Operators report lower time-to-understand and time-to-decision.
- The interface remains legible under target load.
- Security and recovery exercises have documented evidence.

## Release philosophy

Do not label a milestone complete because files exist. Completion requires:

1. merged implementation;
2. automated tests;
3. an end-to-end demonstration;
4. updated documentation;
5. recorded limitations;
6. release evidence stored in the repository or linked from it.

The product should ship in narrow, trusted increments. Never hide incomplete behavior behind optimistic language.
