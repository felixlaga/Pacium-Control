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
- Current status: implemented with resolver, contract, HTTP-boundary,
  transport, state, and rendered-browser coverage. PC-078 closed the original
  navigation, recovery, storage, focus, narrow-layout, zoom, forced-color, and
  reduced-motion evidence gaps.

### PC-078 Refresh host working-directory picker

- Add in-picker absolute-path navigation, compact keyboard traversal,
  first-load default recovery, failure-safe browser-local recents, and complete
  rendered workflow evidence without changing the read-only filesystem or
  PC-077 request-authority boundary.
- Current status: complete. The existing protocol-18 endpoint remains
  unchanged; path edit, server-default recovery, storage failure, deterministic
  focus, 200%-zoom launch-form reachability, and three complete Chromium
  workflows are implemented and verified.

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
- Current status: implemented with a bounded versioned browser-local
  seen/notified/mute cursor, important-only unread markers, visible-selection
  acknowledgement, inspector mute control, settings-only permission request,
  and duplicate-safe hidden-page delivery. Notification copy excludes session
  names, paths, terminal bytes, prompts, and evidence reasons. Provider
  observers remain responsible for supplying future needs-input evidence.

### PC-033 Detect repository context

- Canonical root, branch, commit, worktree, and detached/error states from session cwd.
- Current status: protocol 5 sessions carry strict, refreshable Git evidence
  from fixed bounded commands: canonical root/name, branch or detached/unborn
  HEAD, full commit, main/linked worktree, freshness, non-repository, and
  degraded error. The inspector exposes that evidence and refresh without
  affecting PTY lifecycle. Dirty/changed-file state begins in PC-034.

### PC-034 Implement changed-files inspector

- Status, grouped files, additions/deletions, binary/large/renamed/deleted handling.
- Current status: protocol 6 exposes lazy, session-owned changed-file evidence
  from fixed bounded porcelain-v2 and numstat reads. The inspector presents
  deterministic conflict/mixed/staged/unstaged/untracked order, known line
  totals, rename/copy/type/delete states, binary/large labels, freshness,
  truncation, and honest degraded states without reading content or affecting
  PTYs. Selecting a reported path now continues into PC-035.

### PC-035 Implement diff viewer

- File selection, syntax-aware rendering, collapse, search, line wrapping, and bounded payload.
- Current status: protocol 7 exposes one freshly revalidated changed path
  through fixed no-shell tracked, untracked, and unborn Git reads. Patch bytes,
  lines, individual lines, paths, errors, and final serialized messages are
  bounded; binary, large, stale, non-repository, and error states carry no
  patch content. The compact Changes subview renders unified syntax and
  old/new line numbers as text, with browser-local search, hunk collapse,
  wrapping, refresh, Back/Escape, stale-response rejection, and focus return
  without affecting PTYs or persisting repository content.

### PC-036 Implement commit history

- Current branch commits and relationship to configured base where available.
- Current status: protocol 8 exposes a command-free, selected-session local
  `HEAD` history read with fixed no-shell/no-pager arguments, a 1.5 second
  timeout, 256 KiB raw-output ceiling, 51-record read window, and 50-record
  payload cap. IDs, parents, author names, authored times, subjects, errors, and
  final messages are strict and bounded. The lazy History tab shows merge,
  truncation, unborn, freshness, and degraded evidence with Refresh,
  cross-session/stale-response rejection, reconnect recovery, three-tab
  keyboard navigation, and no PTY impact or durable history. Configured-base
  comparison remains deferred until server-owned workspace/base configuration
  exists.

### PC-037 Implement verification presets

- Explicit configured commands, bounded output, timeout, result, commit association, and cancellation.
- Current status: protocol 9 exposes inspect, run, cancel, response, and update
  messages that contain only session, preset, request, and run identities.
  An optional strict version-1 JSON file outside configured repositories owns
  canonical roots and absolute executable/argument definitions. The local
  runner uses no implicit shell, permits one run per session and two globally,
  applies a ten-minute timeout ceiling and two-second cancellation grace,
  retains at most 24 KiB each of control-normalized stdout/stderr, and records
  pass/fail/timeout/cancel/error plus fresh start/end HEAD evidence. The lazy
  Checks tab shows exact argv and local authority, explicit Run/Cancel,
  reconnect inspection, result/truncation/HEAD-change evidence, four-tab
  keyboard navigation, and narrow layout without PTY impact. Durable history,
  automatic checks, browser configuration editing, frozen-worktree claims, and
  hard-crash recovery remain out of scope.

### PC-038 Implement recent-activity summary

- Deterministic facts from process, terminal attention, and Git changes; optional agent narrative remains labelled.
- Current status: a lazy fifth Activity inspector projects only the selected
  session's current attention, direct-PTY lifecycle, bounded changed-file
  observation, three newest local-HEAD commits, and current/latest verification
  run. Observed and occurred timestamps remain distinct; source availability,
  partial errors, refresh, stale-response rejection, reconnect, five-tab
  keyboard navigation, and 320 CSS px layouts reuse existing protocol-9
  evidence without polling, persistence, terminal parsing, provider narrative,
  or a new event service.

## Epic 4 — Pacium mode

### PC-040 Define Pacium workspace configuration

- Meta and Orchestrator session/preset references, repository roots, queue sources, delivery methods, worker classifications, and verification presets.
- Current status: protocol 10 and version-1 `pacium.json` provide one strict,
  private, 96 KiB server-owned workspace definition with canonical
  repository/metadata paths, live-session/fixed-preset/exact-root verification
  references, complete graph validation, optimistic revisions, atomic
  replacement, corruption/drift preservation, authenticated get/replace, and
  reconnect-safe browser request state. PC-040 reads no configured content,
  performs no delivery or prompt, starts no PTY/check, and exposes no setup UI;
  those remain PC-041 through PC-050.

### PC-041 Implement General/Pacium toggle

- Preserve terminal layout and selection while changing navigation emphasis and inspector tools.
- Current status: a versioned browser-only mode preference, accessible
  segmented control, `G P` chord, command-palette action, honest protocol-10
  configuration card, explicit Retry, and responsive shell emphasis preserve
  terminal/session/layout/inspector truth across mode changes and refresh.
  Role rows, configuration editing, queue UI, and content behavior remain
  PC-042 through PC-050.

### PC-042 Pin Meta and Orchestrator

- Stable role labels, launch/attach state, side-by-side command, and clear missing/disconnected states.
- Current status: Pacium mode pins stable Meta and Orchestrator cards above
  ordinary sessions; resolves exact accepted session IDs into
  live/starting/ending/ended/failed/missing/disconnected evidence; opens the
  existing PTY through the current tab/split/attach path; and provides a
  role-scoped editor for eligible live sessions or fixed launch presets. A
  preset launch correlates the exact `session.created` request, preserves the
  new PTY on partial failure, and optimistically replaces only that role with
  the created session ID. No display-name inference, queue/content behavior,
  worker launching, or prompt targeting is present.

### PC-043 Implement explicit prompt targeting

- Meta, Orchestrator, or selected worker with visible target and no accidental scope carryover.
- Current status: a Pacium-only compact composer projects Meta, Orchestrator,
  then configured workers from accepted bindings and exact current session
  IDs. Only live connected direct-session bindings can send one trimmed,
  control-free line of at most 4,000 Unicode characters through the existing
  terminal-input operation. Exact request correlation locks duplicates,
  distinguishes accepted/rejected/unknown outcomes, never retries, and clears
  ephemeral scope on success, mode exit, refresh, disconnect, or target drift
  as applicable. It adds no protocol, durable prompt state, provider claim,
  queue read, delivery, or approval authority.

### PC-044 Observe queue files

- Stable reads, debounce, content-size limits, source hashes, source revisions,
  and bounded original text for later parsing.
- Current status: protocol 11 observes only accepted configured queue-source
  paths through bounded no-follow stable reads and canonical-parent watchers.
  It keeps at most 64 KiB of complete UTF-8 source text in local-server memory,
  computes SHA-256 only for stable/empty evidence, deduplicates unchanged
  observations, rejects stale config generations, and presents compact
  content-free source health only in Pacium mode. Explicit Refresh, reconnect,
  watcher disposal, hostile files, and byte-for-byte source/config preservation
  are covered. PC-045 now adds one whole-source candidate boundary; multi-item
  parsing, durable provenance, decisions, delivery, and queue text in the
  browser remain later work.

### PC-045 Classify queue items

- Question, approval, failure, review, and unknown with confidence; never infer permission from an ordinary question.
- Current status: protocol 12 classifies at most one candidate from each
  nonblank stable source under deterministic boundary `whole_source_v1`.
  Exact Markdown/plain-text markers identify questions, concrete approval
  requests, failures, and reviews with documented confidence; a final question
  mark can infer only a medium-confidence question, and every other or ambiguous
  document remains unknown. Item identity binds boundary/source ID/content
  hash, unchanged hashes reuse classification, degraded evidence clears it, and
  Pacium shows only type/confidence/fixed diagnostics beside source health.
  PC-046 now provides exact original-text inspection; multi-item boundaries,
  semantic titles/excerpts, durable provenance, and every decision/delivery
  action remain later work.

### PC-046 Implement queue list and inspector

- Waiting time, requesting session, reason, consequence, recommendation, source, evidence, keyboard flow, and conflict state.
- Current status: protocol 13 adds a compact current-candidate queue list and
  one exact authenticated on-demand item inspection. Rows show fixed
  type/source/requesting-role/confidence plus process-local first-seen evidence.
  The right inspector renders bounded exact current UTF-8 as inert text and
  exposes source path, IDs, revisions, boundary, hashes, and timestamps.
  Unavailable reason/consequence/recommendation/evidence/conflict fields are
  labelled rather than inferred. Rewrite, degradation, config drift,
  disconnect, mode exit, and late responses clear text; Back/Escape restores
  row focus and terminal selection/layout stays unchanged. Decisions,
  authority, delivery, durable provenance, multi-item parsing, conflict
  detection, and semantic field extraction remain PC-047 onward.

### PC-047 Implement immutable local decisions

- Answer/deny/approve payload, actor label, timestamp, source identity, and decision hash.
- Current status: protocol 14 uses separate bounded question-answer and
  approval-decision requests, exact current identity/type revalidation, and a
  server-assigned local actor, time, UUID, and canonical SHA-256 hash. One
  private versioned `queue-state.json` serializes atomic immutable appends,
  returns identical replays without writing, rejects competing decisions, and
  recovers exact records after reload/restart. The inspector exposes a bounded
  answer form or separately confirmed Approve/Deny controls, then replaces
  them with the local immutable record. Recording itself never delivers,
  acknowledges, applies, executes, or sends a decision; PC-048 owns the
  separate compatibility boundary.

### PC-048 Deliver decisions compatibly

- Explicit target and delivery mechanism, idempotency, delivered/unknown/failed state, and no blind retry.
- Current status: protocol 15 accepts only immutable decision ID/hash delivery
  authority. The server revalidates exact source/config truth, snapshots the
  accepted answer-file or live role-PTY target, persists one hashed intent
  before the side effect, and stores delivered/failed/unknown evidence in
  queue-state schema 2 with compatible schema-1 migration. Answer files are
  deterministic private no-clobber JSON; role prompts are one JSON-escaped
  comment line and claim only terminal transport acceptance. The inspector
  requires Review/Cancel/Confirm, reloads durable evidence, and never retries a
  completed or uncertain attempt. Acknowledgement, conflict resolution,
  applied state, supersession, and explicit resolution remain PC-049.

### PC-049 Implement acknowledgement and conflict handling

- Observable acknowledgement/applied state, file rewrites, competing answers, truncation, duplicate items, and manual resolution.
- Current status: protocol 16 and queue-state schema 3 expose content-free
  source conflicts, no-follow exact answer-artifact evidence, immutable
  human-labelled lifecycle resolutions, and one separately confirmed retry
  only after a failed or unknown first attempt is explicitly confirmed not
  delivered. Browser and authenticated restart evidence preserve queue,
  target, configuration, terminal, and prior decision truth. Provider-native
  acknowledgement remains unavailable rather than inferred.

### PC-050 Implement worker and objective context

- Compact worker list, current objective/plan text from configured sources, recent decisions, and resulting activity.
- Current status: protocol 17 exposes one identity-free read-only Control
  context request. The server performs bounded stable no-follow reads of only
  the accepted objective/plan paths and projects at most twelve newest
  validated immutable decisions with recording, latest transport attempt, and
  latest human-labelled lifecycle evidence kept distinct. Pacium mode renders
  every accepted worker once in configured order from exact session or
  capability-labelled preset bindings; Open selects only an existing exact
  PTY, and Git changes appear only when already loaded for that selected
  worker. Browser correlation, config/mode/disconnect invalidation, restart
  reconstruction, inert text, responsive/forced-color UI, and unchanged
  terminal/source/config evidence are covered. Multi-item parsing,
  provider-native status, causal resulting-work links, task state, worker
  launch, and background Git fan-out remain absent.

## Epic 5 — Native agent enrichment

### PC-060 Define provider observation contract

- Capabilities, version, health, source, confidence, freshness, typed extension data, and bounded raw diagnostics.
- Current status: protocol 19 carries one strict version-1 provider snapshot on
  each Claude Code or Codex session and forbids provider state on shell
  sessions. Fixed bounds cover capabilities, activity, diagnostics, strings,
  scalar diagnostic fields, timestamps, uniqueness, and provider-matched typed
  extensions; secret-like diagnostic keys and arbitrary raw payloads are
  rejected. Provider attention enters the existing source-precedence/staleness
  reducer, while validated provider facts and observer
  ready/degraded/stale/unavailable health appear in the Activity inspector.
  Sessions currently start honestly unavailable with unknown capabilities.
  Live Claude/Codex detection, transport, ingestion, approval/question
  responses, persistence, and runtime control remain PC-061/PC-062 work.

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
- Current status: complete. Protocol 18 reports strict per-socket Local or
  Tailscale/login evidence. Startup configuration, canonical local/remote
  Origin separation, Host/Origin/login/token/Funnel enforcement, exact WSS
  policy, compact accessible labelling, proxy-shaped HTTP/WebSocket/PTy tests,
  direct non-loopback denial, and the active Serve/grants/revocation runbook
  are implemented. Real tailnet, certificate, deployed-grant, Funnel/public,
  and revocation propagation checks remain an explicit release gate rather than
  claimed repository evidence.

## Deferred backlog

These items require a future strategy and ADR:

- multi-user authorization;
- multi-host control;
- public hosting;
- generalized tasks/runs;
- automated worktree and PR orchestration;
- organization audit and backups.
