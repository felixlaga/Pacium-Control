# Project status

**Current phase:** Core terminal workspace, bounded Git oversight, server-owned
Pacium configuration, and the General/Pacium presentation toggle are complete
enough for continued slicing; pinned Meta and Orchestrator roles are next.

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
- Protocol-9, Git-derived repository evidence for canonical root, branch or
  detached/unborn HEAD, full commit, main/linked worktree, observation time,
  bounded degraded states, and explicit refresh.
- A lazy, read-only changed-files inspector with fixed bounded Git reads,
  staged/unstaged/conflict evidence, known line totals, unusual-path handling,
  binary/large labels, deterministic oversight order, and explicit refresh.
- A one-file, on-demand unified diff inspector with fresh changed-path
  revalidation, fixed no-shell Git reads, strict patch/message limits, explicit
  tracked/untracked/unborn/binary/large/stale/error states, syntax and old/new
  line numbers, literal search, hunk collapse, wrapping, refresh, and
  Back/Escape focus restoration.
- A lazy recent-History inspector with one fixed local-HEAD Git read, a
  51-record read/50-record display ceiling, strict bounds for commit IDs,
  parents, authors, times, subjects, and messages, explicit merge and truncation
  text, unborn and degraded states, Refresh, and keyboard navigation.
- An optional external version-1 verification catalog with canonical
  repository matching, absolute executable/argument definitions, strict
  bounds, and fail-closed startup validation outside configured repositories.
- A shell-free verification process owner with one-run-per-session/two-global
  concurrency, allowlisted environment, timeout, process-group cancellation,
  forced-termination fallback, 24 KiB-per-stream output bounds, disposable
  latest result, and fresh start/end HEAD evidence.
- A lazy Checks inspector with exact argv and local-authority disclosure,
  Run/Cancel, pass/fail/timeout/cancel/error evidence, truncation and
  changed-HEAD warnings, browser-refresh recovery, and five-tab keyboard
  navigation.
- A lazy fifth Activity inspector that projects current attention, direct-PTY
  lifecycle, changed-file totals, three recent local commits, and the
  current/latest verification run into at most seven deterministic facts with
  explicit observed/occurred timestamps, source availability, partial errors,
  Refresh, reconnect recovery, and no terminal/provider narrative.
- Protocol-10 strict Pacium workspace configuration for explicit Meta,
  Orchestrator, and worker session/preset bindings; canonical repositories;
  verification references; and queue, future-delivery, objective, and plan path
  metadata without content or execution authority.
- One private server-owned version-1 `pacium.json` with a 96 KiB ceiling,
  complete graph/path/catalog validation, optimistic revisions,
  same-directory atomic replacement, corruption preservation, read-time drift
  detection, and unconfigured/ready/error observations.
- Browser config transport/state that performs a fresh get on reconnect,
  retains only accepted server evidence during replacement, rejects stale
  responses, and drops pending intent on disconnect without affecting PTYs,
  tabs, splits, selection, or General mode.
- A browser-owned, versioned General/Pacium presentation preference with a
  compact segmented control, `G P` chord, command-palette action, safe General
  fallback, and storage-failure disclosure.
- Pacium navigation that keeps the same terminal groups and shows only accepted
  loading, unconfigured, ready configured-reference counts, or bounded error
  evidence with read-only Retry.
- Mode changes and reload preserve selected PTY, terminal tabs/splits,
  inspector context, panel state, terminal sync/input ownership, and existing
  Git/check evidence.
- Keyboard commands for session creation, numbered selection, previous/next selection, and leaving terminal capture.
- Browser-owned terminal tabs with pinning, pointer/keyboard reordering, view-only close, stale-session reconciliation, and versioned local restoration.
- A bounded four-pane terminal layout with horizontal/vertical nesting, pointer/keyboard resizing, explicit focus, session move/swap, maximize/restore, view-only close, and versioned local restoration.
- Consistent session actions for rename, duplicate, ended-session relaunch, cwd copy, host repository reveal, `SIGINT`, view closure, and confirmed termination.
- A contextual `Cmd/Ctrl K` command palette with bounded token search, selected-session ranking, workspace/split/session dispatch, destructive-action review, focus restoration, and a searchable shortcut reference.
- Versioned browser-local settings for system/dark/light themes, compact/comfortable density, controlled terminal font stacks, bounded font size/line height/scrollback, default launch preset, and quiet attention-notification level.
- Named application and terminal landmarks, skip navigation, concise connection/selection/keyboard-owner status, persisted sidebar/inspector controls, narrow drawers, shared modal focus behavior, forced-colors support, and reduced-motion behavior.
- Protocol-9 session classification evidence for fixed Shell, Codex CLI, and Claude Code CLI launches, including source, confidence, observation time, inspector presentation, and accessible session-row naming.
- A pure attention reducer with explicit source/confidence/recency precedence, stale handling, and honest process-only Unknown/Finished/Failed sidebar and inspector states.
- Bounded browser-local unread, notified, and per-session mute cursors plus
  explicit-permission, hidden-page browser alerts for needs-input, failure, and
  completion evidence only.
- Contract, configuration, security, preset, classification, attention, preference, panel, modal, terminal-option, repository, grouping, tab-state, action-model, command-search, semantic-rendering, fake-PTY, real-PTY, WebSocket reconnect, and Playwright accessibility tests.

## What is not present

- No packaged `pacium` launcher or release artifact.
- No durable session restoration after local-server restart.
- No completed manual screen-reader, visual contrast, or full terminal-lifecycle browser review.
- No browser editor/setup flow for the server-owned Pacium workspace
  configuration and no shortcut customization.
- No Claude or Codex observer.
- No pinned/launchable Meta or Orchestrator roles, prompt targeting, queue
  observation, decisions, delivery, or objective/plan content presentation.
- No queue integration.
- No tmux adapter.

Do not extrapolate from the working terminal slice to any capability in this list.

## Current evidence

Verified on 2026-07-27 in the current macOS Apple-silicon checkout:

- `pnpm typecheck`: passed across all six workspace projects.
- `pnpm lint`: passed.
- `pnpm verify`: formatting, lint, type checking, 68 test files and 353 tests,
  plus web and local-server production builds passed.
- `pnpm test:e2e`: eight Chromium workflows passed for skip navigation, panel
  shortcuts and drawers, nested modal focus return, 320 CSS px layout, 200%
  zoom, forced colors, reduced motion, deterministic
  changed-file/diff/history/Activity inspection, and configured verification
  run/reload/cancel without terminal reselection. General/Pacium coverage
  proved pointer, chord, palette, reload persistence, unchanged selected PTY
  and inspector context, configured-state presentation, and narrow layouts.
- `pnpm build`: web and local-server production bundles completed.
- `pnpm dev`: Vite and the source local server started together; the UI and direct health route both returned 200.
- The protocol-version-10 boundary passed strict contract, atomic-store,
  canonical path/reference, authenticated WebSocket revision/conflict, PTY
  survival, and browser request-state tests on this machine.
- Built server startup: served the application and health endpoint on `127.0.0.1:4174`.
- Hostile bootstrap Origin: returned HTTP 403.

Evidence boundaries:

- The current shell exposed Node.js `26.4.0`, not the approved Node.js `24.18.x`; the commands passed with an engine warning, so the supported runtime remains unverified.
- The repository Playwright suite ran in headless Chromium after its browser
  binary was installed and verified the PC-028, PC-034, PC-035, PC-036, PC-037,
  and PC-038 workflows. The connected in-app browser backend remained
  unavailable, so manual visual, screen-reader, and full type/refresh/close
  terminal review are still open.
- The default `git` wrapper remains blocked by the unaccepted Xcode license. The repository's direct Xcode Git binary works, so clean diff, branch, merge, and remote evidence are available without changing that license state.
- `node-pty` used its shipped Darwin arm64 prebuild. Its helper arrived without an executable bit; a narrow postinstall guard repairs that mode.
- Snapshot serialization currently relies on xterm headless proposed buffer APIs and must be reevaluated on terminal dependency upgrades.
- The current web bundle is 770.96 kB before gzip and emits Vite's chunk-size
  warning; code splitting is a later optimization, not a functional blocker.
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

Begin PC-042 with configured Meta and Orchestrator role rows that resolve
explicit session/preset bindings honestly, show missing/disconnected states,
and launch or attach without changing the underlying terminal-first model.
Complete the pinned Node.js 24 clean-install, CI, broader browser/security,
manual accessibility, and sustained-output gates before release.
