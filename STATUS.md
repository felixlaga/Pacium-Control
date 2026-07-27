# Project status

**Current phase:** Core multi-session terminal workspace in progress; browser review and runtime-matrix validation pending.

Pacium Control now has an executable React application, loopback local server, direct-PTY session manager, typed WebSocket protocol, and initial automated tests. This proves the core process-ownership and reconnect architecture; it does not prove the later agent-management or Pacium workflows.

## Product direction

Pacium Control is a localhost application for managing terminal sessions and CLI coding agents from one clean, keyboard-first interface.

The primary product is the terminal workspace:

- launch shells, Claude Code, Codex, and configured commands in local PTYs;
- group sessions by workspace and repository;
- switch, split, rename, pin, interrupt, relaunch, and close sessions;
- see which agents are working, waiting, finished, failed, or need input;
- inspect Git changes, diffs, commits, and verification beside the terminal.

The secondary product is **Pacium mode**:

- pin Meta and Orchestrator;
- surface the existing queue;
- answer questions and approvals;
- see workers, current objective, recent decisions, and resulting work.

## What is present

- Accepted local-first architecture decisions.
- Product, design, architecture, security, and execution specifications.
- A milestone roadmap and dependency-ordered backlog.
- A first implementation issue and implementation plan.
- Reusable issue, plan, handoff, review, and release templates.
- A pnpm monorepo with shared TypeScript configuration and pinned dependencies.
- A three-panel React/Vite shell with xterm as the dominant workspace surface.
- An in-memory direct-PTY session registry supporting create, list, input, resize, interrupt, exit, attach, snapshot, and deliberate close.
- A loopback-only HTTP/WebSocket server with Host, Origin, ephemeral-token, path, schema, and payload-size checks.
- Bounded xterm headless snapshots that let a new browser transport attach to a still-live PTY.
- A fixed server-owned Shell, Codex, and Claude Code launch catalog with honest executable availability.
- A token-protected, read-only host directory browser with canonical paths, repository markers, filtering, hidden-folder control, breadcrumbs, and browser-local recent choices.
- Canonical repository-root discovery and repository-grouped session navigation.
- Keyboard commands for session creation, numbered selection, previous/next selection, and leaving terminal capture.
- Browser-owned terminal tabs with pinning, pointer/keyboard reordering, view-only close, stale-session reconciliation, and versioned local restoration.
- A bounded four-pane terminal layout with horizontal/vertical nesting, pointer/keyboard resizing, explicit focus, session move/swap, maximize/restore, view-only close, and versioned local restoration.
- Consistent session actions for rename, duplicate, ended-session relaunch, cwd copy, host repository reveal, `SIGINT`, view closure, and confirmed termination.
- Contract, configuration, security, preset, repository, grouping, tab-state, action-model, fake-PTY, real-PTY, and WebSocket reconnect tests.

## What is not present

- No packaged `pacium` launcher or release artifact.
- No durable session restoration after local-server restart.
- No browser-driven test or completed visual/accessibility review in the current environment.
- No durable server-owned workspace configuration, command palette, preferences, or complete keyboard model.
- No Claude or Codex observer.
- No Git inspector.
- No functional Pacium mode; the toggle is visibly marked as upcoming.
- No queue integration.
- No tmux adapter.

Do not extrapolate from the working terminal slice to any capability in this list.

## Current evidence

Verified on 2026-07-27 in the current macOS Apple-silicon checkout:

- `pnpm typecheck`: passed across all six workspace projects.
- `pnpm lint`: passed.
- `pnpm test`: 18 files and 70 tests passed, including session-action contracts, availability, rendered markup and host adapters; split-layout transitions and simultaneous terminal subscriptions; directory authorization; preset and repository behavior; a real `node-pty` shell; and reconnect snapshots.
- `pnpm build`: web and local-server production bundles completed.
- `pnpm dev`: Vite and the source local server started together; the UI and direct health route both returned 200.
- The live protocol-version-3 welcome message advertised Shell, Codex, and Claude Code as available on this machine.
- Built server startup: served the application and health endpoint on `127.0.0.1:4174`.
- Hostile bootstrap Origin: returned HTTP 403.

Evidence boundaries:

- The current shell exposed Node.js `26.4.0`, not the approved Node.js `24.18.x`; the commands passed with an engine warning, so the supported runtime remains unverified.
- No in-app browser backend was available, so create/type/refresh/close has not been validated through the rendered UI.
- The default `git` wrapper remains blocked by the unaccepted Xcode license. The repository's direct Xcode Git binary works, so clean diff, branch, merge, and remote evidence are available without changing that license state.
- `node-pty` used its shipped Darwin arm64 prebuild. Its helper arrived without an executable bit; a narrow postinstall guard repairs that mode.
- Snapshot serialization currently relies on xterm headless proposed buffer APIs and must be reevaluated on terminal dependency upgrades.
- The current web bundle is 656 kB before gzip and emits Vite's chunk-size warning; code splitting is a later optimization, not a functional blocker.
- Tailscale Serve access is accepted and specified by ADR-0016 but is not implemented or security-validated yet.

## Active decisions

1. Pacium is loopback-bound and single-user initially; optional remote ingress uses Tailscale Serve.
2. The application binds to `127.0.0.1`.
3. Local PTYs are the default terminal runtime.
4. tmux is an optional adapter, not a requirement.
5. The terminal is the primary product surface.
6. Agent-aware views enhance rather than replace terminal truth.
7. Pacium mode is a toggle inside the terminal workspace.
8. Meta, Orchestrator, and the queue are the first Pacium-specific concepts.
9. Claude Code and Codex are integrated through their CLI/runtime interfaces, not desktop applications.
10. Durable application state is minimal, filesystem-based, and contains no provider secrets.
11. Questions and approvals remain distinct.
12. Tailscale Serve is the only supported remote ingress; public access, multi-user authorization, and multi-host coordination remain out of scope.

## Open decisions for Milestone 0

- Confirm Node.js 24 and `node-pty` on a clean supported macOS account with the Xcode license accepted.
- Complete browser, accessibility, terminal-escape, and sustained-output testing.
- Decide whether the current ephemeral bootstrap token lifecycle is sufficient for the packaged launcher.
- Packaging strategy after the development CLI works.

The initial runtime, package manager, application stack, and macOS-first platform are fixed in [the toolchain decision](docs/execution/toolchain-and-platform.md).

## Next action

Build the command palette, preferences, and accessibility baseline before agent-aware status, Git inspection, and Pacium mode. Complete the pinned Node.js 24 clean-install, CI, browser, security, and sustained-output gates before release.
