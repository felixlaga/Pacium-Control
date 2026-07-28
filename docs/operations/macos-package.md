# macOS development package

PC-074 produces the first installable Pacium Control artifact. It is a
user-local Apple-silicon development package, not a signed release.

## Supported boundary

- Apple-silicon macOS 14 or newer.
- Node.js 24.18.x supplied by the operator. Node is not bundled.
- The app and server run as the invoking user and bind only to `127.0.0.1`.
- The archive is unsigned and unnotarized. Developer ID signing, notarization,
  and clean-account owner acceptance remain PC-076 gates.
- Provider CLIs, Git, tmux, and Tailscale remain external optional tools.

## Build and verify

Use the pinned Node.js 24.18.x and pnpm 11.17.0 toolchain:

```sh
pnpm package:macos
pnpm package:macos:verify
```

The first command builds the production web and server bundles, validates the
arm64 source-built PTY helper, and writes:

```text
dist/macos/pacium-control-0.0.0-darwin-arm64.tar.gz
dist/macos/pacium-control-0.0.0-darwin-arm64.tar.gz.sha256
```

The verifier rebuilds the archive and requires the same hash, validates every
manifested file, checks the unsigned status, runs a real packaged PTY, performs
an isolated install and upgrade, starts the installed production server,
checks health and browser assets, proves exact-instance reuse, refuses active
uninstall, and then verifies state-preserving uninstall.

The package contains production code/assets and the minimal patched
`node-pty` runtime only. Its version-1 manifest uses relative paths, sizes,
modes, and hashes; it contains no checkout, home, temporary, credential,
terminal, repository, queue, provider, or host identity.

## Install and launch

Extract the archive, review `INSTALL.md`, and run:

```sh
./install.sh
```

The default destinations are `~/Applications/Pacium Control.app` and the exact
owned link `~/.local/bin/pacium`. The installer requests no elevated
privileges. Both parent directories can be overridden with absolute paths for
an isolated user-owned install:

```sh
PACIUM_APPLICATIONS_DIR=/absolute/apps \
PACIUM_BIN_DIR=/absolute/bin \
./install.sh
```

Launch from Finder or run:

```sh
pacium
```

The launcher accepts only `--help`, `--version`, and `--no-open`. It selects
one absolute `PACIUM_NODE_BINARY` or a fixed common Node location, enforces
Node.js 24.18.x, and opens only the fixed loopback URL after the server
listens. If the configured port already exposes the exact Pacium health body
and protocol header, the launcher reuses that instance.

## Upgrade and rollback

Running `install.sh` again fully stages the new recognized bundle beside the
installed app, moves the prior app to a private sibling backup, installs the
staged app, replaces only the exact owned command link, and then removes the
backup. Failure before completion restores the prior bundle.

To roll back, run `install.sh` from an earlier archive. State schemas are not
changed by PC-074, and package operations never own the data directory.

## Stop and uninstall

Run the server in the foreground with `pacium --no-open` when diagnosing
startup. Stop it with Ctrl-C. The package maintains one mode-0600 ephemeral
process lease under `/tmp`; the uninstaller refuses while that exact installed
package process remains alive.

Then run:

```sh
./uninstall.sh
```

Uninstall validates the bundle identifier and exact command link before
removing either. It refuses foreign files, bundles, links, and symlinked app
targets. An absent package is a bounded no-op.

Upgrade and uninstall preserve Pacium metadata, repositories, provider-owned
credentials, queue files, and external tmux targets.

## Failure recovery

- Missing Node: install Node.js 24.18.x or set `PACIUM_NODE_BINARY` to one
  absolute executable.
- Occupied foreign port: stop the foreign listener or select another bounded
  `PACIUM_PORT`.
- Browser-open failure: the server and PTYs remain alive; open the printed
  loopback URL manually.
- Unsafe/foreign install target: choose empty user-owned destinations or
  restore the expected exact Pacium target.
- Gatekeeper refusal: use a local build for development. Do not bypass
  quarantine for a release claim; signing and notarization remain required.
