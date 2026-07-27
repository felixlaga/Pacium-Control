# Changelog

All notable changes to the Pacium Control blueprint are recorded here.

## 0.24.0 — explicit Pacium prompt targeting — 2026-07-27

### Added

- A compact Pacium-only composer that lists Meta, Orchestrator, then configured
  workers from accepted workspace bindings and exact current session IDs.
- Honest target states for unassigned presets, missing sessions, process
  startup/exit/failure, configuration replacement, and disconnect; only an
  exact live connected direct-session binding can send.
- A 4,000-Unicode-character prompt boundary that trims outer whitespace,
  rejects empty input and every C0/C1 control including line breaks, and adds
  exactly one carriage return after deliberate Send or `Cmd/Ctrl+Enter`.
- Exact existing `terminal.input` request correlation with duplicate-send
  locking, transport-acceptance-only success copy, rejected-draft retention,
  no automatic retry, and unknown-outcome handling after disconnect.
- Ephemeral prompt scope that never selects the visible terminal, persists a
  draft, or survives success, mode exit, refresh, disconnect target reset, or
  live-target drift beyond the documented recovery behavior.
- Compact desktop, 320 CSS px, 200% zoom, forced-color, reduced-motion, hostile
  text, keyboard, and focus behavior while keeping the terminal as the primary
  visual surface.

### Verified

- `pnpm verify` passed formatting, lint, all workspace type checks, 75 test
  files and 410 tests, plus the 794.93 kB web and 166.07 kB local-server
  production bundles.
- `pnpm test:e2e` passed all nine Chromium regression workflows.
- The real browser workflow kept an ordinary terminal selected, explicitly
  targeted Meta, ignored plain Enter, sent through `Cmd/Ctrl+Enter`, observed
  the marker only in Meta's real PTY, and reset target/draft after the matching
  transport result.
- Browser evidence also blocks multiline paste, clears unsent scope on mode
  exit and refresh, and keeps labelled composer controls usable at 320 CSS px,
  200% zoom, forced colors, and reduced motion.
- Unit, semantic, and transport tests cover stable role/worker order, exact-ID
  resolution, all availability states, Unicode/control limits, one generated
  carriage return, hostile labels, duplicate locking, unrelated responses,
  rejection, disconnect, target drift, and exact request bytes.

### Known limitations

- A successful result confirms only that the local server accepted terminal
  input. It does not prove an agent received, read, processed, approved, or
  completed the prompt.
- Prompts are intentionally one line, browser-ephemeral, non-retriable, and
  absent outside Pacium mode; there is no history, template, attachment,
  provider conversation, or durable delivery receipt.
- Worker targets appear only when already present in the server-owned workspace;
  the browser still has no general worker/config editor or worker status list.
- Queue observation/classification/list/decisions/delivery,
  acknowledgement/conflicts, and objective/plan content remain PC-044 through
  PC-050.
- Verification ran on Node.js 26.4.0 rather than pinned Node.js 24.18.x.
- The web bundle remains above Vite's 500 kB warning threshold.

## 0.23.0 — pinned Meta and Orchestrator roles — 2026-07-27

### Added

- Stable Meta and Orchestrator cards above ordinary Pacium sessions with exact
  accepted session-ID resolution and explicit
  live/starting/ending/ended/failed/missing/disconnected evidence.
- Existing-role Open through the unchanged browser tab, split, terminal attach,
  snapshot, and input paths without creating or duplicating a PTY.
- A role-scoped Assign/Change dialog limited to eligible live Pacium sessions,
  fixed server launch capabilities, and already-configured repositories.
- Strict minimal first-workspace construction and immutable one-role
  replacement that preserves workspace identity, repositories, the other role,
  workers, queue sources, delivery methods, and context.
- Fixed-preset role launch with exact `session.created` request correlation,
  optimistic protocol-10 binding to the created session ID, duplicate-action
  suppression, and explicit partial-failure recovery that preserves the PTY.
- Compact two-card hierarchy, responsive modal layout, deterministic first and
  return focus, text-only hostile evidence, forced-color support, and reduced
  motion behavior.
- A disposable Playwright Pacium data directory so browser tests never use the
  operator's real server-owned workspace state.

### Verified

- `pnpm verify` passed formatting, lint, all workspace type checks, 72 test
  files and 380 tests, plus the 787.01 kB web and 166.07 kB local-server
  production bundles.
- `pnpm test:e2e` passed all nine Chromium regression workflows.
- The real browser workflow assigned an existing PTY to Meta, opened it without
  duplication, configured an Orchestrator fixed preset, launched one direct
  PTY, bound its exact created session ID, changed modes without losing
  context, and restored both bindings after refresh.
- Unit and semantic tests cover exact-ID resolution, every process/config
  state, disconnect, unavailable capabilities, configured/default cwd,
  occupied-slot filtering, minimal workspace creation, immutable replacement,
  create correlation, hostile text, and bounded dialog actions.
- Browser accessibility evidence covers both cards and the assignment dialog
  at 320 CSS px, 200% zoom, forced colors, reduced motion, and keyboard focus.

### Known limitations

- PC-043 has not added prompt composition or explicit Meta, Orchestrator, or
  worker targeting. Role cards never send terminal input.
- Worker role UI, queue observation/classification/list/decisions/delivery,
  acknowledgement/conflicts, and objective/plan content remain PC-044 through
  PC-050.
- The browser editor intentionally cannot edit workspace identity,
  repositories, workers, queue sources, delivery methods, context sources, or
  verification references.
- Direct-session bindings become Missing after local-server restart and require
  explicit change or relaunch; no name, preset, repository, or output inference
  is used.
- A PTY created before a binding conflict or lost response remains an ordinary
  terminal and must be explicitly rebound after fresh config inspection.
- Verification ran on Node.js 26.4.0 rather than pinned Node.js 24.18.x.
- The web bundle remains above Vite's 500 kB warning threshold.

## 0.22.0 — functional General/Pacium workspace mode — 2026-07-27

### Added

- A real General/Pacium presentation-mode control with a strict version-1
  browser preference that safely falls back to General.
- One shared mode transition for the segmented control, command palette, and
  bounded `G` then `P` shortcut, including terminal, editable, modal, modifier,
  and repeat ownership guards.
- A compact Pacium definition card that honestly distinguishes loading,
  unconfigured, configured, errored, and disconnected evidence without
  manufacturing live role or queue state.
- Configured workspace, role, worker, repository, and queue-source counts
  projected only from accepted protocol-10 configuration observations.
- Explicit retry and persistence-failure feedback that leaves PTYs and current
  browser state intact.
- Responsive, zoom, forced-color, reduced-motion, focus, semantic, and hostile
  text coverage for the new presentation.

### Verified

- `pnpm verify` passed formatting, lint, all workspace type checks, 68 test
  files and 353 tests, plus the 770.96 kB web and 166.07 kB local-server
  production bundles.
- `pnpm test:e2e` passed all eight Chromium regression workflows after the
  browser was launched with the macOS host permission it requires.
- Browser evidence covers pointer, `G` then `P`, palette, and reload mode
  changes while preserving the selected terminal and Changes inspector.
- Unit and semantic evidence covers strict storage, unavailable storage,
  shortcut expiry and ownership, palette projection, all configuration summary
  states, retry visibility, and text-only hostile evidence.

### Known limitations

- Pacium mode does not yet resolve, pin, launch, replace, or repair configured
  Meta, Orchestrator, or worker bindings. PC-042 begins that work.
- Queue observation, classification, decisions, answers, delivery,
  acknowledgements, conflicts, objective/plan content, and compact worker
  oversight remain PC-044 through PC-050.
- The preference currently applies to the one browser shell rather than a
  future multi-workspace router.
- Verification ran on Node.js 26.4.0 rather than pinned Node.js 24.18.x.
- The web bundle remains above Vite's 500 kB warning threshold.

## 0.21.0 — server-owned Pacium workspace configuration — 2026-07-27

### Added

- Protocol-10 strict get, complete-replace, and observation messages for one
  versioned Pacium workspace with no command, environment, signal, terminal
  byte, queue content, context content, answer content, or verification
  definition fields.
- Bounded contracts for explicit Meta, Orchestrator, and worker live-session or
  fixed-preset bindings; canonical repositories; exact-root verification
  references; queue-source metadata; future answer-file/role-prompt delivery
  metadata; and objective/plan source metadata.
- Complete graph validation for unique IDs and paths, repository/delivery
  references, one-slot-per-live-session bindings, configured role targets, and
  source/answer separation.
- A deterministic macOS-first data directory with an absolute
  `PACIUM_DATA_DIR` override and one 96 KiB version-1 `pacium.json` file.
- Private current-user directory/file checks, strict bounded UTF-8 reads,
  corrupt/unsupported preservation, canonical path/reference validation, and
  read-time drift detection that still permits explicit direct-session
  bindings to become unresolved after restart.
- Optimistic complete replacement with serialized writes, same-directory
  unpredictable exclusive temporary files, restrictive modes, file sync,
  atomic rename, directory sync, reread verification, stale conflicts, safe
  cleanup, and explicit post-rename durability ambiguity.
- Authenticated WebSocket get/replace ownership and browser request state that
  retains accepted observations, accepts only matching responses, drops
  pending intent on disconnect, and performs a fresh get after reconnect.
- Operator, architecture, filesystem, security, issue, plan, backlog, and
  status documentation for exact ownership, limits, recovery, and deferred
  behavior.

### Verified

- `pnpm verify` passed formatting, lint, all workspace type checks, 64 test
  files and 339 tests, plus the 766.29 kB web and 166.07 kB local-server
  production bundles.
- `pnpm test:e2e` passed all seven Chromium regression workflows after the
  browser was launched with the macOS host permission it requires.
- Contract tests cover bounds, strict unions, graph/reference invariants,
  observation states, forbidden authority fields, and protocol version 10.
- Filesystem and fault tests cover canonical directories/files, missing leaves,
  symlinks, repository containment, live/catalog references, private
  permissions, absent/corrupt/unsupported/oversized state, concurrent and stale
  revisions, rename failure, cleanup, and post-rename durability ambiguity.
- Authenticated WebSocket tests prove unconfigured/get/create/replace/conflict
  behavior and missing-live-session rejection without disk creation or PTY
  impact. Browser tests prove request serialization, evidence retention,
  stale-response rejection, disconnect recovery, and reconnect reads.

### Known limitations

- PC-040 exposes no setup/editor UI and does not make the visible Pacium toggle
  functional. General/Pacium presentation begins with PC-041.
- Role pinning/launch, prompt targeting, queue reads/watchers/classification,
  decisions, answer delivery, acknowledgement/conflicts, worker resolution, and
  objective/plan content reads remain PC-042 through PC-050.
- There is one workspace and no migration, backup, browser repair, multi-host,
  multi-user, database, workflow engine, event journal, or tmux binding.
- Existing direct-session references are intentionally explicit but unresolved
  after server restart; later role UI must label and recover them without
  name-based inference.
- The current machine ran verification on Node.js 26.4.0, not pinned Node.js
  24.18.x.
- The web bundle remains above Vite's 500 kB warning threshold.

## 0.20.0 — deterministic recent activity — 2026-07-27

### Added

- A pure selected-session Activity projection over existing process, attention,
  Git changes, local-HEAD history, and verification evidence with no protocol
  change or duplicate system of record.
- Honest current evidence that keeps source, confidence, freshness, process
  state, and the absence of assigned-task proof visible.
- Newest-first occurred/observed facts with stable identities, at most three
  commits, one working-tree observation, one latest verification run, process
  lifecycle evidence, and a seven-fact ceiling.
- Source-specific idle, loading, ready, empty, unavailable, and error evidence
  that retains prior results during refresh and keeps partial failures visible
  without affecting the terminal.
- A lazy fifth Activity inspector tab with one explicit Refresh action,
  semantic empty/no-selection states, five-tab keyboard order, text-only
  untrusted evidence, and compact 320 CSS px layouts.

### Verified

- `pnpm verify` passed formatting, lint, type checking, 60 test files and 292
  tests, and both production bundles.
- `pnpm test:e2e` passed all seven Chromium workflows. Activity coverage proved
  lazy reads, current process/attention, changed-file and commit facts, latest
  verification result, Refresh, browser reload, unchanged terminal selection,
  five-tab keyboard navigation, and 320 CSS px layout.
- Unit and semantic coverage passed for process honesty, timestamp semantics,
  deterministic bounds/order, Git/verification source states, retained
  evidence during refresh, output exclusion, hostile text, and empty/partial
  presentation.

### Known limitations

- Activity is a disposable current projection, not a durable event history.
  There is no “since last checked” cursor, activity persistence, export,
  search, filtering, polling, or automatic filesystem refresh.
- Provider-native and hook observations are not connected yet. Live processes
  therefore remain process-observed Unknown, and there is no agent narrative.
- Queue decisions and Pacium-mode worker/objective activity begin with the
  Pacium-mode slices.
- The connected in-app browser backend was unavailable; automated headless
  Chromium evidence passed, while independent manual visual and screen-reader
  review remain release gates.
- The current machine ran verification on Node.js 26.4.0, not pinned Node.js
  24.18.x.
- The web bundle is 759.50 kB before gzip and retains the tracked warning.

## 0.19.0 — explicit verification presets — 2026-07-27

### Added

- Protocol-9 verification inspect, run, cancel, response, and update contracts
  with strict state-specific invariants and no browser command, argument, cwd,
  environment, timeout, or signal fields.
- An optional strict version-1 external JSON catalog with a 64 KiB file cap,
  canonical repository roots, absolute executable/argument definitions, at
  most 32 repositories and 16 presets each, and fail-closed validation outside
  configured repositories.
- A shell-free local process owner with one active run per session, two active
  runs globally, bounded allowlisted environment, required timeout, process
  groups, graceful cancellation, two-second forced-termination fallback, and
  graceful-shutdown cleanup.
- Separate 24 KiB stdout/stderr retention with prefix/tail truncation,
  UTF-8-safe control normalization, final serialized-message protection, and no
  logging or persistence.
- Honest pass, nonzero/signal failure, timeout, cancellation, spawn/error,
  forced-termination, duration, exit/signal, and fresh start/end HEAD evidence.
- A lazy fourth Checks inspector tab with exact argv and local-authority
  disclosure, explicit Run/Cancel, elapsed state, bounded output, truncation,
  changed/unavailable HEAD warnings, stale-response rejection, reconnect
  inspection, error recovery, and compact narrow layouts.
- Operator documentation for configuration, security, result scope, and
  restart behavior.

### Verified

- `pnpm verify` passed formatting, lint, type checking, 58 test files and 278
  tests, and both production bundles.
- `pnpm test:e2e` passed all seven Chromium workflows; the configured-check
  workflow verified exact catalog presentation, pass evidence, browser reload
  during a live run, recovered cancellation, final signal evidence, four-tab
  keyboard navigation, unchanged terminal selection, and 320 CSS px layout.
- Real child-process coverage passed for exact argv/cwd, bounded environment,
  pass, nonzero exit, stderr, timeout, graceful and forced cancellation,
  per-session/global concurrency, output truncation, spawn failure, changed
  HEAD, WebSocket lifecycle, shutdown suppression, and PTY survival.

### Known limitations

- Verification configuration is startup-only and intentionally external; there
  is no browser editor, automatic discovery, scheduling, retry, pipeline, CI
  provider, artifact, or durable run history.
- Output becomes visible when a process completes; live output streaming is
  deferred.
- HEAD association does not freeze or fingerprint the live working tree.
- Browser refresh is recoverable while the same local server remains alive.
  Results disappear on restart, and a hard server crash leaves the prior
  process/outcome unknown until inspected at the OS level.
- Configured executables are trusted operator code and run with local user
  authority without a sandbox.
- Recent activity remains PC-038; Pacium mode remains upcoming.
- The connected in-app browser backend was unavailable; automated headless
  Chromium evidence passed, while independent manual visual and screen-reader
  review remain release gates.
- The current machine ran verification on Node.js 26.4.0, not pinned Node.js
  24.18.x.
- The web bundle is 748 kB before gzip and retains the tracked warning.

## 0.18.0 — bounded local commit history — 2026-07-27

### Added

- Protocol-8 selected-session history requests and strict ready, unborn/empty,
  non-repository, and degraded observations with no browser revision, range,
  count, path, format, command, or environment input.
- One fixed local `HEAD` Git log read with no shell, pager, signature display,
  prompt, optional lock, remote, or network operation.
- NUL-framed commit normalization with a 1.5 second timeout, 256 KiB raw-output
  ceiling, 51-record read window, 50-record payload cap, and bounded commit IDs,
  parents, author names, authored times, subjects, errors, and final messages.
- An accessible History inspector tab with compact hash, subject, author, local
  time, Merge, truncation, freshness, unborn, and degraded evidence plus lazy
  loading, explicit Refresh, and three-tab arrow/Home/End navigation.
- Disposable per-session history state with stale/cross-session response
  rejection, prior-evidence refresh, disconnect recovery, and no persistence or
  PTY interaction.

### Verified

- `pnpm verify` passed formatting, lint, type checking, 51 test files and 227
  tests, and both production bundles.
- `pnpm test:e2e` passed all six Chromium workflows; deterministic temporary-Git
  evidence verified lazy History load, subject/author/hash, Refresh, keyboard
  movement, unchanged terminal selection, and the 320 CSS px inspector.
- Real-Git fixtures passed for linear, merge, unusual control-character,
  detached, 51-record truncated, and unborn histories.

### Known limitations

- Configured-base relationships, commit patches/details, graph lanes, search,
  pagination, signatures, remote/PR metadata, and every Git mutation remain out
  of scope.
- Verification presets and recent activity remain PC-037 and PC-038.
- The connected in-app browser backend was unavailable; automated headless
  Chromium evidence passed, while independent manual visual and screen-reader
  review remain release gates.
- The current machine ran verification on Node.js 26.4.0, not pinned Node.js
  24.18.x.
- The web bundle is 733 kB before gzip and retains the tracked warning.

## 0.17.0 — bounded one-file diff oversight — 2026-07-27

### Added

- Protocol-7 one-file diff requests and strict ready, empty, binary,
  too-large, stale, non-repository, and error observations with aggregate
  cross-field invariants.
- Fresh session-owned changed-path revalidation before fixed no-shell Git
  reads, including tracked, untracked, and unborn-HEAD behavior.
- A 64 KiB patch limit, 2,000-line limit, 4,096-character line limit, bounded
  paths/errors, short-circuited binary/known-large files, and a final serialized
  WebSocket message check.
- A compact Changes subview with unified-diff syntax, old/new line numbers,
  literal case-insensitive search, hunk collapse, wrapping, explicit refresh,
  Back/Escape navigation, and file-row focus restoration.
- Disposable keyed browser state that rejects stale responses, interrupts
  pending reads on disconnect, retains at most one selected diff per session,
  and never persists patch content.

### Verified

- `pnpm verify` passed formatting, lint, type checking, 46 test files and 199
  tests, and both production bundles.
- `pnpm test:e2e` passed all five Chromium workflows; the deterministic
  temporary-Git workflow verified file selection, deleted/added lines, search,
  wrap, collapse, Escape return, focus restoration, and terminal selection.
- Real-Git fixtures passed for tracked, staged, unstaged, mixed, deleted,
  renamed, conflicted, untracked, binary, known-large, symlink, stale, and
  unborn states.

### Known limitations

- Commit history, configured verification, recent activity, Git mutations,
  language grammar highlighting, side-by-side review, and automatic filesystem
  refresh remain later slices.
- The connected in-app browser backend was unavailable; automated headless
  Chromium evidence passed, while independent manual visual and screen-reader
  review remain release gates.
- The current machine ran verification on Node.js 26.4.0, not pinned Node.js
  24.18.x.
- The web bundle is 725 kB before gzip and retains the tracked warning.

## 0.16.0 — bounded changed-files oversight — 2026-07-27

### Added

- Protocol-6 changed-file observations with strict cross-field invariants,
  bounded paths/counts/errors, and a command-free session-owned request.
- Fixed read-only porcelain-v2 status and numstat inspection with a 1.5 second
  timeout, 512 KiB output limit, 5,000-record parse limit, and 500-file payload
  cap.
- Deterministic conflict, mixed, staged, unstaged, and untracked oversight
  ordering plus semantic add/modify/delete/rename/copy/type-change states.
- Known text additions/deletions, explicit unavailable binary counts, file-size
  classification, and large-file labels without file-content reads.
- A lazy per-session Overview/Changes inspector with refresh, empty, loading,
  truncated, degraded, reconnect, stale-response, and keyboard-tab behavior.
- Real-Git fixture coverage and a Chromium workflow proving that changed-file
  inspection preserves the selected terminal.

### Verified

- `pnpm verify` passes formatting, lint, type checking, 39 test files and
  169 tests, and both production bundles.
- `pnpm test:e2e` passes all five Chromium keyboard, focus, responsive,
  accessibility-preference, zoom, and changed-files workflows.
- A temporary real repository matched staged, unstaged, mixed, untracked,
  deleted, renamed, type-changed, conflicted, binary, and large-file evidence.

### Known limitations

- Diff text, commit history, configured verification, and automatic filesystem
  refresh begin with PC-035 through PC-038.
- Git copy records are supported and parser-tested, but ordinary Git status
  commonly reports newly copied content as added unless Git itself emits copy
  evidence.
- The default macOS Git wrapper on this machine remains blocked by the
  unaccepted Xcode license; direct Xcode Git powered fixture and browser
  evidence without changing that machine state.
- The current machine ran verification on Node.js 26.4.0, not pinned Node.js
  24.18.x.
- The web bundle is 713 kB before gzip and retains the tracked warning.

## 0.15.0 — evidence-backed repository context — 2026-07-27

### Added

- Protocol-5 repository observations with strict ready, non-repository, and
  degraded invariants.
- Fixed read-only Git inspection for canonical root, branch or detached/unborn
  HEAD, full commit, main/linked worktree kind, and observation time.
- A 750 ms per-command timeout, 32 KiB output bound, disabled prompts, root
  containment check, and bounded error copy.
- Typed repository refresh through the existing authenticated WebSocket
  boundary; refresh changes only evidence and preserves the PTY.
- A compact selected-session Repository card with explicit freshness, absent
  and degraded states, and a Refresh control.

### Verified

- `pnpm verify` passes formatting, lint, type checking, 34 test files and
  141 tests, and both production bundles.
- `pnpm test:e2e` passes all four Chromium keyboard, focus, responsive,
  accessibility-preference, and zoom workflows.
- Direct fixed Git commands matched the current checkout’s canonical root,
  branch, and exact HEAD.

### Known limitations

- Dirty/clean state, changed files, diff, commits, and verification begin with
  PC-034 through PC-037.
- The default macOS Git wrapper on this machine remains blocked by the
  unaccepted Xcode license; Pacium reports bounded degraded evidence until Git
  is usable.
- The current machine ran verification on Node.js 26.4.0, not pinned Node.js
  24.18.x.
- The web bundle is 703 kB before gzip and retains the tracked warning.

## 0.14.0 — unread attention and quiet notifications — 2026-07-27

### Added

- A strict version-1 browser-local seen/notified/mute cursor capped at 200
  sessions with safe invalid-state fallback.
- Important-only unread markers for needs-input, failure, and completion
  evidence, acknowledged by visible session selection.
- Per-session notification mute that preserves in-app attention truth.
- An explicit settings-only notification permission request and honest
  permission status.
- Duplicate-safe hidden-page browser delivery gated by saved preference,
  granted permission, unread evidence, and session mute.
- Generic notification copy that excludes session names, paths, terminal
  content, prompts, and evidence reasons.

### Verified

- `pnpm verify` passes formatting, lint, type checking, 33 test files and
  128 tests, and both production bundles.
- `pnpm test:e2e` passes all four Chromium keyboard, focus, responsive,
  accessibility-preference, and zoom workflows.

### Known limitations

- Current process evidence can produce failure and clean-exit completion.
  Needs-input alerts require future provider or queue observers.
- Browser notification metadata is personal browser-local state and does not
  synchronize between profiles.
- The current machine ran verification on Node.js 26.4.0, not pinned Node.js
  24.18.x.
- The web bundle is 699 kB before gzip and retains the tracked warning.

## 0.13.0 — evidence-labelled attention reducer — 2026-07-27

### Added

- A pure working/waiting/needs-input/finished/failed/stale/unknown reducer with
  labelled native, hook, human, process, terminal, and no-evidence sources.
- Deterministic source, confidence, and recency precedence plus stale conversion
  that prevents weak terminal noise from overriding stronger evidence.
- Honest process-only projection: live is Unknown, nonzero/signalled exit is
  Failed, and clean exit is Finished with unverified-task copy.
- Textual attention state in session rows and a source/confidence/reason/time
  evidence card in the inspector.
- Reducer boundary and server-rendered semantic tests.

### Verified

- `pnpm verify` passes formatting, lint, type checking, 31 test files and
  120 tests, and both production bundles.

### Known limitations

- Provider-native and hook observations are not connected yet; a live process
  intentionally remains Unknown.
- Unread cursors and notification delivery begin with PC-032.
- The current machine ran verification on Node.js 26.4.0, not pinned Node.js
  24.18.x.
- The web bundle is 694 kB before gzip and retains the tracked warning.

## 0.12.0 — evidence-labelled agent detection — 2026-07-27

### Added

- Strict provider-neutral classification types for Shell, Codex, Claude Code,
  and unknown agents, with bounded source, confidence, and observation time.
- Deterministic server-owned classification on every fixed Shell, Codex CLI,
  and Claude Code CLI launch preset.
- Protocol version 4 session summaries with required immutable classification
  evidence that browser create messages cannot supply or override.
- A compact selected-session evidence card showing type, source, confidence,
  and observation time.
- Accessible session-row names that state classification and process lifecycle
  without inferring “working.”
- Contract, launch-definition, session-manager, WebSocket, presentation-model,
  and server-rendered evidence tests.

### Verified

- `pnpm verify` passes formatting, lint, type checking, 29 test files and
  114 tests, and both production bundles.
- `pnpm test:e2e` passes all four existing Chromium keyboard and responsive
  workflows against protocol 4.
- Session creation uses one timestamp for both creation and launch-evidence
  observation, and the evidence remains intact in existing session messages.

### Known limitations

- Process liveness does not imply agent activity; PC-031 adds attention state
  from separately labelled evidence.
- Configured-command, unknown/adopted-process, provider-version, Claude hook,
  and Codex native classification remain future slices.
- The current machine ran verification on Node.js 26.4.0; the pinned Node.js
  24.18.x runtime remains to be verified.
- The web bundle is 690 kB before gzip and still emits the tracked chunk-size
  warning.

## 0.11.0 — responsive accessibility baseline — 2026-07-27

### Added

- Stable names for the session navigation, terminal workspace, inspector,
  terminal panes, status, and all current modal surfaces.
- Keyboard-visible skip navigation plus a compact live status line for
  connection, selected session, and terminal/application keyboard ownership.
- Browser-local version-1 sidebar and inspector visibility with visible
  controls, `Cmd/Ctrl B`, `Cmd/Ctrl Shift B`, and command-palette actions.
- Responsive sidebar and inspector drawers that preserve PTYs, tabs, splits,
  selection, and reconnect state.
- One tested Escape and Tab-containment contract across create, directory,
  session-action, rename, settings, and command dialogs, with invoking-focus
  restoration.
- Reduced-motion and forced-colors behavior plus a documented 320 CSS px
  minimum.
- Deterministic panel, shortcut, focus, status, and server-rendered semantic
  tests plus four Playwright accessibility workflows.

### Verified

- `pnpm verify` passes formatting, lint, type checking, 27 test files and
  106 tests, and both production bundles.
- `pnpm test:e2e` passes skip navigation, panel shortcuts, nested modal focus
  return, 320 CSS px drawers, 200% zoom, forced colors, and reduced motion in
  Chromium.
- The browser suite caught and now guards a compact-layout selector that had
  made the drawer’s New terminal action unreachable.

### Known limitations

- Manual screen-reader, visual contrast, and international keyboard-layout
  checks remain release evidence rather than automated certification.
- The full rendered create/type/refresh/reconnect/close terminal lifecycle is
  not yet a browser test.
- The current machine ran verification on Node.js 26.4.0; the pinned Node.js
  24.18.x runtime remains to be verified.
- The web bundle is 689 kB before gzip and still emits the tracked chunk-size
  warning.

## 0.10.0 — local workspace preferences — 2026-07-27

### Added

- A strict version-1 browser-local preference record with bounded parsing, deterministic serialization, and safe defaults.
- System, dark, and light application and xterm themes plus compact and comfortable workspace density.
- Three controlled terminal font stacks, 11–18 px sizing, 1.1–1.6 line height, and 500–10,000 ephemeral scrollback lines.
- In-place terminal option updates and refitting without PTY recreation, input replay, or reconnect-cursor changes.
- Available-provider default launch selection with honest fallback when a saved CLI is unavailable.
- A stored off/important-attention notification level whose delivery remains explicitly deferred to PC-032.
- One settings surface available from the top bar, `Cmd/Ctrl ,`, and command palette, with Cancel, Restore defaults, Apply, Escape, and focus containment.
- Deterministic preference, storage-failure, theme/preset resolution, terminal-option, shortcut, command, and server-rendered settings tests.
- A scoped PC-027 issue and implementation plan with acceptance evidence.

### Verified

- Formatting, lint, type checking, 94 automated tests, and both production bundles pass.
- The development UI and direct `/api/health` endpoint returned HTTP 200 on loopback.
- Malformed, oversized, unknown-version, extra-key, out-of-range, and unavailable-storage states fail safely in deterministic tests.

### Known limitations

- Rendered light/system theme, density, live terminal update, keyboard, focus, responsive, and refresh validation remains pending because no browser backend was available.
- Preferences are intentionally local to one browser profile and do not synchronize across clients.
- Notification delivery begins with PC-032; the current preference is stored but does not request browser permission or emit notifications.
- The current machine ran verification on Node.js 26.4.0; the pinned Node.js 24.18.x runtime remains to be verified.
- The web bundle is 684 kB before gzip and still emits the tracked chunk-size warning.

## 0.9.0 — contextual command palette — 2026-07-27

### Added

- A compact `Cmd/Ctrl K` command palette that ranks selected-terminal context before general workspace commands.
- Bounded case-insensitive token search across session name, repository, preset, cwd, state, and action context.
- Typed dispatch for terminal creation, session switching, split creation/focus/maximize, and existing session actions.
- Consequence-labelled disabled results and confirmation routing for destructive process or record removal.
- A searchable `?` reference for every currently implemented application shortcut.
- Arrow, Enter, Escape, pointer, modal-focus, invoking-focus restoration, no-match, and responsive states.
- Deterministic catalog, ranking, query/result bound, keyboard-routing, and server-rendered component tests.
- A scoped PC-026 issue and implementation plan with acceptance evidence.

### Verified

- Formatting, lint, type checking, 82 automated tests, and both production bundles pass.
- The development UI and direct `/api/health` endpoint returned HTTP 200 on loopback.
- Terminal capture, editable controls, and open modals suppress global palette/help shortcuts in deterministic tests.

### Known limitations

- Rendered pointer, keyboard, modal-focus, responsive, and international-layout validation remains pending because no browser backend was available.
- The palette covers implemented terminal-workspace actions only; Git, provider, Pacium-mode, preferences, and verification commands arrive with their consumers.
- The current machine ran verification on Node.js 26.4.0; the pinned Node.js 24.18.x runtime remains to be verified.
- The web bundle is 673 kB before gzip and still emits the tracked chunk-size warning.

## 0.8.0 — consistent session actions — 2026-07-27

### Added

- One consequence-aware session menu shared by the workspace header, terminal panes, and session/tab context menus.
- Server-owned rename with strict bounded protocol validation and live summary updates.
- Duplicate and ended-session relaunch flows that reuse retained preset, canonical cwd, and terminal dimensions without changing the source.
- Clipboard-aware cwd copy, explicit `SIGINT`, view-only closure, and confirmed live-process termination.
- Repository reveal through a server-selected canonical root and fixed no-shell macOS/Linux host adapter.
- Deterministic protocol, server, WebSocket, host-adapter, action-model, and server-rendered component tests.
- A scoped PC-024 issue and implementation plan with acceptance evidence.

### Verified

- Formatting, lint, type checking, 70 automated tests, and both production bundles pass.
- The development UI and direct `/api/health` endpoint returned HTTP 200 on loopback.
- Host-action errors are typed and bounded; browser-supplied reveal paths are rejected by the protocol.

### Known limitations

- Rendered pointer, keyboard, dialog-focus, and accessibility validation remains pending because no browser backend was available.
- Relaunch context is in memory only and does not survive a local-server restart.
- Repository reveal acts on the Pacium host, including during remote Tailscale Serve access.
- The current machine ran verification on Node.js 26.4.0; the pinned Node.js 24.18.x runtime remains to be verified.
- The web bundle is 656 kB before gzip and still emits the tracked chunk-size warning.

## 0.7.0 — split-pane terminal workspace — 2026-07-27

### Added

- A bounded browser-owned binary layout for up to four nested horizontal or vertical terminal panes.
- Explicit focused-pane state, empty-pane session selection, session move/swap, maximize/restore, and view-only pane closure.
- Pointer and keyboard split creation, pane navigation, and separator resizing.
- Versioned browser-local layout, ratio, focus, and maximize restoration with stale and duplicate session reconciliation.
- Session-keyed terminal handles and reconnect cursors for simultaneous live terminal rendering.
- A multi-subscription WebSocket integration test and server-rendered split-workspace tests.
- A scoped PC-023 issue and implementation plan.

### Verified

- Formatting, lint, type checking, 55 automated tests, and both production bundles pass.
- One WebSocket client receives independent snapshots and binary output from two subscribed PTYs.
- The development UI and direct `/api/health` endpoint returned HTTP 200.

### Known limitations

- Rendered pointer, keyboard, zoom, and accessibility validation remain pending because no browser backend was available.
- The current machine ran verification on Node.js 26.4.0; the pinned Node.js 24.18.x runtime remains to be verified.
- The web bundle is 649 kB before gzip and still emits the tracked chunk-size warning.

## 0.6.0 — host directory picker and tailnet contract — 2026-07-27

### Added

- A token-protected, read-only `GET /api/directories` endpoint with Host, Origin, and bearer-token checks before filesystem access.
- Canonical host-directory resolution with deterministic sorting, bounded results, hidden-folder metadata, and repository markers.
- A compact host working-directory picker with breadcrumbs, Home/default/recent locations, filtering, hidden-folder control, error recovery, and typed-path fallback.
- Versioned, bounded browser-local recent-directory state.
- ADR-0016 defining optional Tailscale Serve as the sole supported remote ingress while Pacium remains loopback-bound.
- A scoped PC-029 issue and implementation plan.

### Verified

- Formatting, lint, type checking, 45 automated tests, and both production bundles pass.
- Resolver, schema, protected HTTP boundary, browser transport, and picker-state behavior have deterministic tests.
- The development UI and direct `/api/health` endpoint returned HTTP 200.

### Known limitations

- Rendered picker interaction and accessibility validation remain pending because no browser backend was available.
- Tailscale Serve setup, identity enforcement, revocation, WebSocket, and public-reachability tests are still PC-077 work; ADR-0016 is a contract, not implementation evidence.
- The current machine ran verification on Node.js 26.4.0; the pinned Node.js 24.18.x runtime remains to be verified.
- The web bundle is 635 kB before gzip and still emits the tracked chunk-size warning.

## 0.5.0 — terminal tab workspace — 2026-07-27

### Added

- Browser-owned terminal tabs that open from sidebar selection without duplicating session references.
- Pinning with a stable leading pinned partition.
- Pointer drag-and-drop and `Alt+Shift+Left/Right` keyboard reordering inside pin groups.
- View-only tab closure with deterministic adjacent selection and explicit process-survival messaging.
- Versioned browser-local tab order and pin restoration with stale-session reconciliation.
- Horizontally scrollable overflow and active-tab visibility recovery.
- A scoped PC-022 issue and implementation plan.

### Verified

- Formatting, lint, type checking, 34 automated tests, and both production bundles pass.
- The development UI and direct `/api/health` endpoint returned HTTP 200.
- Tab parsing, opening, deduplication, closing, selection recovery, pinning, ordering, reconciliation, and version handling have deterministic tests.

### Known limitations

- Rendered browser workflow and accessibility validation remain pending because no browser backend was available.
- The current machine ran verification on Node.js 26.4.0; the pinned Node.js 24.18.x runtime remains to be verified.
- Split panes, richer session actions, and the command palette remain unimplemented.

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
