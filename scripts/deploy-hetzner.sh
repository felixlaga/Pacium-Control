#!/usr/bin/env bash
# Deploy Pacium Control to a remote Linux host over SSH and publish it on the
# tailnet so its tmux sessions can be attached from this machine.
#
# Usage:
#   ./scripts/deploy-hetzner.sh [ssh-target] [meta-tmux-session]
# Defaults:
#   ssh-target        root@felix-harness
#   meta-tmux-session meta-0
#
# What it does on the remote host (all additive, no existing state is removed):
#   1. Installs Node 24.18 to /opt/node24 (the box ships Node 22, Pacium needs 24.18.x).
#   2. Installs build-essential (required to compile node-pty).
#   3. Syncs this repository to /root/pacium-src and builds the Linux package there
#      (the package must be built on Linux).
#   4. Installs it with the official installer to ~/.local/share/pacium-control.
#   5. Creates a systemd unit "pacium" bound to 127.0.0.1:4174 with the tmux
#      socket, Meta session, and tailnet identity configured via env.
#   6. Runs `tailscale serve --bg --yes 4174` to publish it privately on the
#      tailnet with identity headers (this is the "login" — no password exists).
set -euo pipefail

TARGET=${1:-root@felix-harness}
META_SESSION=${2:-meta-0}
NODE_VERSION=24.18.0
REPO_ROOT=$(CDPATH= cd "$(dirname "$0")/.." && pwd -P)

say() { printf '\n\033[1m== %s\033[0m\n' "$1"; }

say "Preflight: $TARGET"
ssh -o ConnectTimeout=10 -o BatchMode=yes "$TARGET" true

IDENTITY=$(ssh "$TARGET" 'tailscale status --json' | python3 -c '
import json, sys
d = json.load(sys.stdin)
if d.get("BackendState") != "Running":
    sys.exit("Tailscale is not signed in on the remote host. Run: tailscale login")
self_ = d["Self"]
dns = self_["DNSName"].rstrip(".")
user = d["User"][str(self_["UserID"])]
print(dns)
print(user["LoginName"])
')
ORIGIN_HOST=$(printf '%s' "$IDENTITY" | sed -n 1p)
OPERATOR_LOGIN=$(printf '%s' "$IDENTITY" | sed -n 2p)
ORIGIN="https://${ORIGIN_HOST}"
echo "tailnet origin:  $ORIGIN"
echo "operator login:  $OPERATOR_LOGIN"

TMUX_SOCKET=$(ssh "$TARGET" 'tmux display-message -p "#{socket_path}" 2>/dev/null || echo "/tmp/tmux-$(id -u)/default"')
echo "tmux socket:     $TMUX_SOCKET"
ssh "$TARGET" "tmux -S '$TMUX_SOCKET' has-session -t '$META_SESSION'" ||
  { echo "tmux session '$META_SESSION' not found on $TARGET" >&2; exit 1; }

say "Node $NODE_VERSION + build tools"
ssh "$TARGET" "set -e
if ! /opt/node24/bin/node -v 2>/dev/null | grep -q '^v${NODE_VERSION%%.*}\.'; then
  curl -fsSL -o /tmp/node24.tar.xz https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz
  mkdir -p /opt/node24
  tar -xJf /tmp/node24.tar.xz -C /opt/node24 --strip-components=1
fi
/opt/node24/bin/node -v
DEBIAN_FRONTEND=noninteractive apt-get install -y -q build-essential file >/tmp/pacium-apt.log 2>&1 || { tail -5 /tmp/pacium-apt.log; exit 1; }"

say "Sync repository"
rsync -a --delete \
  --exclude .git --exclude node_modules --exclude dist --exclude test-results \
  --exclude images --exclude .DS_Store \
  "$REPO_ROOT/" "$TARGET:/root/pacium-src/"

say "Build Linux package (first run compiles node-pty; takes a few minutes)"
ssh "$TARGET" 'set -e
export PATH=/opt/node24/bin:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0
cd /root/pacium-src
corepack prepare pnpm@11.17.0 --activate >/dev/null 2>&1 || npm i -g pnpm@11.17.0 >/dev/null
pnpm install --frozen-lockfile
pnpm build
node packaging/linux/build.mjs'

say "Install package"
ssh "$TARGET" 'set -e
cd /root/pacium-src/dist/linux
rm -rf /tmp/pacium-install && mkdir -p /tmp/pacium-install
tar -xzf pacium-control-*-linux-x64.tar.gz -C /tmp/pacium-install
HOME=/root sh /tmp/pacium-install/install.sh'

say "Systemd unit"
ssh "$TARGET" "set -e
cat > /etc/systemd/system/pacium.service <<UNIT
[Unit]
Description=Pacium Control local server
After=network-online.target tailscaled.service

[Service]
Environment=HOME=/root
Environment=SHELL=/bin/bash
Environment=PACIUM_NODE_BINARY=/opt/node24/bin/node
Environment=PACIUM_DEFAULT_CWD=/root
Environment=PACIUM_TMUX_SOCKET=$TMUX_SOCKET
Environment=PACIUM_META_TMUX_SESSION=$META_SESSION
Environment=PACIUM_TAILSCALE_ORIGIN=$ORIGIN
Environment=PACIUM_TAILSCALE_OPERATOR_LOGINS=$OPERATOR_LOGIN
ExecStart=/root/.local/bin/pacium --no-open
Restart=on-failure
RestartSec=3
User=root

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now pacium
sleep 2
systemctl --no-pager --lines 5 status pacium || true"

say "Publish on tailnet (tailscale serve)"
ssh "$TARGET" 'tailscale serve --bg --yes 4174 2>&1 | tail -5'

say "Verify"
ssh "$TARGET" 'curl -s -o /dev/null -w "loopback: %{http_code}\n" http://127.0.0.1:4174/'
sleep 2
curl -s -o /dev/null -w "tailnet:  %{http_code}\n" -m 15 "$ORIGIN/" ||
  echo "Tailnet URL not reachable yet; HTTPS certs can take a minute on first serve."

printf '\nDone. Open %s in your browser.\n' "$ORIGIN"
printf 'Attach %s via the sidebar "Attach tmux" button there.\n' "$META_SESSION"
