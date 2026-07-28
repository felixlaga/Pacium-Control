# Project status

**Current phase:** Core terminal workspace, bounded Git oversight, server-owned
Pacium configuration, the General/Pacium toggle, and pinned Meta/Orchestrator
roles plus explicit terminal prompt targeting and conservative queue-file
observation, whole-source queue classification, and a read-only queue
list/original-text inspector plus immutable local question/approval decisions
and explicit compatible answer-file/role-prompt delivery, reconciliation,
human-labelled lifecycle evidence, one bounded recovery retry, exact configured
worker summaries, and read-only objective/plan plus recent-decision context are
complete enough for continued slicing. Optional Tailscale Serve access is
implemented at the application boundary, and the working-directory picker
refresh is complete. The bounded provider observation contract is complete;
the narrow Pacium-launched Claude Code and Codex native observers are complete.
Clean activity cards with an explicit browser-local terminal fallback are
complete. Explicit provider compatibility, health, freshness, capability, and
diagnostic degradation is complete. Durable secret-free relaunch manifests and
explicit linked-successor recovery complete the planned native-enrichment
slice. One explicitly configured local tmux socket can now be discovered and
one exact published session can be attached through the existing terminal
workspace. Explicit tmux keep-alive launches and bounded automatic restart
reattachment are complete.
The bounded PC-072 lifecycle, memory, browser-model, and real-PTY descriptor
soak baseline is complete. PC-073 bounded redaction-aware diagnostics,
protected reads, exact preview, and browser-local JSON export are complete.
PC-074 adds the first user-local Apple-silicon application archive, exact
`pacium` command, deterministic manifest/checksum, safe upgrade/uninstall
lifecycle, and installed production/native-PTY verification. The artifact is
explicitly unsigned and unnotarized.
PC-075 adds one separate user-local Ubuntu 24.04 x64 archive, exact XDG
defaults, deterministic manifest/checksum, safe package lifecycle, source-built
x64 native-PTY verification, and pinned hosted Linux verification. The Linux
artifact is explicitly unsigned, not distro-native, and not a broader Linux
compatibility claim.

Pacium Control now has an executable React application, loopback local server,
direct-PTY session manager, typed WebSocket protocol, and automated terminal,
Git, queue, and Pacium-context tests. This proves the bounded local
compatibility workflow described below; it does not prove provider management,
manual real-provider Claude/Codex canaries, a real deployed
tailnet/grants/public boundary, durable direct PTYs, broader Linux
distribution/architecture support, signing, notarization, or release
readiness.

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
- Optional all-or-nothing Tailscale Serve startup configuration with one
  canonical `*.ts.net` HTTPS Origin, bounded exact operator-login allowlist,
  canonical local-Origin isolation, exact remote Host/Origin/login checks,
  Funnel denial, and the unchanged ephemeral token for protected transport.
- Protocol-24 per-socket Local or Tailscale/login evidence, plus one strict
  nullable provider-observation snapshot per session, and a compact accessible
  connection badge that clears stale identity on disconnect.
- Bounded xterm headless snapshots that let a new browser transport attach to a still-live PTY.
- A fixed server-owned Shell, Codex, and Claude Code launch catalog with honest executable availability.
- A bounded private version-1 relaunch-manifest catalog that survives
  local-server restart with fixed preset command metadata, canonical cwd and
  repository reference, environment key names only, exact successor lineage,
  and optional native resume-ID evidence. Detached manifests are separate from
  live sessions; explicit relaunch starts a fresh PTY and never resumes a
  provider automatically.
- An optional one-socket tmux adapter with bounded executable/version/socket
  capability evidence, fixed no-shell session discovery, exact target
  revalidation, PTY-backed client attachment, explicit runtime labels, and
  retained identity-only reattachment manifests. Direct PTYs remain the
  default, and disconnecting a Pacium client never invokes `kill-session`.
- Explicit ready-only tmux keep-alive launch for fixed Shell, Codex, and Claude
  presets with generated target names, direct command arguments, durable
  automatic-reattach policy, exact-client detach, bounded deduplicated startup
  restoration, fresh predecessor-linked identities, and no command rerun when
  a target is missing.
- An isolated scalar-only lifecycle soak covering 20 idle terminals, one
  long-running agent, 100 create/close cycles, 8 MiB output, 100 snapshots,
  explicit peak/retained RSS and live-heap budgets, and a five-real-PTY FD
  canary. Browser models separately cover 2,000 split operations and 5,000
  notification cursors.
- A response-only strict version-1 diagnostics projection with fixed collection,
  string, and 256 KiB response bounds; export-local session labels; component,
  version, process, provider, aggregate queue, tmux, and fixed-code evidence;
  and a complete inclusion/omission manifest. One protected no-store
  Local/Tailscale read feeds a routed modal with explicit refresh, stale
  last-good recovery, exact inert JSON preview, and preview-gated browser-local
  download. It reads no terminal buffer, executes no command, performs no
  source refresh, and persists or uploads nothing.
- An unsigned, unnotarized Apple-silicon macOS development package containing
  one `Pacium Control.app`, exact user-local `pacium` link, production
  browser/server assets, minimal source-built arm64 `node-pty`, strict
  relative-path content manifest, checksum, staged upgrade/rollback, active
  process lease, and exact owned uninstall. Node.js 24.18.x remains external;
  package operations preserve application state and external workspaces.
- A separate unsigned Ubuntu 24.04 x64 development archive with production
  browser/server assets, minimal source-built x64 ELF `node-pty`, exact
  user-local `pacium` link, strict manifest/checksum, no-sudo XDG install,
  staged upgrade/rollback, active-process refusal, and exact owned uninstall.
  It is not distro-native and makes no claim for another Linux target.
- A token-protected, read-only host directory browser with canonical paths,
  direct absolute-path navigation, repository markers, filtering,
  hidden-folder control, breadcrumbs, failure-safe browser-local recent
  choices, deterministic keyboard traversal, and honest recovery.
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
- A lazy fifth Activity inspector that projects current attention, validated
  provider facts, provider observer health/freshness, direct-PTY lifecycle,
  changed-file totals, three recent local commits, and the current/latest
  verification run into at most seven deterministic facts with explicit
  observed/occurred timestamps, compact kind/tone/source metadata, one
  Terminal/Changes/History/Checks source action, source availability, partial
  errors, Refresh, reconnect recovery, and no provider narrative. Without ready
  provider evidence, one explicit operator action may reveal only four
  non-empty lines and 800 Unicode characters from the already-rendered xterm
  buffer as inert browser-local, terminal-derived, low-confidence,
  not-interpreted evidence that clears at session, connection, evidence, and
  reload boundaries.
- A compact provider-status Activity section for Claude Code and Codex with
  explicit ready/unavailable/unsupported/degraded/failed/stale state, provider
  and adapter versions, source/confidence/freshness, all bounded capabilities,
  safe diagnostic code/message/time, terminal independence, and fixed recovery
  guidance. Diagnostic scalar fields are excluded. A browser-only 30-second
  and visibility-restoration clock expires ready snapshots without server or
  terminal polling; each non-ready state links to the existing direct terminal
  and PC-063 fallback without implying task failure.
- A version-1 provider observation contract with fixed capability/activity/
  diagnostic bounds, typed Claude/Codex extensions, distinct questions and
  approvals, source/confidence/freshness evidence, secret-like diagnostic-key
  rejection, launch-preset matching, and honest unavailable defaults.
- A process-local Claude Code observer for Pacium-launched Claude PTYs with
  fixed observation-only HTTP hooks, an independent random per-session token,
  exact loopback-only authenticated ingress, installed-version detection,
  bounded deduplication, typed lifecycle/tool/question/approval/completion/
  failure evidence, optional strict status usage scalars, and no provider
  decisions, settings-file edits, raw payload retention, or terminal coupling.
- A process-local Codex observer for supported Pacium-launched Codex PTYs with
  capability-probed remote/App Server surfaces, one random environment-only
  token and exact loopback route per session, one authenticated transparent
  WebSocket-to-JSONL bridge, strict bounded native lifecycle/tool/plan/usage/
  question/approval/failure metadata, browser-reconnect preservation, and no
  prompt/message/command/output/diff/path/request-content retention or
  generated provider decisions.
- Protocol-17 strict Pacium workspace configuration for explicit Meta,
  Orchestrator, and worker session/preset bindings; canonical repositories;
  verification references; and queue, future-delivery, objective, and plan path
  metadata without generic execution authority, plus content-free queue-source
  observation plus identity-only explicit decision-delivery and lifecycle
  resolution requests.
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
- Stable Meta and Orchestrator cards above ordinary Pacium sessions with exact
  session-ID resolution; live/starting/ending/ended/failed/missing/disconnected
  evidence; existing-PTY Open; and no display-name, preset, repository, or
  terminal-output inference.
- A role-scoped Assign/Change dialog that can preserve the complete accepted
  workspace while selecting only eligible live sessions or fixed server launch
  capabilities, including an intentionally minimal first workspace.
- Fixed-preset role launch through the existing direct-PTY operation, exact
  `session.created` request correlation, optimistic one-role binding, and
  explicit partial-failure behavior that preserves an unbound created terminal.
- A Pacium-only prompt composer with stable Meta, Orchestrator, and configured
  worker identities; exact live-session availability; explicit ephemeral target
  selection; a 4,000-Unicode-character control-free single-line bound; and
  deliberate pointer or `Cmd/Ctrl+Enter` send through existing terminal input.
- Exact prompt request correlation that locks duplicate send, clears scope only
  after transport acceptance, retains rejected drafts without retry, marks
  disconnect outcomes unknown, and never claims provider delivery, processing,
  approval, or completion.
- One local-server queue observer synchronized to exact accepted config
  revisions, with canonical-parent watchers, 200 ms debounce, bounded
  no-follow stable reads, strict UTF-8, a 64 KiB source ceiling, SHA-256
  provenance, process-local revisions, semantic deduplication, bounded retry,
  config-generation guards, and shutdown disposal.
- A compact Pacium-only Queue group that joins content-free source
  evidence to exact accepted IDs, shows honest stable/empty/missing/changing/
  oversized/invalid/unsafe/read/watch states, byte/hash/freshness metadata, and
  explicit Refresh while leaving General mode and terminal state unchanged.
- A deterministic `whole_source_v1` classifier that creates at most one
  source/hash-bound candidate from nonblank stable text; recognizes only exact
  supported question/concrete-approval/failure/review markers; uses a final
  question mark only for medium-confidence questions; and keeps malformed,
  multiple-marker, control-bearing, or unrecognized documents unknown.
- Content-free queue item buttons with exact config/source joining, type,
  requesting role, confidence, process-local first-seen evidence, native
  keyboard activation, narrow type glyphs, and disconnected disabling.
- An authenticated exact-current item inspection bound to workspace/source/
  observation/hash/item identity, with bounded base64 transport, strict UTF-8
  browser decoding, inert original-text rendering, full source provenance,
  honest unavailable structured fields, and no answer or approval action.
- A queue-specific right-inspector route with loading/stale/unavailable states,
  rewrite/config/disconnect/mode clearing, Back/Escape focus restoration, and
  unchanged selected PTY, tabs, splits, and prior session-inspector tab.
- Strictly separate question-answer and approval-decision requests bound to the
  exact current workspace/source/observation/hash/item identity and classified
  type, with UTF-8 byte bounds and rejection of browser-supplied actor,
  timestamp, decision ID/hash, delivery, command, or authority fields.
- A private version-3 `queue-state.json` with a 4 MiB/4,096-record ceiling,
  strict schema/uniqueness/hash validation, serialized same-directory atomic
  mutation, compatible version-1/2 reads and first-mutation migration,
  identical-replay detection, competing-decision rejection, bounded immutable
  lifecycle resolutions, at most two delivery attempts per decision,
  corruption preservation, and explicit unknown-durability recovery.
- Question answer and optional-note controls plus distinct approval/denial
  controls with inline confirmation, pending and failure states, stale-evidence
  clearing, and immutable local record presentation after reload or server
  restart. Recording does not deliver, acknowledge, execute, or send terminal
  input.
- A separate decided-item Delivery section that resolves only the exact
  accepted source method and target, shows ready/unconfigured/unavailable/
  delivering/delivered/failed/unknown truth, and requires explicit
  Review/Cancel/Confirm before invoking one transport.
- Deterministic private mode-`0600` answer-file delivery with atomic no-clobber
  publication, plus one bounded JSON-escaped comment line to an exact
  configured live Meta or Orchestrator PTY. Terminal acceptance does not claim
  provider receipt, handling, acknowledgement, application, or completion.
- Durable intent-before-effect ordering, immutable attempt records, duplicate
  suppression, and restart recovery. Failed or unknown first attempts remain
  locked until an explicit human `confirmed_not_delivered` resolution; one
  separately confirmed second attempt is the absolute limit.
- Content-free source-rewrite, source-degradation, and exact-hash duplicate
  conflicts joined to immutable decisions without exposing or modifying queue
  text.
- On-demand, no-follow answer-target inspection that separates exact transport
  artifacts from unavailable provider acknowledgement and reports changed,
  unsafe, oversized, or unreadable targets as conflicts.
- Explicit Review/Cancel/Confirm lifecycle labels for acknowledged, applied,
  unable-to-apply, confirmed-not-delivered, and superseded evidence. These are
  server-authored, immutable, hash-verified, and visibly human-labelled.
- A compact configured Worker group that preserves accepted order, resolves
  only exact session UUIDs, capability-labels preset-only workers as not
  started, opens only an existing exact PTY, and projects source-labelled
  process, command, repository, attention, freshness, and already-loaded
  selected-session change evidence without task or authorship claims.
- An explicit Control-context inspector backed by one identity-free protocol
  request. It reads only accepted objective and plan paths with stable bounded
  no-follow regular-file/strict-UTF-8 checks, renders inert current text and
  provenance, and reconstructs at most twelve newest immutable decisions with
  local response, latest transport attempt, and latest human-labelled
  lifecycle evidence kept separate.
- Request/workspace-revision correlation plus config, disconnect, mode, Back,
  and route invalidation that prevents stale context text from crossing an
  accepted definition. Context projections are disposable and neither read
  trigger writes files, queue state, configuration, Git, or terminal input.
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

- No Developer ID-signed, notarized, publicly delivered, or owner-accepted
  release artifact. No supported Linux target beyond Ubuntu 24.04 x64.
- No durable direct-PTY process restoration after local-server restart.
- No completed manual screen-reader, visual contrast, or full terminal-lifecycle browser review.
- No general browser editor for workspace identity, repositories, workers,
  queue sources, delivery methods, context sources, or verification references,
  and no shortcut customization.
- No externally launched Claude/Codex attachment, packaged Claude status-line
  companion, or provider decision/control actions. Both provider transports
  are fixture/integration verified but have not completed manual real-provider
  canaries on this machine.
- No multi-item parsing, provider-native acknowledgement/activity, worker
  launching/reconfiguration, task state, or causal decision-to-Git/terminal
  correlation.
  Do not extrapolate from the working terminal slice to any capability in this list.

## Current evidence

Verified on 2026-07-28 in the current macOS Apple-silicon checkout:

- `pnpm typecheck`: passed across all six workspace projects.
- `pnpm lint`: passed.
- Supported Node.js 24.18.0 `pnpm verify`: formatting, lint, type checking, 141
  test files and 922 tests, plus the 967.23 kB web JavaScript, 128.54 kB
  stylesheet, and the split local-server production build passed.
- `pnpm test:e2e`: twenty Chromium workflows passed for skip navigation, panel
  shortcuts and drawers, nested modal focus return, 320 CSS px layout, 200%
  zoom, forced colors, reduced motion, deterministic
  changed-file/diff/history/Activity inspection, and configured verification
  run/reload/cancel without terminal reselection. General/Pacium coverage
  proved pointer, chord, palette, reload persistence, unchanged selected PTY
  and inspector context, configured-state presentation, and narrow layouts.
- PC-070 focused contract, config, parser, real-socket, session-manager,
  authenticated WebSocket, transport, action-semantics, and dialog tests
  passed. Its isolated real-tmux Chromium workflow listed one server-owned
  target, attached it without browser socket/argv authority, sent terminal
  input, reconnected after reload, closed only the browser view, disconnected
  only the tmux client, and then verified the external tmux server session was
  still alive.
- PC-071 focused contract, manifest, transport, adapter, manager, lifecycle,
  semantic-render, and real-tmux evidence passed. The isolated real PTY/tmux
  workflow launched a fixed shell preset, sent terminal input, detached the
  exact client, restarted the manager, restored one fresh predecessor-linked
  client, deliberately closed it, and verified the managed target remained.
  Chromium verifies the ready-only option is explicit and unchecked by default.
- PC-072 supported Node.js 24.18.0 soak evidence covered 20 idle terminals, one
  long-running agent, 100 create/close cycles, 8,388,608 output bytes, 100
  snapshots, 2,000 split operations, and 5,000 notification updates. The
  isolated runner completed in 3,908 ms with 141,787,136-byte peak and retained
  RSS growth, 5,343,056-byte retained live heap, a 162,368-character snapshot,
  zero final sessions, and `/dev/fd` 18 -> 18 across five real PTYs. The canary
  found and fixed parent-side slave PTY, kqueue, and temporary low-number PTY
  descriptor leaks in the pinned macOS `node-pty`.
- PC-073 focused evidence passed 8 contract/projection tests, both targeted
  protected HTTP workflows, and 43 browser transport/model/render/palette
  checks. Hostile fixtures exclude terminal/provider/queue/Git content,
  credentials, paths, IDs, PIDs, commands, host details, and relaunch metadata.
  Its Chromium workflow parsed the actual downloaded JSON; retained a live PTY
  across Back, Escape, direct routing, and browser reload; kept last-good state
  after a failed refresh; and covered 200% zoom, forced colors, reduced motion,
  focus restoration, and isolated PTY cleanup.
- PC-074 `pnpm package:macos:verify` deterministically rebuilt
  `pacium-control-0.0.0-darwin-arm64.tar.gz` at 576,781 bytes with SHA-256
  `c19403a7ff7dee64fbb63ce3f3566763552eb0e762b2d284a7327194843f7c92`
  and 28 manifested files. The isolated installed package loaded arm64
  `pty.node`/`spawn-helper`, exchanged Unicode terminal data, resized and
  closed the PTY, installed/upgraded, served exact production health/assets,
  reused a verified running instance, refused active uninstall, uninstalled
  idempotently, and preserved state/repository/provider/tmux sentinels.
- PC-075’s pinned Ubuntu 24.04.4 x64 workflow used Node.js 24.18.0 and pnpm
  11.17.0 with a frozen source-native install. It passed 141 test files and 922
  tests, the full production build, an x64 real-PTY lifecycle soak, Linux
  package verification, and all applicable Chromium workflows. The soak
  completed in 2,034 ms with 135,872,512-byte peak/retained RSS growth,
  5,230,168-byte retained live heap, a 162,368-character snapshot, zero final
  sessions, and `/dev/fd` 32 -> 32.
- The Linux verifier deterministically rebuilt
  `pacium-control-0.0.0-linux-x64.tar.gz` at 584,044 bytes with SHA-256
  `b5da9fadf2db663123be8bc2a3d888d8a7d18520bb00bfbeb83b067e8fb5f7ca`
  and 27 manifested files. It loaded and drove the packaged x64 ELF PTY,
  installed/upgraded, served exact production health/assets, reused the exact
  running instance, refused active uninstall, uninstalled idempotently, and
  preserved external state. The artifact reports unsigned and not
  distro-native.
- PC-063 focused evidence passed 39 activity-model, semantic-render, and
  terminal-excerpt tests. Its Chromium workflow exercised deterministic compact
  cards, all four source destinations, explicit terminal capture/refresh/hide,
  session and reload invalidation, retained PTY selection, terminal focus,
  320 CSS px, 200% zoom, forced colors, and reduced motion without adding a
  server read, terminal input, persistence, status inference, or decision path.
- PC-064 focused evidence passed 81 Codex/Claude adapter, provider-status,
  semantic-render, recent-activity, and freshness-clock tests. Fixtures cover
  unsupported versus unavailable, degraded versus failed, fresh recovery,
  missing Claude version, expiry without attention, every visible state,
  diagnostic-field exclusion, hostile text, and terminal independence. Its
  real Claude Code browser canary sent no prompt and verified eight capability
  rows, terminal focus, explicit fallback, reload clearing, 320 CSS px, 200%
  zoom, forced colors, and reduced motion.
- PC-077 browser evidence kept the exact current connection authority visible
  as Local through ordinary operation, reload, narrow layout, forced colors,
  and reduced motion without promoting terminal or provider output to identity.
- PC-078 browser evidence recovered from an invalid first path through the
  server-owned default, navigated an exact host path with `Cmd/Ctrl+L`, moved
  filter/result focus by keyboard, returned one canonical folder without
  launching a PTY, survived browser-storage denial, restored a recent choice
  and invoking focus, and fit 320 CSS px plus 200% zoom with forced colors and
  reduced motion.
- PC-061 focused evidence passed 139 contract, Claude normalizer, PTY
  environment, session lifecycle, HTTP/WebSocket boundary, attention, and
  Activity tests. It covers exact Host/Origin/token/path/content-type/body
  enforcement, empty no-decision responses, duplicate and provider-session
  rejection, release-token invalidation, browser reconnect state, bounded
  usage presentation, and exclusion of prompt/transcript/tool/status secrets.
- PC-062 focused contract, Codex normalizer, observer, PTY lifecycle, private
  App Server bridge, HTTP upgrade, reconnect, attention, and Activity evidence
  passed. It covers capability fallback, environment-only token authority,
  exact Host/Origin/path/bearer enforcement, single-client ownership,
  unchanged bidirectional protocol forwarding, malformed/oversized input,
  child exit, PTY release, browser reconnect preservation, cumulative usage,
  deduplication, distinct questions/approvals, and exclusion of prompt/message/
  plan/command/output/diff/path/request/auth content.
- PC-050 browser evidence projected one exact live worker and one preset-only
  worker without launching or inferring either, selected only the existing
  worker PTY, opened/refreshed/closed Control context with focus return,
  preserved terminal selection across browser refresh and mode exit, rendered
  accepted objective/plan text plus honest empty decision evidence, and fit
  the 320 CSS px forced-colors/reduced-motion drawer. Authenticated integration
  coverage proves exact source reads without mutation, bounded decision
  summaries without notes/targets/queue text/PTY input, and reconstruction
  after local-server restart.
- PC-047 browser evidence recorded a bounded question answer, kept Escape in
  the answer field, recovered the immutable record after reload, invalidated
  exact text after a source rewrite, kept approval controls separate, cancelled
  and then confirmed an approval, preserved source/config/terminal state, and
  covered 320 CSS px, forced colors, and reduced motion. Store reconstruction
  separately proves local-server restart recovery.
- PC-049 browser evidence separated exact answer-artifact presence from
  provider acknowledgement, cancelled and confirmed explicit human lifecycle
  labels, reconstructed the lifecycle after reload, and surfaced a stable
  source rewrite as content-free conflict evidence. Authenticated integration
  coverage proves schema-1/2 compatibility, local-server restart
  reconstruction, exact answer-target states, monotonic lifecycle transitions,
  a failed first role transport, its locked retry, one human-unlocked second
  attempt, and rejection of a third attempt.
- PC-042 browser evidence assigned an existing PTY to Meta, opened it without
  duplication, configured an Orchestrator fixed preset, launched one direct
  PTY, bound its exact created session ID, and restored both bindings after
  refresh. Responsive coverage proved both role cards and the assignment
  dialog at 320 CSS px, 200% zoom, forced colors, reduced motion, and focus
  return.
- PC-043 browser evidence kept an ordinary terminal selected while explicitly
  targeting Meta, rejected plain Enter and multiline input, sent through
  `Ctrl+Enter`, observed the marker only in Meta's real PTY, and cleared scope
  after the matching result, mode exit, and refresh. The composer remained
  usable at 320 CSS px, 200% zoom, forced colors, and reduced motion.
- PC-044 browser evidence observed a disposable real queue source, displayed
  stable byte/hash/freshness metadata without rendering its private text,
  refreshed changed evidence, preserved the selected real PTY, hid the source
  surface in General mode, and cleaned its test session. Responsive coverage
  proved the labelled region and Refresh at 320 CSS px, 200% zoom, forced
  colors, and reduced motion.
- PC-045 browser evidence kept “Can you approve everything?” a
  medium-confidence question, then classified only the exact
  `Approval request: ...` rewrite as a high-confidence approval. Neither
  private document rendered in the browser; the selected real PTY and source
  file were preserved. The type/confidence/diagnostic line and Refresh remained
  visible and keyboard-focusable at 320 CSS px with forced colors and reduced
  motion.
- PC-046 browser evidence opened that exact question through a content-free
  list row, rendered its original text only in the inert right inspector,
  returned focus with Escape, removed the old text on source rewrite, and
  opened the replacement explicit approval without exposing an approval
  action. The selected real PTY and source stayed unchanged; the inspector fit
  320 CSS px with forced colors/reduced motion, and the queue Refresh remained
  keyboard-accessible at 200% zoom.
- `pnpm build`: web and local-server production bundles completed.
- `pnpm dev`: Vite and the source local server started together; the UI and direct health route both returned 200.
- The protocol-version-21 boundary passed strict contract, atomic-store,
  canonical path/reference, authenticated WebSocket revision/conflict, PTY
  survival, bounded queue reader/observer/classifier, content-free bulk item
  evidence, exact-current base64 text inspection, stale/config/disconnect
  clearing, approval separation, source-conflict derivation, no-follow target
  reconciliation, human-labelled lifecycle, one-retry gating, bounded context
  file/decision projection, stale-revision rejection, exact configured-worker
  projection, browser request-state, optional Serve startup/request
  classification, exact remote WSS, per-socket connection evidence, and
  stale-identity tests on this machine.
- Built server startup: served the application and health endpoint on `127.0.0.1:4174`.
- Hostile bootstrap Origin: returned HTTP 403.

Evidence boundaries:

- The ordinary interactive shell still exposes Node.js 26.4.0, but PC-072
  through PC-075 verification used the approved Node.js 24.18.0 runtime
  explicitly. A fresh supported macOS account remains unverified; hosted
  Ubuntu evidence is exact to the pinned runner, not another Linux target.
- The repository Playwright suite ran in headless Chromium after its browser
  binary was installed and verified the PC-028, PC-034, PC-035, PC-036, PC-037,
  and PC-038 workflows. The connected in-app browser backend remained
  unavailable, so manual visual, screen-reader, and full type/refresh/close
  terminal review are still open.
- The default `git` wrapper remains blocked by the unaccepted Xcode license. The repository's direct Xcode Git binary works, so clean diff, branch, merge, and remote evidence are available without changing that license state.
- `node-pty` is compiled from pinned sources on each supported target. The
  package builders require the matching arm64 or x64 native module and copy
  only its recognized runtime files.
- Snapshot serialization currently relies on xterm headless proposed buffer APIs and must be reevaluated on terminal dependency upgrades.
- The current web bundle is 929.58 kB before gzip and emits Vite's chunk-size
  warning; code splitting is a later optimization, not a functional blocker.
- Proxy-shaped Serve application tests do not prove the owner's real Tailscale
  installation, DNS/certificate, deployed grants, Funnel/public/LAN state, or
  revocation propagation. The active runbook keeps those as an explicit
  release gate.

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

## Open release evidence

- Confirm Node.js 24 and the source-built packaged `node-pty` on a clean
  supported macOS account with the Xcode license accepted.
- Complete browser, accessibility, terminal-escape, and sustained-output testing.
- Complete the real Tailscale Serve/grants/Funnel/public/revocation canary.
- Complete Developer ID signing, notarization, and owner acceptance under
  PC-076.

The runtime, package manager, application stack, and exact supported hosts are
fixed in [the toolchain decision](docs/execution/toolchain-and-platform.md).

## Next action

PC-075 Ubuntu 24.04 x64 validation is complete. Run PC-076 release-readiness
evidence without extending the host matrix or claiming signing, notarization,
real-tailnet, clean-account, manual accessibility, or owner acceptance before
those exact gates pass.
Complete the real Tailscale Serve/grants/Funnel/public canary, pinned Node.js
24 clean-install, CI, broader browser/security, manual accessibility, and
sustained-output gates before release.
