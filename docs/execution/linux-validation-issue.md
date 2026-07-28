# PC-075: Validate the supported Linux path

## Problem

Pacium’s current support claim stops at Apple-silicon macOS. Several runtime
paths still assume `/bin/zsh`, a macOS application-data directory, an arm64
`.app`, and `/usr/bin/open`. The repository has no Linux runner or package, and
this macOS host has no Linux VM/container runtime. Passing portable TypeScript
tests on Darwin would not prove that `node-pty`, process groups, browser
workflows, package lifecycle, or the production server work on Linux.

## Outcome

Declare and verify one narrow Linux target: Ubuntu 24.04 x64 with Node.js
24.18.x and pnpm 11.17.0. Pacium keeps the same loopback-only single-process
architecture and external-runtime model. A GitHub-hosted Ubuntu runner performs
a frozen source build of `node-pty`, full verification, the lifecycle soak,
all applicable Chromium workflows, and an isolated install/upgrade/native-PTY/
production-server/uninstall canary for one user-local Linux tar archive.

The Linux package is an unsigned development artifact, not a distro-native
installer or broad “works on Linux” claim. macOS remains the primary supported
platform and retains its complete existing gates.

## Scope

- Record Ubuntu 24.04 x64 as the first supported Linux target.
- Use `/bin/bash` as the Linux fallback shell and an XDG state directory
  (`$XDG_STATE_HOME/pacium-control` or `~/.local/state/pacium-control`).
- Preserve the operator’s bounded XDG environment values for terminal/provider
  child processes.
- Extend the fixed package runtime and browser opener to Linux x64 and
  `/usr/bin/xdg-open` without weakening macOS validation.
- Add a deterministic-content `linux-x64` tar archive with production
  server/browser assets, source-built native `node-pty`, manifest, checksum,
  no-sudo installer/uninstaller, and embedded runbook.
- Add an isolated Linux package verifier for manifest/mode/hash integrity,
  native PTY load/input/Unicode/resize/exit, install/upgrade, production
  health/assets, exact-instance reuse, active-uninstall refusal, and external
  state preservation.
- Add a least-privilege GitHub Actions job pinned to Ubuntu 24.04, Node 24.18.0,
  pnpm 11.17.0, and immutable action revisions.
- Run the frozen install with `node-pty` built from source, full verification,
  soak, package verification, and all applicable Chromium workflows.
- Keep macOS full/package/browser regression gates green.

## Non-scope

- Linux arm64, another distribution/version, WSL, ChromeOS, BSD, or Windows.
- `.deb`, RPM, AppImage, Flatpak, Snap, desktop menu integration, systemd,
  autostart, auto-update, root/global installation, or distro repositories.
- Bundling Node.js, a browser, provider CLIs, Git, tmux, Tailscale, or shells.
- Linux remote-host/multi-user operation or any non-loopback bind.
- Claiming every optional provider/tmux/Tailscale integration has completed a
  real Linux account canary.
- Developer signing, notarization, public release, or PC-076 owner acceptance.

## Acceptance criteria

- [x] The platform decision names only Ubuntu 24.04 x64 as supported Linux and
      explicitly denies broader distro/architecture claims.
- [x] Linux defaults use an existing absolute shell, an absolute dedicated XDG
      state directory, and bounded XDG child-environment inheritance; macOS
      defaults are unchanged.
- [x] Browser-open and package-runtime contracts accept exactly
      darwin-arm64 or linux-x64 with Node 24.18.x and select only the fixed
      platform opener/loopback URL.
- [x] `pnpm package:linux` fails closed outside linux-x64/Node 24.18.x or
      without production assets/source-built `pty.node`, and emits one archive
      plus checksum with no native macOS helper.
- [x] The Linux archive contains only a recognized fixed application tree,
      exact launcher, production assets, minimal source-built `node-pty`,
      versioned manifest, installer, uninstaller, and guide.
- [x] Linux install/upgrade/uninstall use exact absolute user-owned
      destinations, no sudo, sibling staging/rollback, exact link/manifest
      ownership, active-process refusal, foreign-target denial, and preserve
      state/repositories/provider data/queues/tmux.
- [x] The installed Linux artifact loads and drives a real packaged PTY and
      serves its production health endpoint and browser assets from loopback.
- [x] The Linux CI job uses frozen dependencies, source-built `node-pty`,
      supported versions, least repository permission, timeouts, and produces
      scalar/package evidence without secrets or terminal content.
- [x] Ubuntu full verification, soak, package verification, and applicable
      Chromium workflows pass on the pushed exact commit.
- [x] Supported macOS full verification, package verification, and all 20
      Chromium workflows remain green.

## User experience

The Linux archive contains `pacium-control/`, `install.sh`, `uninstall.sh`, and
`INSTALL.md`. `install.sh` defaults to
`~/.local/share/pacium-control` and `~/.local/bin/pacium`, asks for no elevated
privilege, and accepts absolute overrides for isolated installs.

Running `pacium` validates Node.js 24.18.x, starts or reuses only the exact
Pacium server on `127.0.0.1`, and invokes `/usr/bin/xdg-open` only after a new
server listens. `pacium --no-open` remains the foreground diagnostic path.
Missing `xdg-open` leaves the server and PTYs alive and prints the fixed URL.

## Architecture

- Systems and modules touched: platform config/defaults, browser/package
  launcher contracts, real-PTY/soak fixtures, Linux builder/lifecycle/verifier,
  CI, supported-platform docs, status/release evidence.
- Systems of record: unchanged. PTYs, Git, providers, queue files, external
  tmux, and versioned Pacium JSON remain authoritative in their existing
  boundaries.
- State transitions: source build -> Linux archive -> staged user-local install
  -> foreground process -> upgrade/uninstall. State is external and preserved.
- Protocol impact: none; protocol remains 24.
- Relevant ADRs: ADR-0013 through ADR-0017.

## Security and privacy

- Authorization/network: Host, Origin, token, optional Tailscale, and loopback
  binding are unchanged.
- Privilege: user-local install only; no `sudo`, setuid, service, socket
  activation, or shell-evaluated package input.
- Inputs: destination/runtime paths are bounded absolute paths; manifest and
  exact ownership are validated before replace/remove.
- Secrets/logging: CI and package manifests expose fixed scalar/file metadata
  only. No environment dump, access token, terminal bytes, repository content,
  queue content, provider data, or host identity becomes an artifact.

## Reliability

- The package is replaceable code; state is not migrated by PC-075.
- Exact health reuse and the existing ephemeral package lease prevent duplicate
  owners and active uninstall.
- Failed upgrade restores the prior recognized tree.
- Direct PTYs still end with the foreground local server; tmux remains optional
  and capability-labelled.
- A CI failure is evidence that Linux is unsupported at that commit, not a
  reason to weaken or skip the gate.

## Test plan

- Unit: platform/runtime/opener selection, Linux shell/state/XDG defaults,
  manifest paths and build target, unsafe destinations.
- Integration: source-built Linux native PTY, process exit/signals, Unicode,
  resize, FD cleanup, production server/static assets.
- Package: deterministic rebuild, file integrity/modes, install/upgrade,
  exact-instance reuse, active uninstall, foreign target, no-op uninstall,
  preserved sentinels.
- Browser: existing suite on Ubuntu Chromium; tmux tests remain conditional on
  an actual fixed local executable/socket.
- Regression: supported macOS verify/package/Chromium gates.

## Dependencies

- Blocked by: PC-074.
- Blocks: PC-076.

## Evidence required

- Exact Ubuntu runner image, Node/pnpm/native architecture and package hash.
- Full test counts, soak scalar output, package verification summary, and
  Chromium workflow count from the exact pushed commit.
- Matching macOS regression output.
- Status, backlog, milestone, platform, deployment, security, release, risk,
  operations, and changelog documentation synchronized.

## Open questions

- None. This slice intentionally chooses one hosted-runner-reproducible Ubuntu
  x64 target and keeps all other Linux variants unsupported.

## Completion evidence

- Accepted decision:
  [ADR-0017](../decisions/ADR-0017-supported-hosts-and-development-packages.md).
- Exact Linux implementation commit:
  `b261b0f6cfbfa5378008ea3cbf249dbfe7f514c4`.
- Warning-free hosted run: GitHub Actions run `30337769057`, Ubuntu 24.04.4
  x64, Node.js 24.18.0, pnpm 11.17.0, frozen source-native install, read-only
  repository permission, and immutable Node 24 action revisions.
- Linux full gate: 141 test files and 922 tests, production build, bounded soak,
  deterministic package verification, 18 applicable Chromium workflows with
  two tmux-capability workflows honestly skipped, and archive/checksum upload.
- Linux soak: 2,034 ms; 135,872,512-byte peak and retained RSS growth;
  5,230,168-byte retained live heap; 162,368-character snapshot; zero final
  sessions; `/dev/fd` 32 -> 32.
- Linux package: 584,044 bytes; SHA-256
  `b5da9fadf2db663123be8bc2a3d888d8a7d18520bb00bfbeb83b067e8fb5f7ca`;
  27 manifested files; packaged x64 ELF PTY, install/upgrade, production
  health/assets/reuse, active refusal, and state-preserving uninstall passed.
- Matching Apple-silicon regression: supported Node.js 24.18.0
  `pnpm verify` passed 141 test files and 922 tests;
  `pnpm package:macos:verify` passed with the 577,087-byte archive, SHA-256
  `51fe5527c272e44c5025270a3c829eed86fd35f639e4420159f712b3c2fb89dd`,
  and 28 manifested files; all 20 Chromium workflows passed.
- Documentation synchronized: status, backlog, milestone, host/platform,
  deployment, security, release, risk, operations, README, and changelog.
- Residual boundary: both packages remain development artifacts. PC-076 owns
  clean-account, signing/notarization, real-tailnet, manual
  accessibility/sustained-use, delivery, limitations, and owner acceptance.
