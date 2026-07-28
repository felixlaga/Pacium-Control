# Pacium Control for macOS

This archive is the unsigned, unnotarized Apple-silicon development package.
It is not a public release. macOS Gatekeeper may refuse a downloaded copy.
Developer ID signing and notarization remain mandatory release gates.

## Prerequisites

- Apple-silicon macOS 14 or newer;
- Node.js 24.18.x at `/opt/homebrew/bin/node`, `/usr/local/bin/node`, or an
  absolute executable selected with `PACIUM_NODE_BINARY`;
- Git and a shell for terminal work;
- provider CLIs, tmux, and Tailscale only when their optional features are
  used.

The archive does not contain Node.js, provider credentials, repositories,
terminal transcripts, Pacium state, or queue content.

## Install or upgrade

From the extracted archive:

```sh
./install.sh
```

This installs `Pacium Control.app` in `~/Applications` and creates
`~/.local/bin/pacium`. It never uses `sudo`. To perform an isolated install,
set both destinations to absolute user-owned directories:

```sh
PACIUM_APPLICATIONS_DIR=/absolute/apps \
PACIUM_BIN_DIR=/absolute/bin \
./install.sh
```

Running the installer again stages and replaces only the recognized
application bundle. Application data remains outside the bundle.

## Launch

Open `Pacium Control.app` in Finder or run:

```sh
pacium
```

The app serves only `http://127.0.0.1:4174` by default. Use
`pacium --no-open` to keep it in the foreground without opening a browser.
Stop that foreground server with Ctrl-C before uninstalling.

The supported command surface is:

```text
pacium [--no-open]
pacium --help
pacium --version
```

## Roll back

Run `install.sh` from an earlier archive. The installer replaces only the
recognized application code. Pacium metadata, queues, repositories, provider
credentials, and optional tmux sessions are not migrated or removed.

## Uninstall

Stop the foreground Pacium server, then run:

```sh
./uninstall.sh
```

The uninstaller removes only the recognized app and its exact owned command
link. It preserves `~/Library/Application Support/Pacium Control` and all
external repositories, queues, provider data, and tmux state.
