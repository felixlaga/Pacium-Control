# ADR-0017: Support Apple-silicon macOS and Ubuntu 24.04 x64

- Status: Accepted
- Date: 2026-07-28
- Owner approval: Explicit product direction in the 2026-07-28 implementation session
- Builds on: [ADR-0013](ADR-0013-local-pty-runtime.md),
  [ADR-0014](ADR-0014-localhost-single-process.md), and
  [ADR-0015](ADR-0015-minimal-local-state.md)

## Context

Pacium needs a narrow, reproducible host contract for its direct PTY,
production-browser, and user-local packaging behavior. macOS on Apple silicon
is the first supported host. The roadmap also requires one evidence-backed
Linux path, but “Linux” spans incompatible distributions, architectures,
package systems, shells, and native build environments.

The application remains a foreground localhost process and depends on a native
`node-pty` build. A broad distribution claim, bundled operating-system runtime,
or root-installed service would widen the product and security boundary
without helping the personal terminal workflow.

## Decision

Pacium supports exactly these initial host targets:

- macOS on Apple silicon;
- Ubuntu 24.04 LTS on x86-64.

Both targets require external Node.js 24.18.x. Development packages are
platform-specific, unsigned artifacts:

- `darwin-arm64` includes a valid user-local application bundle and command;
- `linux-x64` includes a user-local application tree, command, installer, and
  uninstaller in a tar archive.

The Linux target uses `/bin/bash` as its fallback shell and
`${XDG_STATE_HOME:-~/.local/state}/pacium-control` as its default
application-owned state directory. macOS retains `/bin/zsh` and
`~/Library/Application Support/Pacium Control`.

The following are not implied by this decision:

- another Linux distribution or version;
- Linux arm64, Windows, WSL, ChromeOS, BSD, or container support;
- `.deb`, RPM, AppImage, Flatpak, Snap, Homebrew, systemd, autostart, or
  root/global installation;
- bundled Node.js, browser, Git, shell, provider CLI, tmux, or Tailscale;
- signing, notarization, public distribution, or release readiness.

## Consequences

### Positive

- Native PTY and browser behavior have two exact testable host contracts.
- Linux compatibility is evidence-backed without promising an unbounded
  distribution matrix.
- Both packages preserve the loopback, direct-PTY, external-runtime, and
  user-owned state boundaries.
- User-local installation needs no privilege escalation or service manager.

### Negative

- Operators must install the exact supported Node runtime and platform tools.
- Every additional operating-system, architecture, or distribution target
  requires a new decision and its own native, package, and browser evidence.
- The development artifacts are unsuitable for public distribution until the
  separate release gate accepts their signing and delivery posture.

## Security requirements

- Package launchers must fail closed on the wrong platform, architecture, or
  Node version.
- Install and uninstall must operate only on exact recognized absolute
  user-owned destinations, refuse active or foreign targets, and preserve
  application state and external resources.
- Packages must contain fixed production inputs only and no credentials,
  environment dump, terminal content, repository content, queue content, or
  host identity.
- The packaged server must keep the existing `127.0.0.1`, Origin, token, and
  optional Tailscale Serve boundaries.
- Platform browser actions may invoke only the fixed system opener with the
  fixed loopback URL.

## Validation

- Build the native PTY from the frozen source dependency on each exact target.
- Pass the full repository verification and bounded lifecycle soak.
- Validate manifest, checksum, modes, native PTY operation, production
  health/assets, install/upgrade, exact-instance reuse, active-uninstall
  refusal, foreign-target denial, and state-preserving removal.
- Pass the complete applicable Chromium workflow suite on each target.
- Record exact runner/runtime/package scalar evidence before changing a support
  claim.

## Rollback

Remove the target from the supported-platform documentation and package
workflow, while preserving source portability where practical. Existing
application state requires no migration because package code and state remain
separate.
