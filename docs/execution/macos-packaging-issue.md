# PC-074: Package the macOS application

## Problem

Pacium’s production web and local-server bundles work only from the repository.
There is no installable macOS application, `pacium` command, fixed browser-open
flow, upgrade boundary, or safe uninstall path. An operator cannot exercise the
current local product from a clean application directory, and the project
cannot yet distinguish a locally usable package from a signed release.

## Outcome

Produce one versioned Apple-silicon macOS archive containing a lightweight
`Pacium Control.app`, installer, and uninstaller. The installed app uses an
explicit supported Node.js 24.18.x runtime, serves the committed production
assets from `127.0.0.1`, opens the fixed local URL, loads the patched
source-built `node-pty`, and exposes `pacium` through a safe exact symlink.
Reinstalling replaces only the application, while uninstalling removes only
the application and owned command link. Configuration, queue state, relaunch
manifests, repositories, provider credentials, and optional tmux targets
survive both operations.

The artifact is explicitly an unsigned, unnotarized local-development package.
A public release requires Developer ID signing and notarization evidence under
PC-076.

## Scope

- Add a deterministic macOS Apple-silicon application-bundle layout and
  compressed archive command.
- Package the production server/web output and only the runtime files required
  from the patched source-built `node-pty`.
- Add a fixed application launcher that finds or accepts one absolute Node.js
  24.18.x executable, sets a home default cwd, augments common local CLI paths,
  and never widens the server bind.
- Add a bounded package launcher with help/version/no-open behavior and
  existing-instance detection.
- Open the fixed loopback URL only after the server listens; browser-open
  failure must leave the server alive and report a bounded error.
- Add exact install/upgrade/uninstall scripts with sibling staging, rollback,
  ownership checks, and preservation of application-owned state.
- Emit a content manifest and SHA-256 checksum without secrets or machine
  paths.
- Add package layout, native PTY, install/upgrade, server/static-asset,
  uninstall-preservation, and malformed-environment tests.
- Document prerequisites, install, launch, upgrade, rollback, uninstall,
  failure recovery, and signing/notarization status.

## Non-scope

- Bundling or redistributing Node.js, provider CLIs, Git, tmux, Tailscale, or
  shell executables.
- Developer ID signing, notarization, App Store distribution, auto-update,
  privileged installation, LaunchAgent/background startup, or a GUI process
  manager.
- Linux validation or packaging; that is PC-075.
- Release-readiness, public distribution, daily-use acceptance, or a fresh
  physical/virtual macOS account; those remain PC-076 evidence.
- Changing PTY/session, WebSocket, provider, queue, Git, diagnostics, or state
  contracts.
- Deleting Pacium state, repositories, credentials, queue files, or tmux
  targets during uninstall.

## Acceptance criteria

- [x] `pnpm package:macos` produces one `darwin-arm64` archive from supported
      Node.js 24.18.x and fails closed on another OS, architecture, runtime,
      missing production build, or missing source-built PTY helper.
- [x] The bundle has a valid fixed `Info.plist`, executable launcher,
      production server and browser assets, minimal patched `node-pty` runtime,
      install/uninstall guides, versioned manifest, and archive checksum.
- [x] The launcher accepts only the fixed help/version/no-open surface, ignores
      Finder’s process-serial argument, validates an explicit Node binary, uses
      a home default cwd, preserves operator configuration environment, and
      starts only the existing loopback server.
- [x] A first launch opens only `http://127.0.0.1:<configured-port>` after
      listen; a verified existing Pacium instance is reused instead of starting
      another owner; browser-open failure does not terminate PTYs.
- [x] The installed production package serves its web application and loads,
      spawns, exchanges Unicode data with, resizes, and closes one real PTY
      using the packaged native helper.
- [x] Install and upgrade use exact validated destinations, reject unsafe
      existing paths/foreign command links, stage before replacement, roll back
      a failed move, and never modify application data or repositories.
- [x] Uninstall removes only the exact Pacium application and owned `pacium`
      link, refuses a foreign bundle/link, and preserves data, repositories,
      provider credentials, and tmux state.
- [x] The manifest/checksum contain no checkout, home, temp, credential,
      environment, terminal, repository, queue, provider, or host identity.
- [x] Signing status is machine-checkable and honest: the development package
      is unsigned/unnotarized, while Developer ID signing plus notarization is a
      mandatory PC-076 release gate.
- [x] Supported-runtime full verification, package verification, and all
      Chromium workflows pass.

## User experience

The downloaded archive contains `Pacium Control.app`, `install.sh`,
`uninstall.sh`, and `INSTALL.md`. Running `install.sh` defaults to
`~/Applications` and `~/.local/bin`; both destinations can be overridden by
absolute environment paths for an isolated install. The `pacium` command or
Finder app validates Node, starts the local server, and opens the browser.

If the exact Pacium health signature already answers on the configured port,
launch opens that workspace and exits without creating a second server. Missing
or unsupported Node, an occupied port, unsafe install paths, and browser-open
failure produce bounded actionable errors. CLI `--no-open` keeps the server in
the foreground for diagnostics and automation.

Upgrade repeats `install.sh`: the next bundle is fully staged, the old bundle
is moved aside, and failure restores it. Uninstall states exactly what was
removed and explicitly names the preserved data directory.

## Architecture

- Systems and modules touched: local-server health/browser launcher, package
  entry, multi-entry production build, macOS bundle builder, install/uninstall
  scripts, package verifier, root scripts, tests, and operations docs.
- Systems of record: PTYs remain live-process truth; repositories/provider
  stores remain external truth; the existing data directory remains Pacium
  metadata truth. The application bundle owns only executable code/assets.
- State transitions: source build -> staged bundle -> archive -> installed ->
  upgraded or uninstalled. Application data is outside this transition graph.
- Protocol/schema impact: WebSocket protocol remains 24. Health adds a fixed
  response header for safe existing-instance recognition.
- Relevant ADRs: ADR-0013, ADR-0014, ADR-0015, ADR-0016.

## Security and privacy

- Authorization: packaging does not change HTTP/WebSocket authorization or
  optional Tailscale authority.
- Privilege: install defaults to user-owned directories, requests no sudo, and
  runs the server with the invoking user’s authority.
- Secrets/logging: the artifact builder copies fixed build/runtime files only;
  the manifest and checksum contain relative paths and hashes, not environment
  or runtime state.
- Abuse/failure scenario: exact bundle identity, absolute non-root destination
  checks, symlink refusal, owned-link validation, and rollback prevent a
  package operation from replacing or deleting a foreign target.

## Reliability

- Idempotency: reinstalling the same artifact produces the same installed
  layout; an existing verified server is reused; uninstalling an absent package
  is a bounded no-op.
- Timeouts/retries: existing-instance and package canaries use fixed deadlines;
  browser open has no hidden retry.
- Restart behavior: direct PTYs still end with the packaged server; opted-in
  tmux keep-alive restoration is unchanged.
- Unknown outcome: failed upgrade retains/restores the prior exact bundle;
  unsigned/notarization status is explicit rather than inferred.
- Migration/rollback: no state schema changes. Reinstall a prior archive to
  roll back code; state remains untouched.

## Test plan

- Unit: argument parsing, Node version/path validation, fixed URL, health
  signature, browser-open spawn contract, manifest rules, destination rules.
- Contract: unchanged protocol 24 and fixed health signature header.
- Integration: package construction, file modes/layout, minimal PTY runtime,
  install, same-version upgrade, production health/assets, uninstall, and
  preserved sentinel data.
- Browser: all current Chromium workflows against the unchanged production
  contracts; package browser opening is tested at its fixed process boundary.
- Failure/recovery: unsupported Node/OS/architecture, missing build/helper,
  occupied foreign port, unsafe/symlink/foreign install target, failed staged
  move, browser-open failure.
- Security: secret/path canary scan, exact owned deletion, no sudo, no state
  directory access, loopback-only health and server bind.

## Dependencies

- Blocked by: PC-073.
- Blocks: PC-075 and PC-076.

## Evidence required

- Focused launcher, builder, installer, uninstaller, manifest, health, and real
  packaged-PTY test outputs.
- Exact package archive name, byte size, SHA-256, file count, runtime/native
  architecture, and signing/notarization status.
- Supported Node.js 24.18.x full verification and complete Chromium count.
- Current status, backlog, milestone, risk, toolchain, operations, security,
  release checklist, and changelog synchronized.

## Open questions

- None. The first artifact is intentionally user-local, external-Node,
  Apple-silicon, unsigned, and unnotarized. Release signing is a later hard
  gate, not an implied capability.
