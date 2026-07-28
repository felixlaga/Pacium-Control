#!/bin/sh
set -eu

fail() {
  printf '%s\n' "Pacium Control uninstall failed: $1" >&2
  exit 1
}

validate_destination() {
  value=$1
  label=$2
  case "$value" in
    /*) ;;
    *) fail "$label must be an absolute path." ;;
  esac
  [ "$value" != "/" ] || fail "$label cannot be the filesystem root."
  if printf '%s' "$value" | LC_ALL=C /usr/bin/grep -q '[[:cntrl:]]'; then
    fail "$label cannot contain control characters."
  fi
}

recognized_package() {
  marker=$1/PACKAGE_ID
  [ -f "$marker" ] &&
    [ "$(/usr/bin/sed -n '1p' "$marker")" = "com.pacium.control" ] &&
    [ "$(/usr/bin/sed -n '2p' "$marker")" = "schema=1" ] &&
    [ "$(/usr/bin/sed -n '3p' "$marker")" = "platform=linux" ] &&
    [ "$(/usr/bin/sed -n '4p' "$marker")" = "architecture=x64" ] &&
    [ "$(/usr/bin/wc -l <"$marker" | /usr/bin/tr -d ' ')" = "4" ]
}

if [ -n "${PACIUM_INSTALL_DIR:-}" ]; then
  target_package=$PACIUM_INSTALL_DIR
else
  data_home=${XDG_DATA_HOME:-"${HOME:?HOME is required}/.local/share"}
  target_package="$data_home/pacium-control"
fi
bin_directory=${PACIUM_BIN_DIR:-"${HOME:?HOME is required}/.local/bin"}
validate_destination "$target_package" "PACIUM_INSTALL_DIR"
validate_destination "$bin_directory" "PACIUM_BIN_DIR"
case "$target_package" in
  */pacium-control) ;;
  *) fail "PACIUM_INSTALL_DIR must end with /pacium-control." ;;
esac

target_parent=$(/usr/bin/dirname "$target_package")
if [ -d "$target_parent" ]; then
  target_parent=$(CDPATH= cd "$target_parent" && pwd -P)
fi
if [ -d "$bin_directory" ]; then
  bin_directory=$(CDPATH= cd "$bin_directory" && pwd -P)
fi
target_package="$target_parent/pacium-control"

owned_executable="$target_package/bin/pacium"
package_entry="$target_package/app/apps/local-server/dist/package-launcher.js"
command_link="$bin_directory/pacium"
process_lock="/tmp/com.pacium.control.$(/usr/bin/id -u).lock"

if [ -L "$target_package" ]; then
  fail "the application destination is a symlink."
elif [ -e "$target_package" ]; then
  [ -d "$target_package" ] && recognized_package "$target_package" ||
    fail "the application destination is not an owned Pacium package."
fi

if [ -L "$command_link" ]; then
  [ "$(/usr/bin/readlink "$command_link")" = "$owned_executable" ] ||
    fail "the pacium command is a foreign link."
elif [ -e "$command_link" ]; then
  fail "the pacium command destination is a foreign file."
fi

if [ -L "$process_lock" ]; then
  fail "the package process lease is a symlink."
elif [ -f "$process_lock" ]; then
  lock_pid=$(/usr/bin/sed -n '1p' "$process_lock")
  lock_entry=$(/usr/bin/sed -n '2p' "$process_lock")
  if [ "$lock_entry" = "$package_entry" ]; then
    case "$lock_pid" in
      '' | *[!0-9]*) fail "the package process lease is malformed." ;;
    esac
    if /bin/kill -0 "$lock_pid" 2>/dev/null; then
      fail "Pacium Control is running. Stop its foreground server first."
    fi
    /bin/rm -f "$process_lock"
  fi
fi

removed_package=0
removed_link=0
if [ -d "$target_package" ]; then
  /bin/rm -rf "$target_package"
  removed_package=1
fi
if [ -L "$command_link" ]; then
  /bin/rm -f "$command_link"
  removed_link=1
fi

if [ "$removed_package" -eq 0 ] && [ "$removed_link" -eq 0 ]; then
  printf '%s\n' "Pacium Control was not installed at the selected destinations."
else
  printf '%s\n' "Removed the Pacium Control package and owned command link."
fi
printf '%s\n' "Application state and external workspaces were not modified."
