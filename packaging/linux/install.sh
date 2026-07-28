#!/bin/sh
set -eu

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

recognized_package() {
  marker=$1/PACKAGE_ID
  [ -f "$marker" ] &&
    [ "$(/usr/bin/sed -n '1p' "$marker")" = "com.pacium.control" ] &&
    [ "$(/usr/bin/sed -n '2p' "$marker")" = "schema=1" ] &&
    [ "$(/usr/bin/sed -n '3p' "$marker")" = "platform=linux" ] &&
    [ "$(/usr/bin/sed -n '4p' "$marker")" = "architecture=x64" ] &&
    [ "$(/usr/bin/wc -l <"$marker" | /usr/bin/tr -d ' ')" = "4" ]
}

script_directory=$(CDPATH= cd "$(dirname "$0")" && pwd -P)
source_package="$script_directory/pacium-control"
[ ! -L "$source_package" ] && [ -d "$source_package" ] ||
  fail "the archive application is missing or unsafe."
recognized_package "$source_package" ||
  fail "the archive application identity is invalid."

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
/bin/mkdir -p "$target_parent" "$bin_directory"
target_parent=$(CDPATH= cd "$target_parent" && pwd -P)
bin_directory=$(CDPATH= cd "$bin_directory" && pwd -P)
target_package="$target_parent/pacium-control"

owned_executable="$target_package/bin/pacium"
command_link="$bin_directory/pacium"
stage_package="$target_parent/.pacium-control.install.$$"
backup_package="$target_parent/.pacium-control.backup.$$"
temporary_link="$bin_directory/.pacium-link.$$"

for path in "$stage_package" "$backup_package" "$temporary_link"; do
  [ ! -e "$path" ] && [ ! -L "$path" ] ||
    fail "an installer staging path already exists."
done

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

backup_present=0
new_package_present=0
completed=0

cleanup() {
  status=$?
  trap - EXIT HUP INT TERM
  /bin/rm -f "$temporary_link"
  if [ "$completed" -ne 1 ]; then
    /bin/rm -rf "$stage_package"
    if [ "$new_package_present" -eq 1 ]; then
      /bin/rm -rf "$target_package"
    fi
    if [ "$backup_present" -eq 1 ] && [ -d "$backup_package" ]; then
      /bin/mv "$backup_package" "$target_package" || true
    fi
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM

/bin/mkdir "$stage_package"
/bin/cp -a "$source_package/." "$stage_package"
recognized_package "$stage_package" ||
  fail "the staged application identity is invalid."
[ -x "$stage_package/bin/pacium" ] ||
  fail "the staged application launcher is not executable."

if [ -d "$target_package" ]; then
  /bin/mv "$target_package" "$backup_package"
  backup_present=1
fi

/bin/mv "$stage_package" "$target_package"
new_package_present=1

/bin/ln -s "$owned_executable" "$temporary_link"
/bin/mv -f "$temporary_link" "$command_link"

completed=1
if [ "$backup_present" -eq 1 ]; then
  /bin/rm -rf "$backup_package"
fi
trap - EXIT HUP INT TERM

printf '%s\n' "Installed Pacium Control at $target_package"
printf '%s\n' "Installed pacium command at $command_link"
printf '%s\n' "Application state and external workspaces were not modified."
