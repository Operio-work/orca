#!/usr/bin/env bash
# Free-ORCA uninstaller. Removes the panel, its pinned herdr copy, the commands it put on
# your PATH and its service. Keeps ~/.config/free-orca (settings, routines, drafts, logs)
# unless you pass --purge. Never stops your herdr server or your agents.
#
#   bash uninstall.sh [--purge] [--yes]

set -euo pipefail

PREFIX="${FREE_ORCA_PREFIX:-$HOME/.local/share/free-orca}"
CONFIG_DIR="${FREE_ORCA_CONFIG_DIR:-$HOME/.config/free-orca}"
BIN_DIR="$HOME/.local/bin"
HERDR_CONFIG="$HOME/.config/herdr/config.toml"
SYSTEMD_DIR="$HOME/.config/systemd/user"
LAUNCHD_DIR="$HOME/Library/LaunchAgents"
LABEL=work.operio.free-orca
PURGE=0
YES=0

say() { printf '%s\n' "free-orca: $*"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --purge) PURGE=1 ;;
    --yes|-y) YES=1 ;;
    -h|--help) sed -n '2,6p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) printf 'free-orca: unknown option %s\n' "$1" >&2; exit 1 ;;
  esac
  shift
done

if [ "$YES" -ne 1 ] && [ -t 0 ]; then
  printf 'Remove Free-ORCA from %s%s? [y/N] ' "$PREFIX" "$( [ "$PURGE" -eq 1 ] && printf ' and delete %s' "$CONFIG_DIR")"
  read -r answer
  case "$answer" in y|Y|yes|YES) ;; *) say "nothing removed"; exit 0 ;; esac
fi

# Was the service enabled by install.sh? (--no-service installs never touched systemd/launchd.)
SERVICE_ENABLED=1
if [ -f "$PREFIX/install.env" ]; then
  SERVICE_ENABLED="$(sed -n 's/^SERVICE_ENABLED="\{0,1\}\([01]\)"\{0,1\}$/\1/p' "$PREFIX/install.env" | tail -1)"
  SERVICE_ENABLED="${SERVICE_ENABLED:-1}"
fi

# Service first, so nothing restarts what we remove.
if [ "$(uname -s)" = Linux ]; then
  if [ "$SERVICE_ENABLED" = 1 ] && command -v systemctl >/dev/null 2>&1 && systemctl --user show-environment >/dev/null 2>&1; then
    systemctl --user disable --now free-orca.service >/dev/null 2>&1 || true
    # The herdr unit only ever started herdr; disabling it leaves a running server alone.
    systemctl --user disable free-orca-herdr.service >/dev/null 2>&1 || true
  fi
  rm -f "$SYSTEMD_DIR/free-orca.service" "$SYSTEMD_DIR/free-orca-herdr.service"
  if [ "$SERVICE_ENABLED" = 1 ] && command -v systemctl >/dev/null 2>&1; then
    systemctl --user daemon-reload >/dev/null 2>&1 || true
  fi
else
  # Only the panel's agent is booted out: the herdr one may be running your agents.
  if [ "$SERVICE_ENABLED" = 1 ]; then launchctl bootout "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || true; fi
  rm -f "$LAUNCHD_DIR/$LABEL.plist" "$LAUNCHD_DIR/$LABEL-herdr.plist"
fi

# A panel started by hand (no service).
if [ -f "$CONFIG_DIR/free-orca.pid" ]; then
  kill "$(cat "$CONFIG_DIR/free-orca.pid")" 2>/dev/null || true
  rm -f "$CONFIG_DIR/free-orca.pid"
fi

# Links on PATH: only ours (pointing into PREFIX).
for name in free-orca free-orca-send herdr; do
  link="$BIN_DIR/$name"
  if [ -L "$link" ]; then
    case "$(readlink "$link")" in "$PREFIX"/*) rm -f "$link" ;; esac
  fi
done

# The block install.sh added to herdr's config.
if [ -f "$HERDR_CONFIG" ] && grep -qF '# >>> free-orca:' "$HERDR_CONFIG"; then
  tmp="$(mktemp)"
  awk '/^# >>> free-orca:/{skip=1} !skip{print} /^# <<< free-orca <<</{skip=0}' "$HERDR_CONFIG" > "$tmp"
  cat "$tmp" > "$HERDR_CONFIG"
  rm -f "$tmp"
  say "removed Free-ORCA's block from $HERDR_CONFIG"
fi

case "$PREFIX" in
  ""|"/"|"$HOME"|"$HOME/") say "refusing to delete PREFIX=$PREFIX"; exit 1 ;;
esac
rm -rf "$PREFIX"
say "removed $PREFIX"

if [ "$PURGE" -eq 1 ]; then
  case "$CONFIG_DIR" in ""|"/"|"$HOME"|"$HOME/") say "refusing to delete CONFIG_DIR=$CONFIG_DIR"; exit 1 ;; esac
  rm -rf "$CONFIG_DIR"
  say "deleted $CONFIG_DIR"
else
  say "kept your settings, routines and drafts in $CONFIG_DIR (delete it, or run with --purge)"
fi
say "Free-ORCA is uninstalled. herdr's own data (~/.config/herdr) and running agents were not touched."
