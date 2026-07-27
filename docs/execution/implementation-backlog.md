# Implementation backlog

Expand each item with [the issue template](../templates/issue.md) before implementation. Items are ordered by dependency.

## Epic 0 — Local application foundation

### PC-001 Establish monorepo and toolchain

- Pin Node.js and package-manager versions.
- Create `apps/web`, `apps/local-server`, `packages/contracts`, `packages/terminal-ui`, and `packages/test-utils`.
- Add documented install, dev, test, build, and verify commands.
- Acceptance: a clean clone verifies without private registries or machine-specific paths.

### PC-002 Add repository hygiene and CI

- Ignore dependencies, build output, local state, terminal captures, credentials, and scratch files.
- Add format, lint, strict type, test, build, clean-install, secret, and portability checks.
- Acceptance: CI produces human-readable and machine-readable evidence.

### PC-003 Define local-server configuration

- Loopback address, port selection, local access token, data directory, log level, and browser-open behavior.
- Reject unsafe production-like binding.
- Acceptance: startup fails clearly on non-loopback configuration.

### PC-004 Define shared transport contracts

- Welcome, capability, request/result, event, typed error, and terminal stream envelopes.
- Add message size limits and protocol versions.
- Acceptance: malformed and incompatible messages fail deterministically.

### PC-005 Create deterministic fixtures

- Fake PTY, process, clock, IDs, repository, Git output, agent events, and queue files.
- Acceptance: UI and server tests require no provider credentials.

### PC-006 Build the fixture application shell

- Linear-inspired three-panel shell, design tokens, session list, terminal canvas, inspector, command palette shell, light/dark themes.
- Acceptance: all primary loading, empty, connected, failed, and selected states render from fixtures.

## Epic 1 — PTY terminal runtime

### PC-010 Define terminal session model

- Immutable ID, display name, workspace, repository, cwd, preset, process state, dimensions, attention metadata, and restoration capability.

### PC-011 Implement PTY creation and process groups

- Spawn explicit shell/preset in validated cwd with bounded environment inheritance.
- Track process group, PID, start, exit, and error.

### PC-012 Implement terminal input, resize, and signals

- Ordered input, resize, interrupt, graceful termination, force termination, and typed results.

### PC-013 Implement bounded terminal buffering

- Output limits, backpressure, slow-client behavior, and overflow state.

### PC-014 Implement terminal WebSocket channel

- Attach/detach, token and Origin validation, terminal frames, ordering, resize, errors, reconnect cursor/epoch.

### PC-015 Integrate xterm

- Render, input, resize observer, focus, Unicode, mouse, paste, alternate screen, search, and theme.

### PC-016 Preserve PTYs across browser reconnect

- Browser-independent session ownership and bounded headless screen state.
- Acceptance: refresh reconnects without process loss or duplicate input.

### PC-017 Implement safe session close and cleanup

- Graceful close, force confirmation, orphan detection, server shutdown behavior, and no leaked process groups.

### PC-018 Harden terminal content

- Titles, links, OSC, clipboard, HTML boundaries, buffer limits, and malicious fixture tests.

## Epic 2 — Terminal workspace UX

### PC-020 Implement workspace and repository grouping

- Recent workspaces, configured repositories, ungrouped sessions, collapse/pin behavior.
- Current status: repository and other-folder grouping is implemented from canonical session cwd values. Durable recent/configured workspaces and collapse/pin behavior remain.

### PC-021 Implement session sidebar

- Dense status rows, agent icon, repository, attention state, unread marker, keyboard selection, context menu.
- Current status: dense grouped rows expose process status, command label, cwd, and mouse/keyboard selection. Attention state, unread markers, richer agent identity, and context menus remain.

### PC-022 Implement terminal tabs

- Open, close, reorder, pin, preserve selection, and overflow behavior.
- Current status: browser-owned tabs implement selection, view-only close, pinning, pointer/keyboard reorder, valid refresh restoration, and horizontal overflow. Rendered browser validation remains pending.

### PC-023 Implement split panes

- Horizontal/vertical split, resize, focus ring, move session, collapse, and responsive minimum sizes.
- Current status: bounded nested splits, explicit focus, move/swap, pointer and keyboard resize, maximize/restore, view-only close, local restoration, and simultaneous terminal subscriptions are implemented. Rendered browser and accessibility validation remain pending because no browser backend was available.

### PC-024 Implement session actions

- Create, rename, duplicate, interrupt, relaunch, close, copy cwd, and reveal repository.
- Current status: implemented through one consequence-aware menu in the workspace header, pane headers, and session/tab context menus. Rename and reveal are server-owned typed operations; duplicate and ended-session relaunch reuse retained launch context. Rendered browser and accessibility validation remain pending because no browser backend was available.

### PC-025 Implement launch presets

- Shell, Claude Code, Codex, and user-defined typed presets with cwd and environment allowlist.
- Current status: fixed server-owned Shell, Claude Code, and Codex presets with honest availability are implemented. Durable user-defined presets and environment allowlists remain.

### PC-026 Implement keyboard and command palette

- Global navigation, session switching, split focus, create, actions, shortcut help, and terminal escape chord.
- Current status: a bounded contextual palette searches open sessions, workspace/split commands, and selected-session actions; ranks focused context; routes destructive choices to review; and includes a searchable reference for implemented shortcuts. Global routing suppresses application commands during terminal capture, editable input, and modal ownership. Rendered keyboard, focus, responsive, and international-layout validation remain pending because no browser backend was available.

### PC-027 Implement preferences

- Theme, density, terminal font, scrollback limit, notification settings, and default preset.
- Current status: versioned browser-local settings implement system/dark/light themes, compact/comfortable density, three controlled terminal font stacks, bounded font size/line height/scrollback, available-preset defaulting, and a stored quiet notification level for PC-032. Settings are reachable from the header, `Cmd/Ctrl ,`, and command palette. Notification delivery and rendered browser/accessibility validation remain pending.

### PC-028 Implement responsive layout and accessibility baseline

- Focus order, labels, live regions, contrast, reduced motion, panel collapse, and minimum supported viewport.
- Current status: implemented with named landmarks and modals, skip navigation, connection/selection/keyboard-owner status, browser-local panel visibility, visible and keyboard panel controls, narrow drawers, modal Escape/focus containment/restoration, reduced-motion and forced-colors rules, and deterministic semantic/browser coverage at 320 px and 200% zoom. Manual screen-reader and visual contrast review remains a release evidence item.

### PC-029 Implement host working-directory picker

- Token-protected host directory browsing, breadcrumbs, parent/home navigation, repository markers, filtering, recent choices, hidden-folder control, typed-path fallback, bounded results, and remote-safe behavior.
- Current status: implemented with resolver, contract, HTTP-boundary, transport, and state tests. Rendered browser and accessibility validation remain pending because no browser backend was available.

## Epic 3 — Agent attention and Git

### PC-030 Detect process and agent type

- Shell, Claude Code, Codex, configured command, and unknown.
- Current status: fixed server-owned Shell, Claude Code, and Codex launch
  presets now create strict type/source/confidence/observed-at classification
  evidence in protocol 4. The inspector consumes that evidence without
  inferring activity. Configured-command, unknown/adopted-process, and
  provider-native classification remain future consumers.

### PC-031 Define attention-state reducer

- Working, waiting, needs input, finished, failed, stale, and unknown with source, confidence, observation, and expiry.
- Current status: a pure browser reducer implements the full vocabulary with
  deterministic source/confidence/recency precedence and stale conversion. The
  current UI consumes process-only evidence: live remains unknown, nonzero or
  signalled exit becomes failed, and clean exit becomes finished with explicit
  unverified-task copy. Hook/native observations arrive with provider adapters.

### PC-032 Add unread and notification policy

- Meaningful activity cursor, needs-input/failure/completion notifications, quiet defaults, per-session mute.

### PC-033 Detect repository context

- Canonical root, branch, commit, worktree, and detached/error states from session cwd.

### PC-034 Implement changed-files inspector

- Status, grouped files, additions/deletions, binary/large/renamed/deleted handling.

### PC-035 Implement diff viewer

- File selection, syntax-aware rendering, collapse, search, line wrapping, and bounded payload.

### PC-036 Implement commit history

- Current branch commits and relationship to configured base where available.

### PC-037 Implement verification presets

- Explicit configured commands, bounded output, timeout, result, commit association, and cancellation.

### PC-038 Implement recent-activity summary

- Deterministic facts from process, terminal attention, and Git changes; optional agent narrative remains labelled.

## Epic 4 — Pacium mode

### PC-040 Define Pacium workspace configuration

- Meta and Orchestrator session/preset references, repository roots, queue sources, delivery methods, worker classifications, and verification presets.

### PC-041 Implement General/Pacium toggle

- Preserve terminal layout and selection while changing navigation emphasis and inspector tools.

### PC-042 Pin Meta and Orchestrator

- Stable role labels, launch/attach state, side-by-side command, and clear missing/disconnected states.

### PC-043 Implement explicit prompt targeting

- Meta, Orchestrator, or selected worker with visible target and no accidental scope carryover.

### PC-044 Observe queue files

- Stable reads, debounce, content size limits, source hashes, offsets/revisions, original text, and parse diagnostics.

### PC-045 Classify queue items

- Question, approval, failure, review, and unknown with confidence; never infer permission from an ordinary question.

### PC-046 Implement queue list and inspector

- Waiting time, requesting session, reason, consequence, recommendation, source, evidence, keyboard flow, and conflict state.

### PC-047 Implement immutable local decisions

- Answer/deny/approve payload, actor label, timestamp, source identity, and decision hash.

### PC-048 Deliver decisions compatibly

- Explicit target and delivery mechanism, idempotency, delivered/unknown/failed state, and no blind retry.

### PC-049 Implement acknowledgement and conflict handling

- Observable acknowledgement/applied state, file rewrites, competing answers, truncation, duplicate items, and manual resolution.

### PC-050 Implement worker and objective context

- Compact worker list, current objective/plan text from configured sources, recent decisions, and resulting activity.

## Epic 5 — Native agent enrichment

### PC-060 Define provider observation contract

- Capabilities, version, health, source, confidence, freshness, typed extension data, and bounded raw diagnostics.

### PC-061 Implement Claude observer

- Supported hooks/status, attention, tool, approval, completion, usage, and failure fixtures.

### PC-062 Implement Codex observer

- Supported native runtime events, turns, plan, tool, approval, completion, usage, and failure fixtures.

### PC-063 Build clean agent activity cards

- Prompt, message, tool, plan, approval, completion, error, and fallback terminal excerpt.

### PC-064 Implement capability degradation

- Unsupported version, observer failure, stale native events, terminal fallback, and user-visible diagnostics.

### PC-065 Implement relaunch manifests

- Provider, command, cwd, repository, environment allowlist, and optional resume identifier without secrets.

## Epic 6 — Durability and release

### PC-070 Implement optional tmux discovery and attach

- Explicit local server/socket, session selection, capability detection, and terminal attachment.

### PC-071 Implement tmux keep-alive preset

- Launch configured sessions under tmux and reconnect after local-server restart.

### PC-072 Add lifecycle and memory soak tests

- Repeated create/close, reconnect, large output, long-running agent, split churn, and notification load.

### PC-073 Add diagnostics

- Health, versions, PTY/session state, provider status, queue status, and redaction-aware export.

### PC-074 Package macOS application

- CLI/local-server packaging, browser launch, configuration directory, upgrade, uninstall, and signing decision.

### PC-075 Validate supported Linux path

- Build, PTY, browser, packaging, and documented limitations according to the platform decision.

### PC-076 Run release readiness

- Clean install, full workflow, security checks, accessibility, performance, known limitations, and owner acceptance.

### PC-077 Implement optional Tailscale Serve access

- Keep Pacium loopback-bound; configure tailnet-only HTTPS/WebSocket proxying, exact remote Origin, verified Serve identity, explicit operator allowlist, connection labelling, grants example, disable path, and spoof/revocation/public-reachability tests.

## Deferred backlog

These items require a future strategy and ADR:

- multi-user authorization;
- multi-host control;
- public hosting;
- generalized tasks/runs;
- automated worktree and PR orchestration;
- organization audit and backups.
