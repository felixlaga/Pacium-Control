# Implementation backlog

This backlog is intentionally detailed enough for autonomous agents to convert items into issues. It is ordered by dependency, not by UI visibility.

Each item should be expanded with the [issue template](../templates/issue.md) before implementation.

## Epic 0 — Repository foundation

### PC-001 Establish monorepo and supported toolchain

- Choose and pin supported runtime/package-manager versions.
- Define package boundaries matching architecture.
- Add one documented command for install, dev, test, build, and release verification.
- Acceptance: clean clone succeeds without private registries or machine-specific paths.

### PC-002 Add repository hygiene and generated-artifact policy

- Ignore dependencies, build output, state, backups, credentials, terminal captures, and agent scratch files.
- Add portability and secret scans.
- Acceptance: a staged-tree check rejects forbidden paths and common secret patterns.

### PC-003 Establish CI quality gates

- Run formatting, lint, strict typing, tests, production build, docs links, and clean-install verification.
- Preserve machine-readable and human-readable evidence.
- Acceptance: protected branch can require deterministic checks.

### PC-004 Create deterministic test utilities

- Controlled clock, ID generator, temporary roots, event cursors, and process harness.
- Acceptance: tests contain no arbitrary timing sleeps for core state behavior.

### PC-005 Create fake provider and tmux fixtures

- Reusable fixtures for sessions, provider events, questions, approvals, plans, and failures.
- Acceptance: frontend and state work can proceed without credentials.

## Epic 1 — Domain contracts

### PC-010 Define ID and naming conventions

- Immutable IDs, display names, tmux names, branch/worktree names.
- Validate shell/path safety and collision resistance.

### PC-011 Define entity schemas

- Workspace, user, membership, host, repository, run, agent, task, plan, question, approval, decision, prompt, lease, handoff, review, usage, policy.
- Include schema versions and reference rules.

### PC-012 Define state machines

- Run, task, agent, question, approval, prompt, review, host, and lease transitions.
- Reject invalid transitions with typed reasons.

### PC-013 Define command and result envelopes

- Identity, authorization context, idempotency, expected revision, correlation, error model.

### PC-014 Define event envelope and taxonomy

- Stable names, versions, causation/correlation, actor/execution identity, revisions, redaction.

### PC-015 Define provider capability and confidence model

- Native/hook/terminal/process/human sources; freshness and degradation.

## Epic 2 — Filesystem state coordinator

### PC-020 Initialize and validate state directory

- Format metadata, permissions, owner, symlink protection, empty-state bootstrap.

### PC-021 Implement atomic entity store

- Validated reads/writes, temp-on-same-filesystem, atomic rename, revisions.

### PC-022 Implement append-only event segments

- Partitioning, line integrity, revisions, rotation, cursor reads.

### PC-023 Implement command idempotency

- Same key/same payload returns committed result; changed payload rejects.

### PC-024 Implement optimistic revision conflicts

- Expected revision and typed current-state response.

### PC-025 Implement transaction journal

- Prepared/committed/applied states and deterministic multi-file recovery.

### PC-026 Implement startup recovery

- Journal replay, partial event tail handling, clean-shutdown metadata.

### PC-027 Implement in-memory indexes

- By workspace, repository, run, state, assignee, session target, idempotency key.

### PC-028 Implement rebuildable projections

- Inbox, Active, usage, and search seeds; delete/rebuild tooling.

### PC-029 Implement event subscriptions

- Monotonic cursor, authorization filter, reconnect/resync, backpressure.

### PC-030 Implement state integrity validator

- Schema, path/ID, references, revisions, journal, event tail, projections.

### PC-031 Implement quarantine workflow

- Move corrupt/unknown data safely; generate diagnostics and incident event.

### PC-032 Implement snapshot creation and validation

- Consistent revision boundary, manifest, hashes, sizes, format metadata.

### PC-033 Implement backup and restore primitives

- Staged restore, validation, atomic activation/rollback, encryption hooks.

### PC-034 Build filesystem fault-injection suite

- Kill/fail each durable step and assert deterministic recovery.

### PC-035 Benchmark representative state sizes

- Startup, command latency, event replay, projection rebuild, snapshot/restore.

## Epic 3 — Broker foundation

### PC-040 Define versioned broker RPC

- Unix-socket transport, request IDs, deadlines, capabilities, typed errors.

### PC-041 Implement broker authentication and caller binding

- Restrictive socket permissions, process/user identity, replay-safe requests.

### PC-042 Implement broker health and capability report

- OS, architecture, tmux/Git/provider versions, roots, supported operations.

### PC-043 Implement operation audit correlation

- Correlate API command, broker request, host operation, result, and event.

### PC-044 Enforce allowed roots and canonical paths

- Repository/worktree root validation, no traversal or symlink escape.

### PC-045 Implement broker restart reconciliation shell

- Track in-flight operations and expose unknown outcomes without replay.

## Epic 4 — tmux and terminal

### PC-050 Implement tmux server configuration

- Support designated socket/server identities and dedicated execution user.

### PC-051 Implement control-mode session discovery

- Sessions, windows, panes, names, IDs, clients, notifications.

### PC-052 Implement tmux metadata mirroring

- Read/write approved `@pacium.*` user options and detect unknown sessions.

### PC-053 Implement session classification workflow

- Assign workspace, role, provider, repository, run, and display name.

### PC-054 Implement tmux version capability tests

- Fixture/smoke matrix and clear unsupported behavior.

### PC-055 Implement PTY attachment

- Correct terminal type, resize, exit state, bounded buffering.

### PC-056 Implement read-only terminal streaming

- Authorized observation, reconnect, scrollback, connection states.

### PC-057 Implement terminal WebSocket grants

- Short-lived, single-use, user/session/origin/mode binding.

### PC-058 Implement exclusive terminal write leases

- Acquire, renew, transfer, revoke, expire; server enforcement and audit.

### PC-059 Implement per-pane input arbitration

- Human input, structured prompts, adapter controls serialized safely.

### PC-060 Implement multiline structured prompt delivery

- Literal/buffered input, payload hash, queue, delivery/unknown semantics.

### PC-061 Implement local attach command

- Safe copyable fallback based on trusted metadata.

### PC-062 Harden terminal page

- CSP, self-hosted assets, no analytics, untrusted escape/title/link behavior.

### PC-063 Test restart and lease races

- Browser/API/broker disconnects, simultaneous acquisition, revocation mid-stream.

## Epic 5 — Identity and authorization

### PC-070 Implement development identity mode

- Loopback-only, explicit banner, impossible production mix.

### PC-071 Implement Tailscale trusted ingress mode

- Verified header mapping, loopback/proxy validation, fail-closed startup.

### PC-072 Implement users and memberships

- Allowlisting, activation, suspension, revocation, historical attribution.

### PC-073 Implement role and scope policy

- Workspace, repository, host, session, action, object-state evaluation.

### PC-074 Implement secure application sessions

- Cookies, expiry, CSRF, sensitive-action revalidation, logout/revocation.

### PC-075 Implement terminal authorization

- Separate observe, write, takeover, stop, and raw-history permissions.

### PC-076 Implement authorization test matrix

- Cross-workspace/repo/host leakage, revocation, object transitions, owner-only actions.

### PC-077 Implement membership and policy audit

- Before/after revision, actor, reason, effect.

## Epic 6 — Web application foundation

### PC-080 Build application shell

- Workspace switcher, left rail, header, inspector, terminal drawer.

### PC-081 Build design tokens and accessible primitives

- Typography, spacing, role/state semantics, focus, density, theme.

### PC-082 Build resumable application event client

- Cursor, reconnect, resync, connection health, update batching.

### PC-083 Build global search and command palette shell

- Navigation and typed action previews.

### PC-084 Build session directory

- Discovery, classification, filters, health, saved views.

### PC-085 Build session detail and agent card primitives

- State, source/confidence, metadata, quick actions, recent events.

### PC-086 Build terminal drawer UI

- Read-only/control states, lease owner, resize/fullscreen, reconnect, escape chord.

### PC-087 Build responsive and mobile shell

- Mobile navigation and decision-first layouts.

### PC-088 Establish accessibility automated checks

- Keyboard, focus, landmarks, live regions, contrast baseline.

## Epic 7 — Pacium workflow

### PC-100 Implement repository entities and views

- Configure roots, branch, worktree, verification, policy, overview.

### PC-101 Implement run lifecycle

- Draft/start/pause/resume/cancel/verify/review/complete with valid transitions.

### PC-102 Implement plans and revisions

- Steps, dependencies, ownership, revision diff, reason.

### PC-103 Implement tasks and dependencies

- Assignment, states, criteria, evidence requirements, blocking.

### PC-104 Implement agent role association

- Meta, orchestrator, worker, reviewer, generic session.

### PC-105 Implement structured question creation

- Context, options, recommendation, assignee, blocking, evidence.

### PC-106 Implement Inbox projection and UI

- Grouping, unread, keyboard selection, inspector, mobile behavior.

### PC-107 Implement immutable question decisions

- Answer idempotency, supersession, conflicts, attribution.

### PC-108 Implement decision delivery and acknowledgement

- Adapter/bridge transport, status, timeout, applied evidence.

### PC-109 Implement approval requests

- Exact action, risk, scope, provider callback, distinct UI.

### PC-110 Implement approval decisions and narrow policies

- Deny/once/run/edit/alternative; policy revisions and expiry.

### PC-111 Implement structured prompt domain workflow

- Target hierarchy, queue/delivery/acknowledgement, command palette.

### PC-112 Implement activity timeline

- Domain event projection, filters, attributable chains, no raw terminal flood.

### PC-113 Implement per-user unread cursors

- Workspace/repository/run cursor semantics and conflict-safe updates.

### PC-114 Implement deterministic “since last checked”

- Completed tasks, changes, checks, decisions, failures, questions, usage.

### PC-115 Implement meta narrative hook

- Generate optional summary only from selected evidence and link each claim.

### PC-116 Implement workspace emergency pause

- Stop new coordination, preserve sessions and observation, audit reason.

### PC-117 Implement mobile Inbox

- Questions, approvals, summaries, deep links, duplicate-safe actions.

## Epic 8 — Legacy migration

### PC-120 Implement legacy queue watcher

- Stable reads, debounce, size limits, content hash, provenance.

### PC-121 Implement conservative legacy parser

- Supported formats, parse confidence, original text retention.

### PC-122 Implement legacy deduplication and conflict state

- File/version/offset/hash matching and visible conflicts.

### PC-123 Implement compatibility file renderer

- Atomic generated question/decision views without overwriting human edits.

### PC-124 Implement `paciumctl` transport

- Emit question/approval/event/handoff/evidence; read decision; acknowledge/apply.

### PC-125 Generalize user-specific legacy names

- Map `FELIX` filenames to user IDs without hardcoding domain logic.

### PC-126 Pilot staged migration

- Read-only import → bidirectional → generated views → retirement evidence.

## Epic 9 — Git, worktrees, and evidence

### PC-140 Implement repository inspection

- Identity, remotes, branch, commit, dirty state under allowed roots.

### PC-141 Implement deterministic branch/worktree creation

- Base commit, ownership, naming, collision validation.

### PC-142 Enforce one active coding owner per worktree

- Assignment checks and emergency transfer workflow.

### PC-143 Implement Git evidence collection

- Commits, changed files, diff stats, merge base, uncommitted changes.

### PC-144 Implement verification command profiles

- Configured commands, exact commit/environment, bounded output, artifacts.

### PC-145 Implement task evidence gates

- Required checks/artifacts/waivers before review-ready/accepted.

### PC-146 Implement review bundle generation

- Deterministic sections and optional labeled narrative.

### PC-147 Implement reviewer workflow

- Assign, approve, request revision, reject, waive, comment.

### PC-148 Implement integration queue/lease

- One integration owner, target branch, source candidates, state.

### PC-149 Implement conflict detection and resolution tasks

- Structured conflict evidence and options.

### PC-150 Implement post-integration verification

- Bind checks and bundle update to integration commit.

### PC-151 Implement safe worktree cleanup

- Dirty/active/reachability/retention checks and audit.

### PC-152 Add optional GitHub draft PR publication

- Local-first behavior, deterministic body, check links, graceful outage.

## Epic 10 — Claude Code adapter

### PC-160 Implement Claude CLI launch profile

- tmux, working directory, environment allowlist, metadata, version capture.

### PC-161 Implement Claude hook receiver bridge

- Local bounded transport, validation, timeout, diagnostics.

### PC-162 Normalize Claude session/tool/task/subagent events

- Versioned fixtures and confidence.

### PC-163 Implement Claude permission bridge

- Approval creation, callback correlation, timeout, fail-closed behavior.

### PC-164 Implement Claude question bridge

- Structured user questions distinct from permissions.

### PC-165 Implement Claude status-line ingestion

- Model, session, context, tokens, duration, lines, quotas/reset when available.

### PC-166 Implement Claude adapter health and fallback

- Hook/status failure, terminal fallback, unsupported version.

### PC-167 Add real Claude CLI smoke scenario

- Safe repository, question, permission, completion, usage, adapter restart.

## Epic 11 — Codex adapter

### PC-170 Implement Codex CLI launch profile

- tmux association, working directory, metadata, version capture.

### PC-171 Implement local Codex App Server supervision

- stdio/local socket, lifecycle, authentication, no browser exposure.

### PC-172 Normalize thread/turn/plan/message events

- Versioned protocol fixtures and capability handling.

### PC-173 Implement Codex approval bridge

- Exact action, callback, expiry, fail-closed behavior.

### PC-174 Implement Codex steering and interruption

- Distinct active-turn steering, new prompt, interrupt, status.

### PC-175 Implement Codex usage and rate-limit snapshots

- Provider windows, reset, context, unavailable semantics.

### PC-176 Implement tmux-only fallback mode

- Clear confidence and reduced capability.

### PC-177 Add real Codex CLI smoke scenario

- Plan, command, approval, steering, completion, adapter restart.

## Epic 12 — Cross-provider coordination

### PC-180 Implement handoff entity and UI

- Required context/evidence fields, lineage, acceptance.

### PC-181 Implement Claude-to-Codex handoff flow

- Freeze ownership, produce packet, transfer/clone worktree policy, resume.

### PC-182 Implement Codex-to-Claude handoff flow

- Same guarantees with provider-specific context handling.

### PC-183 Implement parallel candidate workflow

- Separate worktrees, same objective, orchestrator comparison, winner/abandon evidence.

### PC-184 Implement provider-capacity routing suggestions

- Explainable, advisory, provider-separated data.

### PC-185 Implement context-pressure handoff warning

- Thresholds, recommendation, no automatic destructive switch.

## Epic 13 — Usage and fleet operations

### PC-190 Build provider-separated Usage view

- Claude and Codex cards, freshness, reset times, context.

### PC-191 Build active agent fleet view

- Provider, role, repository, task, state, confidence, freshness, usage.

### PC-192 Implement stale-agent detection

- Signal model, state-specific thresholds, explanation, suppression.

### PC-193 Implement intervention ladder

- Status request, inspect, interrupt, pause, restart, reassign, stop.

### PC-194 Implement session restart manifests

- Launch profile, worktree, base/head, task, lineage, safe restart.

### PC-195 Implement saved views and pins

- Per-user filters without altering shared truth.

### PC-196 Implement notification policy

- Blocking items, approvals, failures, reviews, capacity; quiet hours and digests.

## Epic 14 — Multi-host

### PC-210 Define host protocol and enrollment

- Identity, one-time grant, key rotation, activation, revocation.

### PC-211 Implement outbound host-agent channel

- Authenticated connection, version/capability handshake, reconnect.

### PC-212 Implement remote command delivery

- IDs, deadlines, idempotency, result states, unknown outcome.

### PC-213 Implement remote event resend queue

- Source sequence, acknowledgement, gap detection, bounded persistence.

### PC-214 Implement host health and UI

- Connectivity, versions, capabilities, roots, sessions, warnings.

### PC-215 Implement disconnect reconciliation

- Session matching, missing/new targets, event gaps, uncertain commands.

### PC-216 Implement host-scoped authorization

- Visibility, terminal, operations, enrollment, revocation.

### PC-217 Implement local-machine agent profile

- Optional connector, no critical dependency, attach commands.

### PC-218 Test multi-host failure matrix

- Sleep, network loss, key revoke, clock skew, duplicate events, version mismatch.

## Epic 15 — Operations and security hardening

### PC-230 Create production systemd deployment

- Dedicated users, paths, permissions, restart policy, health checks.

### PC-231 Create Tailscale Serve deployment validation

- Loopback binding, trusted headers, external reachability test.

### PC-232 Create Hetzner firewall and break-glass runbook

- Public exposure checks and recovery path.

### PC-233 Implement encrypted backup automation

- Snapshot, manifest, encryption, off-host copy, status events.

### PC-234 Implement restore and rollback tooling

- Staging validation, atomic activation, prior-state preservation.

### PC-235 Run separate-machine restore drill

- Record time, failures, and evidence.

### PC-236 Implement diagnostics and support bundle

- Redacted versions, health, integrity, errors, manifest.

### PC-237 Implement platform health view

- State, broker, tmux, providers, hosts, backup, disk.

### PC-238 Implement secret and dependency scanning

- CI and release gates, reviewed exceptions.

### PC-239 Conduct terminal security review

- CSP, WebSocket, origin, output injection, clipboard, retention.

### PC-240 Conduct broker privilege review

- Unix users, socket, tmux domain, allowed operations and roots.

### PC-241 Implement disk-capacity safeguards

- Warning, write failure behavior, reserved recovery path, cleanup.

### PC-242 Run long-duration soak test

- Active sessions, streams, event load, restarts, memory/file descriptors.

### PC-243 Conduct production incident simulation

- Credential revoke, state corruption, host disconnect, rollback, emergency pause.

## Epic 16 — Product excellence

### PC-250 Refine Inbox information density

- Real pilot data, prioritization, option readability, waiting context.

### PC-251 Refine run overview and evidence linking

- Five-question product promise and deterministic status.

### PC-252 Refine command palette targeting

- Meta/orchestrator/run/task/worker scope previews and safety.

### PC-253 Refine mobile decision flows

- One-thumb operation, safe high-risk approval details, reconnect.

### PC-254 Complete accessibility review

- Keyboard, screen reader, contrast, zoom, motion, terminal escape.

### PC-255 Establish performance budgets

- Interaction latency, event propagation, startup, terminal responsiveness.

### PC-256 Add search across decisions and evidence

- Filesystem-native index, rebuildable projection, permissions.

### PC-257 Add run and approval templates

- Versioned, reviewed defaults with clear scope.

### PC-258 Add personal “since last checked” digest

- Workspace and run summaries, quiet delivery.

### PC-259 Validate north-star metrics in sustained pilot

- Human attention, answer latency, terminal avoidance, verification, confidence.

## Sequencing note

Agents may work in parallel only when dependencies and interfaces are explicit. The project owner or orchestrator should promote items to `ready` after contracts and prerequisite evidence exist. Do not start all backlog items merely because they are written down.
