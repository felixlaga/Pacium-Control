# Changelog

All notable changes to the Pacium Control blueprint are recorded here.

## 0.4.0 — preset-aware repository sessions — 2026-07-27

### Added

- Fixed server-owned Shell, Codex, and Claude Code launch presets with explicit availability.
- Protocol version 2 fields for preset capabilities, typed creation, command labels, and repository context.
- Canonical ancestor `.git` discovery for repositories and worktrees.
- Repository-grouped sidebar navigation with an other-folders fallback.
- Keyboard commands for creation, numbered selection, previous/next selection, and leaving terminal capture.
- Deterministic tests for preset resolution, repository discovery, grouping, shortcuts, transport security, and session metadata.
- A scoped issue and implementation plan for PC-020, PC-021, PC-025, and PC-026.

### Verified

- Formatting, lint, type checking, 27 automated tests, and both production bundles pass.
- Development and built-server startup served the UI and health endpoint successfully.
- The live server detected all three fixed CLI presets on this machine.

### Known limitations

- Rendered browser workflow and accessibility validation remain pending because no browser backend was available.
- The supported Node.js 24.18.x runtime remains unverified; this machine used Node.js 26.4.0.
- Durable workspaces, user-defined presets, tabs, splits, richer session actions, and the command palette are not implemented.

## 0.3.0 — first local terminal slice — 2026-07-26

### Added

- React/Vite three-panel application shell and reusable xterm terminal surface.
- Loopback HTTP/WebSocket local server with an ephemeral access token and strict Origin validation.
- Direct-PTY session lifecycle for create, list, input, resize, interrupt, exit, reconnect, and close.
- Bounded headless terminal snapshots with session epoch and output sequence tracking.
- Shared Zod protocol contracts and binary terminal-data frames.
- Deterministic fake-PTY utilities plus contract, security, real-PTY, and reconnect integration tests.

### Verified

- Type checking, lint, 17 automated tests, and both production bundles pass in the current checkout.
- The built server starts on `127.0.0.1:4174`, serves the web bundle, and rejects a hostile bootstrap Origin.

### Known limitations

- Browser-driven and accessibility validation is pending because no browser backend was available.
- The current machine ran verification on Node.js 26.4.0; the pinned Node.js 24.18.x runtime remains to be verified.
- Direct PTYs end with the local server; tmux durability is deferred.
- Pacium mode, provider awareness, Git inspection, queue integration, splits, and packaging are not implemented.
- Snapshot serialization depends on xterm headless proposed buffer APIs.

## Blueprint v0.2.0-local-first — 2026-07-26

### Changed

- Reframed Pacium Control as a localhost terminal workspace first and a Pacium Meta/Orchestrator/queue mode second.
- Made direct local PTYs the default runtime and tmux an optional durability adapter.
- Replaced the tailnet, multi-user, multi-host, and separate-broker deployment with one loopback-only local process.
- Replaced the generalized state coordinator with minimal versioned JSON/JSONL application metadata.
- Made the terminal the primary product surface.
- Added a Linear-inspired design direction centered on calm hierarchy, compact density, predictable actions, and keyboard speed.
- Replaced the roadmap, milestones, workstream map, first-30-day sequence, backlog, risk register, and test strategy.
- Added a build-ready first issue and implementation plan for one real PTY-backed browser terminal.
- Rewrote the product, design, architecture, security, workflow, and provider entry points.
- Marked retained remote-control-plane documents as historical or deferred.

### Decisions

- Accepted ADR-0013: local PTYs are the primary runtime.
- Accepted ADR-0014: localhost-only single-user application.
- Accepted ADR-0015: minimal local filesystem state.
- Superseded ADR-0002, ADR-0004, ADR-0006, ADR-0008, ADR-0009, and ADR-0011 where their old architecture conflicts.

### Historical limitation

At this version, the blueprint remained documentation-only. The first executable slice was added in 0.3.0.

## Blueprint v0.1.0

### Added

- Product vision, philosophy, principles, and strategy.
- Documentation-only project status and implementation honesty contract.
- High-level and detailed architecture.
- No-database filesystem state design.
- tmux broker and terminal-control design.
- CLI-only Claude Code and Codex integration strategy.
- Meta, orchestrator, worker, reviewer, question, approval, decision, handoff, and evidence models.
- Tailscale identity and authorization design.
- Git branch and worktree isolation model.
- Multi-host architecture.
- UX information architecture and screen specifications.
- Security threat model and invariants.
- Milestone roadmap, workstream map, implementation backlog, risk register, and release criteria.
- Agent-specific operating contracts.
- GitHub issue and pull-request templates.
- Product, architecture, execution, operations, and incident templates.

### Current limitation

This release contains no application code by design.
