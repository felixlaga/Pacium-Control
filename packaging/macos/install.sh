#!/bin/sh
set -eu

bundle_identifier=com.pacium.control

fail() {
  printf '%s\n' "Pacium Control install failed: $1" >&2
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

script_directory=$(CDPATH= cd "$(dirname "$0")" && pwd -P)
source_app="$script_directory/Pacium Control.app"
[ ! -L "$source_app" ] && [ -d "$source_app" ] ||
  fail "the archive application is missing or unsafe."
[ "$(bundle_id "$source_app")" = "$bundle_identifier" ] ||
  fail "the archive application identity is invalid."

applications_directory=${PACIUM_APPLICATIONS_DIR:-"${HOME:?HOME is required}/Applications"}
bin_directory=${PACIUM_BIN_DIR:-"${HOME:?HOME is required}/.local/bin"}
validate_destination "$applications_directory" "PACIUM_APPLICATIONS_DIR"
validate_destination "$bin_directory" "PACIUM_BIN_DIR"

/bin/mkdir -p "$applications_directory" "$bin_directory"
applications_directory=$(CDPATH= cd "$applications_directory" && pwd -P)
bin_directory=$(CDPATH= cd "$bin_directory" && pwd -P)

target_app="$applications_directory/Pacium Control.app"
owned_executable="$target_app/Contents/MacOS/pacium-control"
command_link="$bin_directory/pacium"
stage_app="$applications_directory/.Pacium-Control.install.$$"
backup_app="$applications_directory/.Pacium-Control.backup.$$"
temporary_link="$bin_directory/.pacium-link.$$"

[ ! -e "$stage_app" ] && [ ! -L "$stage_app" ] ||
  fail "the installer staging path already exists."
[ ! -e "$backup_app" ] && [ ! -L "$backup_app" ] ||
  fail "the installer backup path already exists."
[ ! -e "$temporary_link" ] && [ ! -L "$temporary_link" ] ||
  fail "the command-link staging path already exists."

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

backup_present=0
new_app_present=0
completed=0

cleanup() {
  status=$?
  trap - EXIT HUP INT TERM
  /bin/rm -f "$temporary_link"
  if [ "$completed" -ne 1 ]; then
    /bin/rm -rf "$stage_app"
    if [ "$new_app_present" -eq 1 ]; then
      /bin/rm -rf "$target_app"
    fi
    if [ "$backup_present" -eq 1 ] && [ -d "$backup_app" ]; then
      /bin/mv "$backup_app" "$target_app" || true
    fi
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM

/usr/bin/ditto "$source_app" "$stage_app"
[ "$(bundle_id "$stage_app")" = "$bundle_identifier" ] ||
  fail "the staged application identity is invalid."
[ -x "$stage_app/Contents/MacOS/pacium-control" ] ||
  fail "the staged application launcher is not executable."

if [ -d "$target_app" ]; then
  /bin/mv "$target_app" "$backup_app"
  backup_present=1
fi

/bin/mv "$stage_app" "$target_app"
new_app_present=1

/bin/ln -s "$owned_executable" "$temporary_link"
/bin/mv -f "$temporary_link" "$command_link"

completed=1
if [ "$backup_present" -eq 1 ]; then
  /bin/rm -rf "$backup_app"
fi
trap - EXIT HUP INT TERM

printf '%s\n' "Installed Pacium Control at $target_app"
printf '%s\n' "Installed pacium command at $command_link"
printf '%s\n' "Application data and external workspaces were not modified."
