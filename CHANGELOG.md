# Changelog

All notable changes to the Pacium Control blueprint are recorded here.

## Unreleased — Meta-first remote workspace

### Added

- A local-only Host setup panel under Workspace settings discovers the default
  same-user tmux sessions and signed-in Tailscale node, accepts one published
  Meta session ID, and presents consent/ready actions without configuration
  text fields.
- Private version-1 `host-setup.json` persists the exact derived socket, tmux
  name, fixed loopback port, tailnet Origin, and login with atomic replacement
  and environment override compatibility.

### Changed

- One optional exact `PACIUM_META_TMUX_SESSION` now attaches through the
  existing server-owned tmux socket/adapter and publishes only bounded
  protocol-25 capability evidence.
- A fresh browser selects that exact immutable Pacium session once, enters
  Pacium presentation, and collapses secondary panels. Later navigation
  remains operator-owned.
- The duplicate Pacium prompt-target composer is removed. Meta conversation
  happens in the actual terminal.
- Role, workspace, worker, and queue chrome use compact rows with less visible
  copy and no tall fixed card presentation.
- The Tailscale Serve runbook now documents the full open-URL-to-Meta startup
  configuration and distinguishes it from Tailscale SSH check-mode login.
- Button-driven local setup is now the primary configuration path; command
  examples remain operations-only recovery material.

### Security

- Browser messages cannot choose an SSH host, tmux socket, session name,
  executable, or arguments. Pacium never runs SSH, starts tmux, or recreates a
  missing Meta session; the only Tailscale mutation is the local-only fixed
  exception below.
- ADR-0018 allows only authenticated loopback setup to run the fixed
  `tailscale serve --bg --yes 4174` mutation. Remote setup, unknown existing
  Serve replacement, arbitrary arguments, sudo, passwords, grants, and Funnel
  remain prohibited.

### Verification

- Current formatting, lint, type checks, 144 test files and 923 tests, and
  production builds passed.
- All 20 ordinary Chromium workflows and the separate PC-079 isolated
  real-tmux workflow passed before the PC-080 setup panel was added.
- A separate isolated real-tmux Chromium workflow passed fresh Meta focus,
  terminal input, refresh snapshot restoration, and one Pacium session.
- The PC-080 fake-Tailscale browser workflow is implemented, but its final
  Chromium rerun was blocked by the browser-execution approval service. No
  rendered-pass claim is made for that new workflow.
- Verification used Node.js 26.4.0 because the required Node.js 24.18.x runtime
  was unavailable. The real `felix-harness` canary remains external
  owner-environment evidence.

## 0.46.0 — Release-readiness audit — 2026-07-28

### Added

- A bounded `release:preflight` command and unit contract that fail closed on
  unsupported hosts/runtimes, dirty candidates, forbidden source/archive
  paths, missing package contracts, checksum/manifest mismatch, and dishonest
  distribution claims while returning scalar evidence.
- A candidate-specific PC-076 matrix with exact source, runtime, package,
  security, performance, accessibility-automation, external/manual boundary,
  rollback, and preservation evidence.
- The preflight is required by the pinned Ubuntu workflow after package
  verification.

### Fixed

- The patched macOS `node-pty` build now strips source/debug symbols before
  linking. Separate source roots produce byte-identical, loadable
  `pty.node`/`spawn-helper` while retaining the Mach-O UUID and ad-hoc signature
  required by macOS.
- macOS package build and verification reject native source/debug metadata
  regressions.
- Repository-context unit fixtures and the browser verification workflow no
  longer inherit the containing checkout’s `.git` directory; exact Git
  archives can run the full gates.

### Security

- A clean frozen archive install verified all 296 lockfile policy entries.
  Strict source/package inventories and a content-suppressing tracked scan
  found no recognized secret signatures, non-example environment files,
  runtime state, transcripts, queues, repositories, provider stores, host
  identity, or `.git` content in the package boundary.
- A current registry advisory audit was deliberately not sent because it would
  disclose the dependency inventory without destination-specific authority.
  No clean-advisory claim is made.
- Zero valid Developer ID signing identities and zero configured Tailscale
  Serve TCP/Web entries were observed. No signing, notarization, tailnet,
  provider, or publication mutation was performed.

### Verified

- The exact-source macOS archive passed formatting, lint, all workspace type
  checks, 142 test files and 930 tests, production builds, and the bounded
  lifecycle soak.
- All 20 Chromium workflows passed after the clean-archive fixture correction.
- Two source roots reproduced the same 573,683-byte macOS archive, SHA-256
  `923fe2f41533eee7c8591999002d783212e679545e959aca6ceba8d96415075c`,
  with 28 manifested files and every installed-package canary green.
- Cross-root native hashes are
  `50d506c692c05c2037450b88f550ff0ba9ea1aed0b4f2e15b9b2ad529a237ea3`
  for `pty.node` and
  `5f581b5794183c8783108fbdff0f570de48cab0a91506ee27048f310e6a25c2d`
  for `spawn-helper`.

### Decision

- PC-076 and the defined PC-063 through PC-076 implementation roadmap are
  complete.
- The release decision is **NO-GO** and the release class remains
  **Development snapshot**. A current dependency advisory audit, fresh
  supported macOS account, Developer ID signing/notarization, real Tailscale
  and provider canaries, manual accessibility/sustained-use review, and
  explicit owner release acceptance remain mandatory.
- No tag, release, public artifact, signing request, notarization submission,
  or follow-on roadmap work is implied.

## 0.45.0 — Ubuntu Linux validation — 2026-07-28

### Added

- ADR-0017’s exact second supported host: Ubuntu 24.04 LTS on x86-64, with
  `/bin/bash`, XDG application-state defaults, bounded XDG child-environment
  inheritance, and explicit denial of broader Linux compatibility.
- One deterministic-content unsigned, non-distro-native Linux archive with
  production browser/server assets, minimal source-built x64 ELF `node-pty`,
  strict version-1 manifest, checksum, exact user-local `pacium` command,
  no-sudo installer/uninstaller, and embedded guide.
- A Linux package verifier covering deterministic rebuild, manifest/hash/mode
  integrity, native PTY load/Unicode/resize/exit, install/upgrade, production
  health/assets, exact-instance reuse, active-uninstall refusal,
  foreign-target denial, idempotent removal, and external-state preservation.
- A bounded Ubuntu 24.04 workflow with read-only repository permission,
  immutable Node 24 action revisions, frozen source-native dependencies, full
  verification, lifecycle soak, package verification, all applicable Chromium
  workflows, and short-retention archive/checksum upload.

### Fixed

- Platform defaults, real-PTY/soak fixtures, package-runtime selection, process
  lease recognition, and fixed browser opening now distinguish exact macOS
  arm64 and Linux x64 behavior without weakening loopback or package checks.
- Tests no longer depend on `/bin/zsh`, a globally configured Git committer
  identity, the local checkout directory spelling, or an installed Claude CLI.
  The provider-degradation browser workflow uses a disposable explicit CLI
  fixture.

### Security

- Linux install and uninstall accept only exact absolute user-owned
  destinations, recognized application/link ownership, sibling
  staging/rollback, and the private active-process lease; they never use
  `sudo`, install a service, inspect broad processes, or own application state.
- Package and CI outputs contain fixed code/file/scalar metadata only. Node,
  browsers, shells, provider CLIs, Git, tmux, Tailscale, credentials,
  environments, terminal bytes, repositories, queue content, and Pacium state
  remain external.

### Verified

- The pinned Ubuntu 24.04.4 x64 runner used Node.js 24.18.0 and pnpm 11.17.0,
  passed 141 test files and 922 tests, the production build, the bounded
  lifecycle soak, Linux package verification, and all applicable Chromium
  workflows.
- The Linux soak completed in 2,034 ms with 135,872,512-byte peak/retained RSS
  growth, 5,230,168-byte retained live heap, a 162,368-character snapshot, zero
  final sessions, and `/dev/fd` 32 -> 32.
- `pnpm package:linux:verify` reproduced the 584,044-byte
  `pacium-control-0.0.0-linux-x64.tar.gz` with SHA-256
  `b5da9fadf2db663123be8bc2a3d888d8a7d18520bb00bfbeb83b067e8fb5f7ca`
  and 27 manifested files, then passed every installed-package canary.
- Supported Apple-silicon macOS full verification, package verification, and
  all 20 Chromium workflows remained green.

### Known limitations

- This evidence supports only Ubuntu 24.04 x64 and Apple-silicon macOS with
  external Node.js 24.18.x. The Linux artifact is not `.deb`, RPM, AppImage,
  Flatpak, Snap, a service, or a root/global installation.
- Both artifacts remain development evidence. PC-076 clean-account,
  real-tailnet, signing/notarization, manual accessibility/sustained-use, exact
  limitations, delivery posture, and owner-acceptance gates remain open.

## 0.44.0 — macOS development package — 2026-07-28

### Added

- One deterministic-content Apple-silicon archive containing a valid
  `Pacium Control.app`, exact user-local `pacium` link, production browser and
  local-server bundles, minimal patched source-built arm64 `node-pty`, strict
  version-1 content manifest, SHA-256 checksum, installer, uninstaller, and
  embedded install guide.
- A bounded package launcher with fixed help/version/no-open behavior,
  Node.js 24.18.x and port validation, exact Pacium health-signature reuse, and
  fixed `/usr/bin/open` invocation only after a new loopback server listens.
- User-local no-sudo install/upgrade with recognized sibling staging, prior-app
  rollback, exact link ownership, and an ephemeral mode-0600 process lease for
  active-uninstall refusal without broad process-list access.
- A package verifier covering deterministic rebuild, manifest/hash/mode
  integrity, unsigned status, arm64 native files, real PTY
  load/Unicode/resize/exit, isolated install/upgrade, production health/assets,
  exact-instance reuse, active-uninstall refusal, idempotent uninstall, foreign
  target denial, and external-state preservation.

### Fixed

- The production local-server build now bundles xterm headless/serialization,
  WebSocket, validation, and shared-contract JavaScript while leaving only
  `node-pty` external for the packaged native runtime.
- Local-server shutdown closes idle HTTP keep-alive connections, allowing the
  foreground package process and its lease to end promptly.
- The app launcher resolves its exact absolute installed command symlink before
  locating resources and rejects relative command links.

### Security

- Installer and uninstaller validate absolute non-root destinations, bundle
  identity, symlink state, exact command ownership, and active process identity
  before replacement or removal.
- Manifest and checksum generation copy fixed production/runtime inputs only
  and expose no checkout, home, temp, credential, environment, terminal,
  repository, queue, provider, or host identity.
- Node, provider CLIs, Git, tmux, Tailscale, repositories, credentials, queue
  files, and application state are not bundled or removed.

### Verified

- Supported Node.js 24.18.0 `pnpm verify` passed formatting, lint, all workspace
  type checks, 140 test files and 910 tests, plus the 967.23 kB web JavaScript,
  128.54 kB CSS, and 1,460.40 kB split local-server production build.
- `pnpm package:macos:verify` reproduced the 576,781-byte
  `pacium-control-0.0.0-darwin-arm64.tar.gz` with SHA-256
  `c19403a7ff7dee64fbb63ce3f3566763552eb0e762b2d284a7327194843f7c92`
  and 28 manifested files, then passed every installed-package canary.
- All 20 Chromium workflows passed.

### Known limitations

- This artifact is unsigned, unnotarized, external-Node, Apple-silicon
  development evidence. It is not a public or owner-accepted release.
- PC-075 Linux validation and PC-076 clean-account, real-tailnet,
  accessibility, signing/notarization, and owner-acceptance gates remain open.

## 0.43.0 — bounded redaction-aware diagnostics — 2026-07-28

### Added

- One strict response-only version-1 diagnostics schema capped at 256 KiB,
  100 export-local session rows, 12 components, 24 fixed diagnostic-code rows,
  and short bounded manifest/version/status fields.
- A pure server projection of application/dependency versions, component
  health, complete PTY lifecycle counts, sanitized session state, provider
  health, aggregate queue types/conflicts, optional tmux status/version, and
  fixed diagnostic-code counts.
- A token-protected no-store `/api/diagnostics` read using the existing exact
  Local/Tailscale Host, Origin, verified identity, method, and body boundary.
- A clean routed `/diagnostics` modal opened from the header or command palette
  with explicit refresh, last-good stale recovery, exact inert JSON preview,
  and preview-gated browser-local download.

### Fixed

- Diagnostics history focus restoration now runs only when the Diagnostics
  route owned focus, so ordinary hash/skip-link navigation remains intact.
- The modal remains operable at 320 CSS pixels and simulated 200% zoom, and the
  browser test removes only its own terminal fixture after proving survival.

### Security

- Structural allowlisting excludes terminal content/input/titles,
  session/process identity, commands/argv, paths/repositories, Git content,
  queue text/decisions, provider content/fields, environments/credentials,
  host/operator identity, and relaunch metadata.
- The export is never persisted, uploaded, emailed, copied, or logged by
  Pacium. Diagnostics performs no PTY, queue, Git, provider, tmux, filesystem,
  command, or durable-state action.

### Verified

- Focused contract/projection, protected HTTP, transport, state, semantic,
  palette, redaction, and download checks passed.
- Supported Node.js 24.18.0 `pnpm verify` passed formatting, lint, every
  workspace type check, 136 test files and 880 tests, plus 967.23 kB web
  JavaScript, 128.54 kB CSS, and 478.21 kB local-server production bundles.
- All 20 Chromium workflows passed. The diagnostics workflow parsed the actual
  download and preserved a live PTY through Back, Escape, direct routing,
  browser reload, failed refresh, accessibility modes, and explicit cleanup.

### Known limitations

- This is local support metadata, not telemetry, log capture, crash reporting,
  an archive, or a production monitoring claim.
- PC-074 macOS packaging, PC-075 Linux validation, and PC-076 release
  readiness remain open.

## 0.42.0 — lifecycle and memory soak baseline — 2026-07-28

### Added

- One isolated `pnpm test:soak` workload for 20 idle terminals, one
  long-running agent, 100 create/close cycles, 8 MiB output, 100 reconnect
  snapshots, memory budgets, and five real-PTY cleanup cycles.
- Deterministic 2,000-operation split-layout and 5,000-update attention-inbox
  load invariants with the existing four-pane and 200-cursor ceilings.
- Scalar-only duration, RSS, live-heap, snapshot, session, and FD evidence that
  excludes terminal bytes, environment values, paths, and provider content.

### Fixed

- PTY data/exit subscriptions are now disposed when sessions close or the
  local server shuts down.
- The newest attention cursor is retained before deterministic sorting, so the
  just-recorded event cannot be evicted and immediately redelivered.
- A committed macOS `node-pty` patch closes parent-side slave PTYs,
  process-watcher kqueues, and temporary low-number PTY descriptors. macOS
  installs compile the patched source and accept either source-built or
  upstream-prebuilt helper layouts.

### Verified

- Supported Node.js 24.18.0 soak completed in 3,908 ms with 141,787,136-byte
  peak/retained RSS growth, 5,343,056-byte retained live heap, a
  162,368-character snapshot, zero final sessions, and `/dev/fd` 18 -> 18.
- `pnpm verify` passed formatting, lint, all workspace type checks, 132 test
  files and 863 tests, plus the 949.29 kB web JavaScript, 122.44 kB stylesheet,
  and 458.05 kB local-server production bundles.
- `pnpm test:e2e` passed all 19 Chromium workflows.

### Known limitations

- This is a bounded development-machine personal-load baseline, not production
  telemetry or a multi-day field-soak claim.
- The patched native source build still needs a fresh-account clean-install
  proof under PC-074. Diagnostics, packaging, Linux, and release-readiness
  remain PC-073 through PC-076.

## 0.41.0 — tmux keep-alive — 2026-07-28

### Added

- Protocol 24 optional `keepAlive` create intent plus explicit `attached` and
  `keep_alive` runtime/manifest evidence. Direct PTY remains the default and
  the browser cannot supply a command, argv, socket, target name, environment,
  or restoration policy.
- Generated `pacium-<uuid>` detached targets for available fixed presets using
  direct tmux command arguments, bounded output/time, strict result parsing,
  and exact timeout recovery without a shell or blind retry.
- Durable-before-client keep-alive manifests and bounded startup restoration
  that selects the newest exact unique targets, revalidates them sequentially,
  creates fresh predecessor-linked Pacium client IDs, and never reruns a
  missing command.
- Exact tmux client discovery/detach for deliberate close and awaited
  local-server shutdown, plus distinct keep-alive labels, recovery policy copy,
  and one ready-only unchecked launch option.

### Verified

- `pnpm verify` passed formatting, lint, every workspace type check, 131 test
  files and 859 tests, plus the 949.29 kB web JavaScript, 122.44 kB stylesheet,
  and 457.78 kB local-server production bundles.
- `pnpm test:e2e` passed all 19 Chromium workflows. The tmux UI canary verifies
  the ready-only keep-alive option is explicit and unchecked; the existing
  external tmux workflow still proves input, browser reload, view close,
  exact-client disconnect, and surviving target behavior.
- An isolated real tmux 3.7b and real-PTY integration launched a fixed shell,
  observed terminal input, detached the client, restarted the manager,
  restored one fresh linked client, deliberately closed it, and verified the
  managed target survived both lifecycle boundaries.

### Known limitations

- Automatic restoration applies only to explicit keep-alive manifests on the
  one configured safe socket. External attachments and direct PTYs remain
  manual; missing targets retain Recovery evidence and are never restarted.
- Native provider observation is unavailable inside the tmux runtime rather
  than inferred from terminal text.
- Verification ran on Node.js 26.4.0 rather than pinned Node.js 24.18.x. The
  web build retains Vite's chunk-size warning; soak, diagnostics, packaging,
  Linux, and release-readiness gates remain PC-072 through PC-076.

## 0.40.0 — optional tmux attachment — 2026-07-28

### Added

- Protocol 23 bounded tmux capability, session observation, exact attach
  request, runtime target, and relaunch-manifest contracts.
- Optional `PACIUM_TMUX_SOCKET` configuration for one bounded absolute local
  Unix socket, plus executable/version detection that never starts a server.
- Fixed no-shell, timeout- and output-bounded `list-sessions` discovery with
  strict identities, safe text, duplicate rejection, and exact target
  revalidation before fixed `attach-session` argv.
- PTY-backed tmux clients that reuse terminal input, resize, snapshots,
  refresh reconnect, tabs, splits, focus, repository context, and retained
  attachment manifests while keeping direct PTYs as the default.
- A compact `Attach tmux` dialog with loading, empty, unavailable, retry,
  selection, observed-time, revalidation, and explicit client/server lifecycle
  copy. Session actions never claim that closing the Pacium client kills the
  external tmux server session.

### Verified

- `pnpm verify` passed formatting, lint, every workspace type check, 130 test
  files and 849 tests, plus the 947.23 kB web JavaScript, 121.76 kB stylesheet,
  and 444.68 kB local-server production bundles.
- `pnpm test:e2e` passed all 18 Chromium workflows. The PC-070 isolated tmux
  3.7b canary discovered and selected one published target, attached it,
  exercised terminal input and browser reload, closed only the browser view,
  disconnected only the client, and verified the external session still
  existed afterward.

### Known limitations

- PC-070 attaches existing sessions only. PC-071 owns launch-under-tmux
  keep-alive and automatic reattachment after local-server restart.
- One startup-configured socket is supported; browser-selected sockets,
  multiple servers, window/pane mutation, and `kill-session` are intentionally
  unavailable.
- Verification ran on Node.js 26.4.0 rather than pinned Node.js 24.18.x. The
  web build retains Vite's chunk-size warning; packaging and remaining release
  gates are PC-072 through PC-076.

## 0.39.0 — durable relaunch manifests — 2026-07-28

### Added

- Protocol 22 strict version-1 relaunch manifests on accepted session
  summaries, a bounded list response, and a relaunch request containing only
  manifest identity plus terminal dimensions.
- A private `relaunch-manifests.json` catalog capped at 100 newest records with
  ownership, permission, symlink, UTF-8, schema, uniqueness, order, and byte
  validation plus atomic private replacement and directory durability sync.
- Server-authored fixed preset command metadata, canonical cwd and
  repository-at-launch reference, environment key names only,
  provider/runtime classification, exact predecessor lineage, and optional
  matching native resume-ID evidence.
- A compact Recovery group separate from live sessions and one accessible
  manifest preview covering provider, command, cwd, repository, key names,
  resume-reference availability, fresh-process consequences, disconnected
  behavior, Escape, focus restoration, and explicit confirmation.
- Server-owned relaunch that revalidates the stored cwd and current preset,
  creates a new immutable session/manifest pair, selects the successor, and
  never automatically resumes provider state.

### Verified

- Contract, state-store, session-manager, provider-resume, restart/reload,
  WebSocket, transport, semantic-render, security, and failure-focused tests
  pass. A restart fixture proves the retained manifest remains available while
  no direct PTY is claimed live.
- `pnpm verify` passed formatting, lint, every workspace type check, 127 test
  files and 831 tests, plus the 937.58 kB web JavaScript, 119.17 kB stylesheet,
  and 428.72 kB local-server production bundles.
- `pnpm test:e2e` passed all 17 Chromium workflows. PC-065 exits and removes a
  shell, opens the detached manifest, verifies retained facts and no-auto-resume
  copy, cancels with focus restoration, relaunches a fresh successor, and
  preserves suite isolation.

### Known limitations

- Direct PTYs still end with the local server. PC-070 and PC-071 own optional
  tmux attachment and keep-alive.
- Resume identifiers are retained evidence only; provider resume commands need
  separate supported-provider validation and are not automatic.
- Verification ran on Node.js 26.4.0 rather than pinned Node.js 24.18.x. The web
  build retains Vite's chunk-size warning; packaging and release gates remain
  PC-072 through PC-076.

## 0.38.0 — explicit provider degradation — 2026-07-28

### Added

- Explicit Codex compatibility outcomes: undetectable version evidence remains
  unavailable, while a detected CLI missing required remote or App Server
  surfaces is unsupported with confirmed unsupported capabilities.
- Separate degraded malformed-event and failed fatal-transport states with
  fixed bounded severity/code/message/time diagnostics. Fresh authenticated
  Codex evidence restores ready and clears transient adapter diagnostics.
- A fixed Claude version-uncertainty diagnostic that remains compatible with
  later valid hooks and clears when authenticated status supplies a version.
- A pure provider-status projection for ready, unavailable, unsupported,
  degraded, failed, and stale health; provider/adapter versions;
  source/confidence/freshness; bounded capabilities; safe diagnostic
  code/message/time; terminal independence; and fixed recovery guidance.
- A compact Activity provider-status surface with one existing-terminal focus
  action and state-specific PC-063 fallback copy. Diagnostic scalar fields and
  raw provider content are deliberately excluded.
- One browser-only 30-second freshness tick plus immediate visible-page refresh
  so a ready snapshot expires even without provider attention. It makes no
  server request, terminal read, provider action, or durable write.

### Verified

- Focused Codex/Claude adapter, provider-status model, semantic-render,
  recent-activity, and freshness-clock coverage passed 81 tests.
- `pnpm verify` passed formatting, lint, every workspace type check, 125 test
  files and 815 tests, plus the 929.58 kB web JavaScript, 118.08 kB stylesheet,
  and 411.54 kB local-server production bundles.
- `pnpm test:e2e` passed all 16 Chromium workflows. The PC-064 canary launched
  a real Claude Code PTY without sending a prompt, rendered eight capability
  rows and current provider status, focused the unchanged terminal, exercised
  explicit fallback and reload clearing, and remained usable at 320 CSS px,
  200% zoom, forced colors, and reduced motion.

### Known limitations

- Capability probing remains authoritative; Pacium does not declare a
  universal supported Claude Code or Codex version range.
- Diagnostics are current bounded observer evidence, not a persisted log or
  export. PC-073 still owns explicit previewable/redactable diagnostics.
- Relaunch and resume metadata remain PC-065. Verification ran on Node.js
  26.4.0 rather than pinned Node.js 24.18.x, and the web build retains Vite's
  chunk-size warning.

## 0.37.0 — clean agent activity cards — 2026-07-28

### Added

- Deterministic compact presentation kinds, restrained operational tones,
  bounded metadata, and one Terminal, Changes, History, or Checks source action
  for provider, process, Git, and verification facts.
- Distinct prompt, message, turn, tool, plan, question, approval, usage,
  completion, and failure cards. Questions and approvals remain separate and
  neither adds a provider or Pacium decision action.
- A read-only xterm handle backed by a pure excerpt bounder. One explicit
  operator click may read only the newest four non-empty rendered lines and 800
  Unicode characters when provider evidence is not ready.
- Inert terminal fallback presentation labelled terminal-derived,
  low-confidence, and not interpreted, with explicit Refresh and Hide controls
  and session, connection, provider-evidence, unmount, and reload invalidation.
- Hostile control, bidi, HTML-like, and long Unicode text neutralization and
  bounds before component state; no new protocol, server read, polling, input,
  attach, persistence, notification, attention, queue, or provider-control
  path.

### Verified

- Focused activity-model, semantic-render, and terminal-excerpt suites passed
  all 39 tests.
- `pnpm verify` passed formatting, lint, every workspace type check, 122 test
  files and 786 tests, plus the 921.56 kB web JavaScript, 112.89 kB stylesheet,
  and 409.10 kB local-server production bundles.
- `pnpm test:e2e` passed all 15 Chromium workflows. PC-063 coverage exercised
  all four source destinations, explicit capture/refresh/hide, terminal focus,
  unchanged selection, session/reload clearing, 320 CSS px, 200% zoom, forced
  colors, and reduced motion.

### Known limitations

- The excerpt is an operator-requested view of the selected browser's parsed
  xterm buffer, not provider state or a transcript store. It can be empty or
  unavailable and is intentionally not shared across browsers.
- Rich unsupported-version, observer-failure, stale-event, and recovery
  diagnostics remain PC-064. Relaunch manifests remain PC-065.
- Verification ran on Node.js 26.4.0 rather than pinned Node.js 24.18.x. The
  web build retains Vite's existing chunk-size warning.

## 0.36.0 — Codex native observer — 2026-07-28

### Added

- Protocol 21 bounded cumulative Codex context-window, input, cached-input,
  output, reasoning-output, and total-token fields within the strict
  provider-matched observation boundary.
- Capability-probed observation for supported Pacium-launched Codex PTYs. Each
  session receives one exact loopback remote URL and random environment-only
  token, while unsupported capability leaves the ordinary direct launch
  unchanged and observer-unavailable.
- One authenticated, no-Origin, exact-Host, exact-UUID, single-client
  WebSocket bridge per observed session. It starts only the canonical Codex
  executable as `app-server --listen stdio://` and forwards bounded valid
  TUI/App Server messages unchanged over private JSONL stdio.
- Strict thread, turn, item, plan, usage, failure, approval, and question
  normalization with deduplicated source/confidence/freshness evidence and
  bounded Activity details. Prompt, message, plan, command, output, diff, path,
  request, credential, environment, and raw-frame content is discarded.
- Explicit bridge cleanup for PTY exit/removal, browser-independent session
  lifecycle, transport failure, child exit, local-server shutdown, malformed or
  oversized data, plus preservation of current process-local native evidence
  across browser reconnect.

### Verified

- `pnpm verify` passed formatting, lint, every workspace type check, 121 test
  files and 766 tests, plus the 914.86 kB web JavaScript, 109.81 kB stylesheet,
  and 409.10 kB local-server production bundles.
- `pnpm test:e2e` passed all 14 Chromium workflows.
- Focused capability, contract, normalizer, observer, bridge, session
  lifecycle, HTTP upgrade, reconnect, and Activity tests cover unsupported
  fallback, token separation, exact authority, one-client ownership, unchanged
  bidirectional forwarding, invalid/oversized input, child exit, PTY release,
  duplicate/foreign identity handling, usage, distinct questions/approvals,
  content exclusion, and the absence of generated JSON-RPC decisions.

### Known limitations

- Codex App Server's remote WebSocket surface is experimental. Pacium probes
  required capabilities and fixtures against installed Codex CLI `0.145.0`;
  PC-064 still owns richer unsupported-version and degraded-capability UX.
- Only supported Codex sessions launched by Pacium are observed. Existing
  external sessions are not adopted, and bridge children, tokens, and
  observations disappear with the local server.
- Current evidence does not include a manual real-provider canary because no
  prompt was sent and no user configuration was changed. Pacium does not
  prompt, steer, interrupt, answer, approve, or otherwise decide for Codex.
- Verification ran on Node.js 26.4.0 rather than pinned Node.js 24.18.x. The
  web build retains Vite's existing chunk-size warning.

## 0.35.0 — Claude Code observer — 2026-07-28

### Added

- Protocol 20 bounded Claude status extensions for model, context use, total
  input/output tokens, and cost, with the same strict provider-matched snapshot
  boundary.
- One process-local Claude observer registration per Pacium-launched Claude
  PTY, including installed-version detection, a random 256-bit URL-safe token,
  fixed observation-only HTTP hook settings, and bounded server-owned
  environment additions.
- Strict loopback hook/status ingress requiring POST, exact Host, no Origin,
  JSON content type, a canonical session UUID, bearer authentication, a 64 KiB
  body ceiling, provider-session correlation, and typed normalization.
- Deduplicated SessionStart, prompt, tool, permission, question, completion,
  failure, and SessionEnd evidence with source/confidence/freshness and
  capability transitions. Successful hooks receive only an empty `204` and
  cannot approve, deny, block, retry, or otherwise decide for Claude.
- Activity details for bounded Claude model/context/token/cost evidence while
  discarding prompts, transcripts, tool inputs/outputs, environments,
  credentials, status titles, and raw payloads.

### Verified

- `pnpm verify` passed formatting, lint, every workspace type check, 118 test
  files and 743 tests, plus the 913.94 kB web JavaScript, 109.81 kB stylesheet,
  and 368.49 kB local-server production bundles.
- `pnpm test:e2e` passed all 14 Chromium workflows after the required
  unsandboxed macOS launch. The first sandboxed attempt was blocked before page
  creation by Chromium Mach-port permission denial, not an application
  assertion.
- A 139-test focused contract/observer/PTY/session/HTTP/WebSocket/attention/
  Activity gate passed. Security cases cover wrong method, Host, Origin, token,
  content type, malformed/oversized input, provider-session drift, duplicate
  delivery, released tokens, raw-field exclusion, and no decision response.

### Known limitations

- Only Claude sessions launched by Pacium are observed. Existing external
  Claude processes are not adopted, and observations/tokens disappear with the
  local server.
- Pacium does not edit user/project settings or replace the operator's single
  Claude status-line command. The strict status receiver exists, but a
  companion command is not packaged; managed HTTP-hook allowlists can leave
  the observer unavailable while the PTY continues working.
- Current evidence is fixture and local integration coverage, not a
  manual real-provider Claude canary. Codex native observation remains PC-062.
- Questions and approvals remain observation-only. No browser or server action
  answers, approves, prompts, steers, interrupts, or executes for Claude.
- Verification ran on Node.js 26.4.0 rather than pinned Node.js 24.18.x. The
  web build retains Vite's existing chunk-size warning.

## 0.34.0 — provider observation contract — 2026-07-28

### Added

- Protocol 19 session snapshots with one strict nullable version-1 provider
  observation that must match the server-owned Claude Code or Codex launch
  preset; shell sessions cannot carry provider state.
- Fixed capability, activity, diagnostic, scalar-field, string, and timestamp
  bounds; duplicate IDs, arbitrary raw payloads, cross-provider extensions,
  secret-like diagnostic keys, and impossible freshness order are rejected.
- Distinct question and approval activity kinds, typed Claude/Codex extension
  data, provider/adapter versions, adapter health, source, confidence, and
  freshness without storing prompts, transcripts, environments, tool
  input/output, credentials, or tokens.
- Honest initial unavailable health and unknown capabilities for agent
  terminals while their direct PTYs and process evidence remain independent.
- Explicit native/hook attention integration through the existing precedence
  and staleness reducer, plus bounded provider facts and
  ready/degraded/stale/unavailable observer evidence in the Activity inspector.

### Verified

- `pnpm verify` passed formatting, lint, every workspace type check, 116 test
  files and 722 tests, plus the 913.12 kB web JavaScript, 109.81 kB stylesheet,
  and 345.21 kB local-server production bundles.
- `pnpm test:e2e` passed all 14 Chromium workflows after the Activity evidence
  boundary copy was synchronized. The existing terminal, directory,
  responsive/accessibility, Pacium roles/context/queue, Git, verification,
  reconnect, and mode-preservation workflows remained green.
- Focused schema, protocol, server, attention, activity-model, semantic-render,
  and preset/provider-boundary tests cover unavailable defaults, native/hook
  precedence, stale evidence, distinct questions/approvals, diagnostic
  rejection, provider matching, and PTY independence.

### Known limitations

- PC-060 defines and consumes the contract only. It does not start, attach to,
  detect, or ingest Claude Code hooks/status or Codex App Server events.
- No provider CLI version is declared supported yet. PC-061 and PC-062 must use
  current capability detection and explicit degradation because vendor
  protocols and hook availability are version-sensitive.
- Provider observations are disposable process-local projections. Pacium does
  not persist transcripts or raw provider events, and direct PTYs retain the
  existing local-server restart limitation.
- Questions and approvals are observation-only here; this contract grants no
  authority to answer, approve, prompt, steer, interrupt, or execute.
- Verification ran on Node.js 26.4.0 rather than pinned Node.js 24.18.x. The
  web build retains Vite's existing chunk-size warning.

## 0.33.0 — host directory-picker refresh — 2026-07-28

### Added

- A compact in-picker absolute host-path editor opened by the visible toolbar
  action or `Cmd/Ctrl+L`; Enter navigates without launching a terminal and
  Escape returns to breadcrumbs.
- `Cmd/Ctrl+Enter` current-folder confirmation, filter-to-result ArrowDown,
  result ArrowUp/ArrowDown/Home/End traversal, and authoritative post-navigation
  focus restoration.
- True server-owned default recovery when an initial typed path is missing or
  inaccessible, while Retry, known Home, recents, Back, and the parent
  absolute-path field remain available.
- Failure-safe version-1 browser-local recent reads and writes. Storage denial
  or quota failure cannot prevent opening the picker or returning the selected
  canonical path.
- Scrollable 200%-zoom terminal-launch presentation, explicit keyboard focus
  rings, light-theme picker surfaces, and retained compact desktop/320px
  hierarchy.

### Verified

- `pnpm verify` passed formatting, lint, every workspace type check, 114 test
  files and 705 tests, plus the 906.13 kB web JavaScript, 109.71 kB stylesheet,
  and 335.82 kB local-server production bundles.
- `pnpm test:e2e` passed all 14 Chromium workflows. The three new PC-078
  workflows cover invalid-first-path recovery, direct exact-path navigation,
  filtering, keyboard traversal, canonical selection without premature PTY
  launch, recent reuse, storage denial, focus return, 320 CSS px, 200% zoom,
  forced colors, and reduced motion.
- Before/after desktop and final 320px screenshots were inspected from the
  localhost application. Existing local and proxy-shaped Serve protected-read
  tests remained green.

### Known limitations

- The picker remains read-only and non-recursive. It does not create folders,
  clone repositories, index the filesystem, or persist server-side favorites.
- Recents are best-effort browser-local path references and are revalidated
  only when chosen. Filtering applies only to the server's bounded returned
  entries.
- The connected interactive browser was unavailable, so rendered automation
  used the repository's installed Playwright Chromium. Manual screen-reader
  review and the real Tailscale canary remain release gates.
- Verification ran on Node.js 26.4.0 rather than pinned Node.js 24.18.x. The
  web build retains Vite's existing chunk-size warning.

## 0.32.0 — optional Tailscale Serve access — 2026-07-28

### Added

- Optional all-or-nothing startup configuration for one canonical
  `https://*.ts.net` Serve Origin and a bounded exact operator-login allowlist,
  while the Pacium server remains bound only to `127.0.0.1`.
- A single request-authority classifier for local and proxied HTTP/WebSocket
  traffic with exact Host and Origin checks, strict
  `Tailscale-User-Login` handling, explicit Funnel denial, and the existing
  ephemeral-token requirement on protected transport.
- Protocol 18 connection evidence that exposes only Local or the accepted
  Tailscale login for the current socket, plus a compact accessible connection
  badge that clears stale identity when the connection is no longer live.
- Secure same-origin POST reads for remote bootstrap and directory browsing,
  exact configured `wss://` CSP support, and canonical loopback-only custom
  local Origins.
- An operator runbook covering loopback setup, grants, Serve activation,
  canary and denial checks, Funnel/public checks, revocation, rollback, and the
  evidence boundary.

### Verified

- `pnpm verify` passed formatting, lint, every workspace type check, 114 test
  files and 701 tests, plus the 903.24 kB web JavaScript, 107.74 kB stylesheet,
  and 335.82 kB local-server production bundles.
- `pnpm test:e2e` passed all 11 Chromium workflows, including persistent Local
  connection evidence, reconnect, narrow layout, forced colors, and reduced
  motion.
- Startup, HTTP, WebSocket, CSP, protocol, transport, reducer, semantic-render,
  and accessibility tests covered partial configuration, non-loopback direct
  access, malformed or duplicate identity, unlisted users, tagged-device
  missing identity, Funnel requests, local spoofing, exact remote authority,
  token enforcement, and stale-identity clearing.

### Known limitations

- Tests use proxy-shaped requests; they do not prove the owner's real
  Tailscale installation, MagicDNS/certificate state, deployed grants,
  revocation propagation, or the absence of alternate LAN, tailnet, Funnel,
  and public ingress. The manual runbook canary remains a release gate.
- Runtime environment changes require a server restart. Immediate ingress
  revocation should happen at Tailscale Serve or the tailnet policy layer so
  the local Pacium process and its PTYs can remain running.
- Verification ran on Node.js 26.4.0 rather than pinned Node.js 24.18.x. The
  web build retains Vite's existing chunk-size warning.

## 0.31.0 — worker and control context — 2026-07-27

### Added

- Protocol 17 `pacium.context.inspect` and correlated
  `pacium.context` messages with no browser-selected workspace, revision, path,
  queue identity, filter, count, session, command, or content authority.
- Independent 32 KiB objective and plan observations using stable no-follow
  regular-file reads, strict UTF-8, SHA-256 provenance, fixed safe failures,
  and a second accepted-config revision check.
- At most twelve newest validated immutable decision summaries with
  UTF-8-safe 320-byte answer previews, exact approval outcomes, latest durable
  transport evidence, and latest explicitly human-labelled lifecycle evidence.
  Notes, targets, queue text, terminal bytes, commands, and provider data stay
  excluded.
- A compact configured Worker group in accepted order. Exact session UUIDs
  project current process, command classification, repository, attention,
  freshness, and already-loaded selected-session change evidence; preset-only
  workers remain visibly not started and cannot launch from this surface.
- An explicit Control-context route in the existing right inspector with
  Open/Refresh/Back/Escape, focus restoration, inert objective/plan text,
  independent degraded states, recent decisions, config/disconnect/mode
  invalidation, and no terminal reselection.

### Verified

- `pnpm verify` passed formatting, lint, every workspace type check, 111 test
  files and 675 tests, plus the 901.71 kB web JavaScript, 107.52 kB stylesheet,
  and 328.37 kB local-server production bundles.
- `pnpm test:e2e` passed all 11 Chromium workflows. The PC-050 workflow covered
  exact live and preset-only worker rows, existing-PTY Open, explicit
  context/Refresh/Back/Escape, focus return, browser reconnect, mode exit,
  selected-terminal preservation, 320 CSS px, forced colors, and reduced
  motion.
- Authenticated integration tests proved byte-for-byte unchanged objective,
  plan, configuration, queue, and PTY evidence; exclusion of notes, target
  paths, and queue text; durable decision/transport/lifecycle reconstruction
  after local-server restart; and no inferred replacement for ended direct
  PTYs.

### Known limitations

- Provider-native events, task progress, usage, tool calls, completion, and
  causal links to later Git or terminal activity remain unavailable. Current
  process, transport, and human-labelled lifecycle facts are not promoted to
  those claims.
- Worker launch/reconfiguration, background Git fan-out, objective/plan
  editing or watching, generalized tasks/runs, and multi-item queue parsing
  remain out of scope.
- Verification ran on Node.js 26.4.0 rather than pinned Node.js 24.18.x. The
  web build retains Vite's existing chunk-size warning.

## 0.30.0 — explicit queue reconciliation — 2026-07-27

### Added

- Protocol 16 content-free source conflicts, exact-item reconciliation, and
  identity-only lifecycle-resolution requests with strict cross-reference and
  message bounds.
- Queue-state schema 3 with compatible schema-1/2 reads, immutable
  hash-verified human-labelled resolutions, monotonic lifecycle transitions,
  and at most two delivery attempts per decision.
- Source rewrite/degradation and exact-hash duplicate conflict evidence without
  exposing, choosing, or modifying queue text.
- On-demand no-follow answer-target inspection that distinguishes an exact
  transport artifact from unavailable provider acknowledgement and reports
  changed or unsafe targets as conflicts.
- Review/Cancel/Confirm controls for acknowledged, applied, unable-to-apply,
  confirmed-not-delivered, and superseded lifecycle labels, with immutable
  evidence reconstruction after reload or local-server restart.
- One separately confirmed retry after a failed or unknown first attempt is
  explicitly labelled not delivered. The exact decision, source,
  configuration, target, and payload are revalidated; a third attempt is
  invalid.

### Verified

- `pnpm verify` passed formatting, lint, every workspace type check, 104 test
  files and 623 tests, plus the 876.41 kB web JavaScript, 100.24 kB stylesheet,
  and 307.56 kB local-server production bundles.
- `pnpm test:e2e` passed all 10 Chromium workflows, including artifact versus
  acknowledgement evidence, lifecycle cancellation and confirmation, reload
  reconstruction, source-rewrite conflict, focus, 320 CSS px, forced colors,
  and reduced motion.
- Authenticated restart and PTY integration tests proved state reconstruction,
  exact target evidence, transition rejection, the locked retry gate, one
  human-unlocked successful retry, and rejection of a third attempt.

### Known limitations

- Provider-native acknowledgement remains unavailable. Current lifecycle
  records are visibly human-labelled and never inferred from files, terminal
  output, process activity, or queue rewrites.
- Duplicate detection is exact-content-hash only. A missing answer file is
  ambiguous, and target evidence is recomputed only on explicit inspection or
  Refresh.
- Worker/objective/plan context and recent-result summaries remain PC-050.
- Verification ran on Node.js 26.4.0 rather than pinned Node.js 24.18.x, and the
  web build retains Vite's existing chunk-size warning.

## 0.29.0 — explicit compatible decision delivery — 2026-07-27

### Added

- Protocol 15 identity-only `pacium.queue.decision.deliver` requests,
  correlated results, and decided-item delivery state. Strict schemas reject
  browser-selected paths, roles, sessions, payloads, terminal bytes, commands,
  actors, and retry flags.
- Queue-state schema 2 with compatible version-1 reads and first-mutation
  migration, immutable target/payload snapshots, intent-before-effect
  ordering, one attempt per decision, duplicate joining, hashed outcomes, and
  restart-safe unknown state for unfinished intent.
- A deterministic versioned answer document published as a private mode-`0600`
  regular file through same-directory no-clobber creation. Existing files,
  symlinks, unsafe parents, and uncertain post-publish durability are preserved
  and reported without fallback targets.
- A role-prompt adapter that resolves only the accepted live Meta or
  Orchestrator session ID/epoch and sends one bounded JSON-escaped,
  comment-prefixed line plus one carriage return. Success means terminal
  transport accepted the bytes; provider handling remains unverified.
- A compact decided-item Delivery section with accepted-target preview,
  explicit Review/Cancel/Confirm, pending and durable states, no action for
  unconfigured or unavailable targets, and distinct delivered, failed, and
  unknown evidence. Recording a decision still never delivers automatically.
- Browser and authenticated-server coverage for Cancel without side effect,
  private answer-file creation, reload recovery, duplicate no-op, exact role
  PTY isolation, hostile multiline/metacharacter escaping, and unchanged queue,
  configuration, unrelated PTY, and approval boundaries.

### Verified

- `pnpm verify` passed formatting, lint, every workspace type check, 97 test
  files and 584 tests, plus the 850.51 kB web JavaScript, 97.09 kB stylesheet,
  and 263.56 kB local-server production bundles.
- `pnpm test:e2e` passed all 10 Chromium workflows on the exact head, including
  explicit delivery review, cancellation, confirmation, durable evidence,
  reload, narrow layout, forced colors, and reduced motion.
- Contract, migration/store, serializer, file adapter, service, authenticated
  WebSocket, reducer, semantic-rendering, and real SessionManager/FakePty
  integration tests passed. Exact role evidence proves one line reaches only
  the configured live PTY.

### Known limitations

- Delivery evidence is not acknowledgement or applied/unable-to-apply state.
  There is no conflict-resolution or retry workflow; failed and unknown
  attempts remain terminal until PC-049 adds an explicit resolution model.
- The no-clobber answer-file method is a single-slot compatibility mailbox.
  Appending or rewriting another legacy format requires a separately typed
  adapter rather than inference from existing content.
- Recent decision/delivery activity and compact resulting-work summaries remain
  PC-050. Provider-native receipt, processing, approval execution, and
  completion evidence remain later enrichment.
- Verification ran on Node.js 26.4.0 rather than pinned Node.js 24.18.x.
  Chromium required the approved outside-sandbox macOS run with the Xcode Git
  path.
- The web bundle remains above Vite's 500 kB warning threshold.

## 0.28.0 — immutable local queue decisions — 2026-07-27

### Added

- Protocol-14 separate `pacium.queue.question.answer` and
  `pacium.queue.approval.decide` requests plus correlated
  `pacium.queue.decision` results. Strict schemas bind every request to the
  exact current workspace/source/observation/hash/item identity and reject
  browser-supplied actor, timestamp, decision ID/hash, path, command, delivery,
  or authority fields.
- Server-owned attribution, time, UUID, and canonical SHA-256 hashing for
  immutable question-answer and approval-outcome records with bounded UTF-8
  answer and optional-note content.
- A private schema-version-1 `queue-state.json` with 4 MiB and 4,096-record
  ceilings, strict ownership/mode/type/schema/uniqueness/hash validation,
  serialized same-directory atomic replacement, identical-replay recovery,
  competing-decision rejection, and explicit unknown-durability handling.
- Exact source and classification revalidation immediately before persistence;
  rewrite, config drift, type confusion, unsafe state, or disconnect fails
  closed without changing queue files, delivery targets, terminals, Git state,
  providers, or `pacium.json`.
- A bounded question answer form and optional note plus distinct Approve/Deny
  controls with inline second confirmation. Success replaces controls with the
  complete immutable local record and an explicit “Not delivered yet” label.
- Reload and local-server reconstruction recover the same exact decision.
  Missing state creates nothing until the first valid append; invalid state is
  preserved rather than repaired or overwritten.
- Chromium coverage for question/approval separation, Escape ownership in an
  answer field, approval cancellation and confirmation, reload recovery,
  rewrite staleness, source/config/terminal preservation, 320 CSS px, forced
  colors, and reduced motion.

### Verified

- `pnpm verify` passed formatting, lint, all workspace type checks, 91 test
  files and 546 tests, plus the 834.31 kB web and 227.62 kB local-server
  production bundles.
- `pnpm test:e2e` passed all ten Chromium workflows in one run with the required
  Xcode Git path.
- Contract tests prove separate request shapes, UTF-8 byte bounds, forbidden
  authority fields, strict decision-state/result unions, canonical hashes, and
  protocol 14.
- Store, service, and authenticated WebSocket tests prove private atomic state,
  restart reconstruction, exact source/type revalidation, replay idempotency,
  competing-decision rejection, concurrency, injected write/durability
  failures, and unchanged source/config/delivery-target/live-PTY evidence.

### Known limitations

- Decisions remain local records only. There is no compatible delivery,
  acknowledgement, applied state, provider callback, terminal input, automatic
  retry, supersession, or conflict-resolution workflow. PC-048 is next.
- One complete stable source remains at most one item; multi-item parsing,
  semantic fields, cross-source deduplication, and durable delivery provenance
  remain later work.
- The actor is the fixed server-owned `Local operator` label, not a remote-user
  identity. Tailscale Serve identity attribution requires its later
  transport-aware security slice.
- Verification ran on Node.js 26.4.0 rather than pinned Node.js 24.18.x.
  Chromium required the approved outside-sandbox macOS run.
- The web bundle remains above Vite's 500 kB warning threshold.

## 0.27.0 — read-only queue list and exact item inspector — 2026-07-27

### Added

- Protocol-13 process-local candidate-first-seen evidence plus strict
  `pacium.queue.item.inspect` and correlated `pacium.queue.item` messages bound
  to workspace revision, source ID, observation revision, content hash, and
  deterministic item ID.
- An exact-current local observer lookup that returns only already bounded
  accepted source text, reports fixed stale/unavailable states, and accepts no
  browser path, command, content, decision, or authority field.
- Bounded UTF-8 base64 transport so a maximum 64 KiB control-heavy source stays
  inside the existing 128 KiB application-message limit without JSON escape
  expansion.
- A compact content-free Queue list with native button keyboard behavior,
  type/source/requesting-role/confidence labels, honest current-server-run
  waiting evidence, disconnected disabling, and compact Q/A/F/R/? rail glyphs.
- A queue-specific right-panel inspector with inert exact original text,
  source/config/classification provenance, explicit unavailable semantic
  fields, no answer/approval controls, and exact live requesting-session
  context where configured.
- Correlated ephemeral browser state that rejects late or mismatched responses
  and clears accepted text on source rewrite/degradation, config drift,
  disconnect, General-mode exit, reload, or Back.
- Back/Escape focus restoration to the originating current queue row while
  preserving the selected PTY, terminal tabs/splits, process lifecycle, and
  previous session-inspector tab.
- Real-file Chromium coverage for question inspection, rewrite invalidation,
  explicit approval inspection without authority, source/terminal
  preservation, keyboard focus, 320 CSS px, 200% zoom, forced colors, and
  reduced motion.

### Verified

- `pnpm verify` passed formatting, lint, all workspace type checks, 86 test
  files and 512 tests, plus the 819.07 kB web and 201.10 kB local-server
  production bundles.
- `pnpm test:e2e` passed all ten Chromium workflows in one run.
- Strict contract tests prove ready/stale/unavailable invariants, fixed safe
  diagnostics, exact identity, forbidden path/content/command/decision extras,
  base64 bounds, protocol 13, and content-free bulk observations.
- Observer and authenticated WebSocket integration tests prove exact current
  text, maximum-message bounds, rewrite staleness, unavailable state, source/
  config preservation, and no original text in bulk messages.
- Browser reducer and semantic tests prove request correlation, fatal UTF-8
  decoding, identity/config drift clearing, hostile HTML/link/ANSI treatment,
  no raw text in list labels, unavailable-field honesty, and no decision
  controls.
- The real browser retained the selected live PTY while opening a question,
  returned focus with Escape, removed stale text after rewrite, opened the new
  explicit approval, and kept both source content and terminal selection
  unchanged.

### Known limitations

- One complete stable source is still at most one item. There is no supported
  multi-item grammar, priority/blocking inference, cross-source deduplication,
  unread state, or durable age/provenance.
- Reason, consequence, recommendation, related evidence, and conflict state
  are labelled unavailable rather than inferred from unstructured text.
- There are no immutable local decisions, notes, answer/deny/approve controls,
  delivery, acknowledgement, application evidence, supersession, or conflict
  resolution. PC-047 is next.
- Inspected original text and first-seen evidence are process/browser
  ephemeral. Refresh or server restart requires a deliberate new inspection.
- Verification ran on Node.js 26.4.0 rather than pinned Node.js 24.18.x.
  Chromium required the approved outside-sandbox macOS run.
- The web bundle remains above Vite's 500 kB warning threshold.

## 0.26.0 — conservative queue-item classification — 2026-07-27

### Added

- Protocol-12 stable-only whole-source classification metadata with strict
  candidate/none invariants, deterministic 64-character item identities, fixed
  diagnostics, bounded confidence, and no content or authority fields.
- A synchronous bounded `whole_source_v1` classifier that treats one complete
  nonblank source as at most one question, concrete approval, failure, review,
  or unknown candidate.
- Confirmed exact Markdown markers, high-confidence supported legacy markers,
  a medium-confidence final-question-mark heuristic that can identify only a
  question, and low-confidence unknown fallback for every other document.
- Strict approval separation: only `# Approval request: <action>` or
  `Approval request: <action>` can classify approval. Missing actions,
  conversational permission words, multiple markers, and C0/C1-bearing actions
  remain unknown or question evidence.
- Source/hash-bound deterministic identity, changed-hash replacement,
  unchanged-hash classification reuse, stale-generation rejection, and
  classification clearing on empty or degraded source evidence.
- Compact content-free type, confidence, and fixed diagnostic metadata in the
  existing Pacium source row, with escaped hostile text and no answer or
  approval controls.
- A real-file browser workflow covering question-to-explicit-approval rewrite,
  raw-text absence, terminal/source preservation, General-mode hiding, 320 CSS
  px layout, forced colors, reduced motion, and keyboard focus.

### Verified

- `pnpm verify` passed formatting, lint, all workspace type checks, 83 test
  files and 491 tests, plus the 805.10 kB web and 194.80 kB local-server
  production bundles.
- `pnpm test:e2e` passed all ten Chromium workflows in one run.
- Thirty classifier fixtures cover supported markers, identity, confidence,
  blank/BOM/Unicode input, malformed and multiple markers, conversational
  permission text, HTML, links, commands, terminal controls, and unknown
  fallback.
- Contract, observer, authenticated integration, projection, and semantic tests
  prove stable-only metadata, approval confidence, fixed safe diagnostics,
  unchanged reuse, degraded clearing, content-free publication, exact
  config/source joining, hostile rendering, and queue/config preservation.
- The browser proved “Can you approve everything?” remains a question and only
  an exact `Approval request: ...` rewrite becomes approval, without changing
  the selected real PTY.

### Known limitations

- One complete source document is at most one candidate. Blank-line, Markdown,
  checkbox, or arbitrary section structure is not treated as a multi-item
  grammar; multiple supported top-level markers become unknown.
- Classification sends no original text, title, excerpt, parsed action,
  options, recommendation, risk, requesting session, or waiting time. PC-046
  still owns the queue list and safe original-text inspector.
- Candidate/classification state is ephemeral and reconstructable. No durable
  import provenance, cross-source deduplication, decisions, answer/approval
  actions, delivery, acknowledgement, supersession, or conflict handling exists.
- Classification grants no authority and never executes, renders, sends, or
  writes queue content.
- Verification ran on Node.js 26.4.0 rather than pinned Node.js 24.18.x.
  Chromium required the approved outside-sandbox macOS run.
- The web bundle remains above Vite's 500 kB warning threshold.

## 0.25.0 — bounded queue-file observation — 2026-07-27

### Added

- Protocol-11 content-free queue observation requests, correlated snapshots,
  and pushed complete source updates joined to exact accepted workspace
  revisions and source IDs.
- A local queue observer limited to accepted configured paths, with grouped
  canonical-parent watchers, 200 ms debounce, bounded retry, configuration
  generation guards, semantic update deduplication, and shutdown disposal.
- No-follow stable reads with pre/open/post identity checks, a 64 KiB limit,
  strict UTF-8 decoding, distinct empty/missing/changing/oversized/invalid/
  unsafe/read/watch states, and SHA-256 only for complete stable bytes.
- Bounded original queue text retained only in local-server memory behind an
  exact config-revision/source-ID API; protocol, browser, logs, durable state,
  terminal input, and generic errors receive no queue text.
- A compact Pacium-only Queue sources region with accepted labels/requesting
  roles, honest source status, bytes, hash prefix, freshness, disconnected
  evidence, and explicit Refresh. General mode and the terminal workspace stay
  unchanged.
- Disposable real-file browser fixtures, source/config byte-preservation
  integration proof, hostile-file and identity-drift tests, responsive semantic
  coverage, and cross-workflow terminal cleanup.

### Verified

- `pnpm verify` passed formatting, lint, all workspace type checks, 81 test
  files and 451 tests, plus the 801.90 kB web and 185.93 kB local-server
  production bundles.
- `pnpm test:e2e` passed all ten Chromium workflows in one run.
- The queue browser workflow observed a real disposable source, withheld its
  private text, refreshed changed byte/hash evidence, preserved the selected
  real PTY, hid the source region in General mode, and left later terminal,
  repository, mode, and verification workflows isolated.
- Unit and integration coverage proves strict contracts, bounded reads, empty
  and degraded states, no-follow identity checks, watcher debounce/failure,
  revision deduplication, stale-generation rejection, reconnect/startup order,
  shutdown disposal, content-free messages, and byte-for-byte source/config
  preservation.
- Accessibility coverage keeps the labelled region and Refresh usable at 320
  CSS px, 200% zoom, forced colors, and reduced motion.

### Known limitations

- This is source-health evidence, not a queue item model. PC-045 and PC-046
  still own item boundaries, parse diagnostics, classification, source excerpts
  or inspector presentation, confidence, and queue navigation.
- Observation state, original text, and process-local revisions are ephemeral.
  No durable import provenance, queue decision state, answer, approval,
  delivery, acknowledgement, or conflict handling exists.
- Explicit Refresh performs a direct current read when watcher capability is
  degraded. Pacium never claims a file is being continuously observed after a
  watcher failure.
- Queue text remains untrusted and is never executed, rendered, delivered, or
  written by this slice.
- Verification ran on Node.js 26.4.0 rather than pinned Node.js 24.18.x. The
  successful browser gate required an approved outside-sandbox run because
  managed macOS Chromium could not register its Mach port.
- The web bundle remains above Vite's 500 kB warning threshold.

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
