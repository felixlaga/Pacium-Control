# Ubuntu Linux development package

PC-075 produces a user-local Ubuntu 24.04 x64 development package. It is an
unsigned tar archive, not a distro-native or public release.

## Supported boundary

- Ubuntu 24.04 LTS on x86-64 only.
- Node.js 24.18.x supplied by the operator. Node is not bundled.
- `/bin/bash` is the fallback shell.
- The server runs as the invoking user and binds only to `127.0.0.1`.
- Provider CLIs, Git, tmux, Tailscale, and `/usr/bin/xdg-open` remain external
  optional tools.
- Other distributions, Linux arm64, Windows, WSL, ChromeOS, containers,
  systemd, and root/global installation are unsupported.

## Build and verify

The supported evidence path is the pinned Ubuntu workflow. On the exact
supported host with Node.js 24.18.x and pnpm 11.17.0:

```sh
pnpm package:linux
pnpm package:linux:verify
```

The builder requires a source-built x64 `node-pty` module plus complete
production server and browser assets. It writes:

```text
dist/linux/pacium-control-0.0.0-linux-x64.tar.gz
dist/linux/pacium-control-0.0.0-linux-x64.tar.gz.sha256
```

The verifier rebuilds deterministically and validates the archive, checksum,
manifest, file modes, native ELF module, packaged real PTY, install/upgrade,
production health and assets, exact-instance reuse, active-uninstall refusal,
foreign-target denial, idempotent removal, and external-state preservation.

The short-retention CI artifact contains only the archive and checksum. It does
not contain credentials, environments, terminal bytes, repositories, queue
content, provider data, application state, or host identity.

## Install and launch

Extract the archive, review its `INSTALL.md`, then run:

```sh
./install.sh
```

The default application destination is
`${XDG_DATA_HOME:-$HOME/.local/share}/pacium-control`; the exact owned command
link is `~/.local/bin/pacium`. The installer never uses `sudo`. Isolated
absolute user-owned destinations can be selected:

```sh
PACIUM_INSTALL_DIR=/absolute/pacium-control \
PACIUM_BIN_DIR=/absolute/bin \
./install.sh
```

Launch with:

```sh
pacium
```

The launcher accepts only `--help`, `--version`, and `--no-open`, enforces the
supported Node runtime, and opens only the fixed loopback URL through
`/usr/bin/xdg-open` after a new server listens. A missing or failed opener
leaves the server and PTYs alive and prints the URL. An existing instance is
reused only when the exact Pacium health signature matches.

## Upgrade, rollback, and uninstall

Running `install.sh` again stages the matching package beside the destination,
replaces only a recognized application tree and command link, and restores the
prior tree if replacement fails. Run an earlier matching archive installer to
roll back code.

Stop the foreground process with Ctrl-C before uninstalling:

```sh
./uninstall.sh
```

An ephemeral private process lease prevents removal while that exact installed
package is active. Uninstall refuses foreign trees or links and treats an
absent package as a bounded no-op. Package operations preserve Pacium state,
repositories, queue files, provider-owned credentials, and external tmux
targets.

## Failure recovery

- Wrong host/runtime: use Ubuntu 24.04 x64 and Node.js 24.18.x.
- Missing `/usr/bin/xdg-open`: open the printed loopback URL manually.
- Occupied foreign port: stop the foreign listener or select another bounded
  `PACIUM_PORT`.
- Active package: stop the exact foreground Pacium process, then uninstall.
- Unsafe or foreign destination: select an empty user-owned destination or
  restore the expected exact Pacium target.
- Failed Linux gate: do not claim the target is supported at that commit.
