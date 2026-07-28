# Pacium Control for Ubuntu Linux

This archive is the unsigned Ubuntu 24.04 x64 development package. It is not a
distro-native or public release and makes no claim for another Linux
distribution, version, architecture, WSL, or ChromeOS.

## Prerequisites

- Ubuntu 24.04 x64;
- Node.js 24.18.x at `/usr/local/bin/node`, `/usr/bin/node`, or an absolute
  executable selected with `PACIUM_NODE_BINARY`;
- `/bin/bash`;
- `/usr/bin/xdg-open` to open the browser automatically;
- Git and optional provider CLIs, tmux, or Tailscale only for their respective
  features.

The archive does not contain Node.js, credentials, repositories, terminal
transcripts, Pacium state, or queue content.

## Install or upgrade

From the extracted archive:

```sh
./install.sh
```

This installs the application in
`${XDG_DATA_HOME:-$HOME/.local/share}/pacium-control` and creates
`~/.local/bin/pacium`. It never uses `sudo`. Isolated absolute destinations
can be selected explicitly:

```sh
PACIUM_INSTALL_DIR=/absolute/pacium-control \
PACIUM_BIN_DIR=/absolute/bin \
./install.sh
```

Running the installer again stages and replaces only the recognized
application tree. State remains external.

## Launch

```sh
pacium
```

Pacium serves only `http://127.0.0.1:4174` by default. Use
`pacium --no-open` to retain the foreground process without starting
`xdg-open`. Stop it with Ctrl-C before uninstalling.

## Roll back and uninstall

Run `install.sh` from an earlier matching archive to roll back code. To remove
the current application:

```sh
./uninstall.sh
```

The uninstaller removes only the exact recognized package tree and owned
command link. It preserves XDG/Pacium state, repositories, queue files,
provider-owned credentials, and external tmux targets.
