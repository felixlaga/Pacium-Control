#!/bin/sh
set -eu

bundle_identifier=com.pacium.control

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

bundle_id() {
  /usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" \
    "$1/Contents/Info.plist" 2>/dev/null || true
}

applications_directory=${PACIUM_APPLICATIONS_DIR:-"${HOME:?HOME is required}/Applications"}
bin_directory=${PACIUM_BIN_DIR:-"${HOME:?HOME is required}/.local/bin"}
validate_destination "$applications_directory" "PACIUM_APPLICATIONS_DIR"
validate_destination "$bin_directory" "PACIUM_BIN_DIR"

if [ -d "$applications_directory" ]; then
  applications_directory=$(CDPATH= cd "$applications_directory" && pwd -P)
fi
if [ -d "$bin_directory" ]; then
  bin_directory=$(CDPATH= cd "$bin_directory" && pwd -P)
fi

target_app="$applications_directory/Pacium Control.app"
owned_executable="$target_app/Contents/MacOS/pacium-control"
package_entry="$target_app/Contents/Resources/app/apps/local-server/dist/package-launcher.js"
command_link="$bin_directory/pacium"
process_lock="/tmp/com.pacium.control.$(/usr/bin/id -u).lock"

if [ -L "$target_app" ]; then
  fail "the application destination is a symlink."
elif [ -e "$target_app" ]; then
  [ -d "$target_app" ] &&
    [ "$(bundle_id "$target_app")" = "$bundle_identifier" ] ||
    fail "the application destination is not an owned Pacium bundle."
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

removed_app=0
removed_link=0
if [ -d "$target_app" ]; then
  /bin/rm -rf "$target_app"
  removed_app=1
fi
if [ -L "$command_link" ]; then
  /bin/rm -f "$command_link"
  removed_link=1
fi

if [ "$removed_app" -eq 0 ] && [ "$removed_link" -eq 0 ]; then
  printf '%s\n' "Pacium Control was not installed at the selected destinations."
else
  printf '%s\n' "Removed the Pacium Control application and owned command link."
fi
printf '%s\n' "Application data and external workspaces were not modified."
