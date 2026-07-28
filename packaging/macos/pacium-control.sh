#!/bin/sh
set -eu

fail() {
  printf '%s\n' "Pacium Control could not start: $1" >&2
  exit 1
}

contents_directory=$(CDPATH= cd "$(dirname "$0")/.." && pwd -P)
package_entry="$contents_directory/Resources/app/apps/local-server/dist/package-launcher.js"

[ -f "$package_entry" ] || fail "the installed application is incomplete."

if [ -n "${PACIUM_NODE_BINARY:-}" ]; then
  case "$PACIUM_NODE_BINARY" in
    /*) node_binary=$PACIUM_NODE_BINARY ;;
    *) fail "PACIUM_NODE_BINARY must be one absolute executable path." ;;
  esac
  [ -f "$node_binary" ] && [ -x "$node_binary" ] ||
    fail "PACIUM_NODE_BINARY is not an executable file."
else
  node_binary=
  for candidate in \
    /opt/homebrew/bin/node \
    /usr/local/bin/node \
    /usr/bin/node
  do
    if [ -f "$candidate" ] && [ -x "$candidate" ]; then
      node_binary=$candidate
      break
    fi
  done
  [ -n "$node_binary" ] ||
    fail "Node.js 24.18.x was not found. Install it or set PACIUM_NODE_BINARY."
fi

case "${HOME:-}" in
  /*) ;;
  *) fail "HOME must be one absolute directory." ;;
esac
[ -d "$HOME" ] || fail "HOME is not an existing directory."

if [ -z "${PACIUM_DEFAULT_CWD:-}" ]; then
  PACIUM_DEFAULT_CWD=$HOME
  export PACIUM_DEFAULT_CWD
fi

PATH="$HOME/.local/bin:$HOME/.npm-global/bin:$HOME/.bun/bin:$HOME/.local/share/pnpm:/opt/homebrew/bin:/usr/local/bin:$PATH"
export PATH

exec "$node_binary" "$package_entry" "$@"
