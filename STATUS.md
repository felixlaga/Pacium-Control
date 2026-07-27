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
implemented at the application boundary; the existing working-directory picker
refresh is next.

Pacium Control now has an executable React application, loopback local server,
direct-PTY session manager, typed WebSocket protocol, and automated terminal,
Git, queue, and Pacium-context tests. This proves the bounded local
compatibility workflow described below; it does not prove provider-native
agent management, a real deployed tailnet/grants/public boundary, durable PTYs,
packaging, or release readiness.

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
- Protocol-18 per-socket Local or Tailscale/login evidence and a compact
  accessible connection badge that clears stale identity on disconnect.
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

- No packaged `pacium` launcher or release artifact.
- No durable session restoration after local-server restart.
- No completed manual screen-reader, visual contrast, or full terminal-lifecycle browser review.
- No general browser editor for workspace identity, repositories, workers,
  queue sources, delivery methods, context sources, or verification references,
  and no shortcut customization.
- No Claude or Codex observer.
- No multi-item parsing, provider-native acknowledgement/activity, worker
  launching/reconfiguration, task state, or causal decision-to-Git/terminal
  correlation.
- No tmux adapter.

Do not extrapolate from the working terminal slice to any capability in this list.

## Current evidence

Verified on 2026-07-28 in the current macOS Apple-silicon checkout:

- `pnpm typecheck`: passed across all six workspace projects.
- `pnpm lint`: passed.
- `pnpm verify`: formatting, lint, type checking, 114 test files and 701 tests,
  plus the 903.24 kB web JavaScript, 107.74 kB stylesheet, and 335.82 kB
  local-server production builds passed.
- `pnpm test:e2e`: eleven Chromium workflows passed for skip navigation, panel
  shortcuts and drawers, nested modal focus return, 320 CSS px layout, 200%
  zoom, forced colors, reduced motion, deterministic
  changed-file/diff/history/Activity inspection, and configured verification
  run/reload/cancel without terminal reselection. General/Pacium coverage
  proved pointer, chord, palette, reload persistence, unchanged selected PTY
  and inspector context, configured-state presentation, and narrow layouts.
- PC-077 browser evidence kept the exact current connection authority visible
  as Local through ordinary operation, reload, narrow layout, forced colors,
  and reduced motion without promoting terminal or provider output to identity.
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
- The protocol-version-18 boundary passed strict contract, atomic-store,
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

- The current shell exposed Node.js `26.4.0`, not the approved Node.js `24.18.x`; the commands passed with an engine warning, so the supported runtime remains unverified.
- The repository Playwright suite ran in headless Chromium after its browser
  binary was installed and verified the PC-028, PC-034, PC-035, PC-036, PC-037,
  and PC-038 workflows. The connected in-app browser backend remained
  unavailable, so manual visual, screen-reader, and full type/refresh/close
  terminal review are still open.
- The default `git` wrapper remains blocked by the unaccepted Xcode license. The repository's direct Xcode Git binary works, so clean diff, branch, merge, and remote evidence are available without changing that license state.
- `node-pty` used its shipped Darwin arm64 prebuild. Its helper arrived without an executable bit; a narrow postinstall guard repairs that mode.
- Snapshot serialization currently relies on xterm headless proposed buffer APIs and must be reevaluated on terminal dependency upgrades.
- The current web bundle is 903.24 kB before gzip and emits Vite's chunk-size
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

## Open decisions for Milestone 0

- Confirm Node.js 24 and `node-pty` on a clean supported macOS account with the Xcode license accepted.
- Complete browser, accessibility, terminal-escape, and sustained-output testing.
- Decide whether the current ephemeral bootstrap token lifecycle is sufficient for the packaged launcher.
- Packaging strategy after the development CLI works.

The initial runtime, package manager, application stack, and macOS-first platform are fixed in [the toolchain decision](docs/execution/toolchain-and-platform.md).

## Next action

Refresh the existing working-directory picker boundary and interaction before
provider enrichment, durability, and packaging. Complete the real Tailscale
Serve/grants/Funnel/public canary, pinned Node.js 24 clean-install, CI, broader
browser/security, manual accessibility, and sustained-output gates before
release.
