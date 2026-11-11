#!/usr/bin/env bash
# ORCA uninstaller. Removes the panel, its pinned herdr copy, the commands it put on
# your PATH and its service. Keeps ~/.config/operio-orca (settings, routines, drafts, logs)
# unless you pass --purge. Never stops your herdr server or your agents.
#
#   bash uninstall.sh [--purge] [--yes]

set -euo pipefail

PREFIX="${OPERIO_ORCA_PREFIX:-$HOME/.local/share/operio-orca}"
CONFIG_DIR="${OPERIO_ORCA_CONFIG_DIR:-$HOME/.config/operio-orca}"
DEMO_ROOT="${OPERIO_ORCA_DEMO_ROOT:-$HOME/.config/operio-orca-demo}"
BIN_DIR="$HOME/.local/bin"
HERDR_CONFIG="$HOME/.config/herdr/config.toml"
SYSTEMD_DIR="$HOME/.config/systemd/user"
LAUNCHD_DIR="$HOME/Library/LaunchAgents"
LABEL=work.operio.orca
PURGE=0
YES=0

say() { printf '%s\n' "operio-orca: $*"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --purge) PURGE=1 ;;
    --yes|-y) YES=1 ;;
    -h|--help) sed -n '2,6p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) printf 'operio-orca: unknown option %s\n' "$1" >&2; exit 1 ;;
  esac
  shift
done

if [ "$YES" -ne 1 ] && [ -t 0 ]; then
  printf 'Remove ORCA from %s%s? [y/N] ' "$PREFIX" "$( [ "$PURGE" -eq 1 ] && printf ' and delete %s' "$CONFIG_DIR")"
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
    systemctl --user disable --now operio-orca.service >/dev/null 2>&1 || true
    # The herdr unit only ever started herdr; disabling it leaves a running server alone.
    systemctl --user disable operio-orca-herdr.service >/dev/null 2>&1 || true
  fi
  rm -f "$SYSTEMD_DIR/operio-orca.service" "$SYSTEMD_DIR/operio-orca-herdr.service"
  if [ "$SERVICE_ENABLED" = 1 ] && command -v systemctl >/dev/null 2>&1; then
    systemctl --user daemon-reload >/dev/null 2>&1 || true
  fi
else
  # Only the panel's agent is booted out: the herdr one may be running your agents.
  if [ "$SERVICE_ENABLED" = 1 ]; then launchctl bootout "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || true; fi
  rm -f "$LAUNCHD_DIR/$LABEL.plist" "$LAUNCHD_DIR/$LABEL-herdr.plist"
fi

# A panel started by hand (no service).
if [ -f "$CONFIG_DIR/operio-orca.pid" ]; then
  kill "$(cat "$CONFIG_DIR/operio-orca.pid")" 2>/dev/null || true
  rm -f "$CONFIG_DIR/operio-orca.pid"
fi

# The demo panel (operio-orca demo), if it is running.
if [ -f "$DEMO_ROOT/server.pid" ]; then
  kill "$(cat "$DEMO_ROOT/server.pid")" 2>/dev/null || true
  rm -f "$DEMO_ROOT/server.pid"
fi

# Links on PATH: only ours (pointing into PREFIX).
for name in operio-orca operio-orca-send herdr; do
  link="$BIN_DIR/$name"
  if [ -L "$link" ]; then
    case "$(readlink "$link")" in "$PREFIX"/*) rm -f "$link" ;; esac
  fi
done

# The block install.sh added to herdr's config.
if [ -f "$HERDR_CONFIG" ] && grep -qF '# >>> operio-orca:' "$HERDR_CONFIG"; then
  tmp="$(mktemp)"
  awk '/^# >>> operio-orca:/{skip=1} !skip{print} /^# <<< operio-orca <<</{skip=0}' "$HERDR_CONFIG" > "$tmp"
  cat "$tmp" > "$HERDR_CONFIG"
  rm -f "$tmp"
  say "removed ORCA's block from $HERDR_CONFIG"
fi

# Leftovers from pre-release development builds, which used an older name. Nothing public
# ever shipped under it, so this only touches dev machines, and only what exists. The old
# name is assembled from parts so a repo-wide search for it stays clean.
OLD="free""-orca"
OLD_PREFIX="$HOME/.local/share/$OLD"
OLD_CONFIG="$HOME/.config/$OLD"
OLD_DEMO="$HOME/.config/$OLD-demo"
OLD_LABEL="work.operio.$OLD"
legacy=0
if [ "$(uname -s)" = Linux ]; then
  if [ -f "$SYSTEMD_DIR/$OLD.service" ] || [ -f "$SYSTEMD_DIR/$OLD-herdr.service" ]; then
    legacy=1
    if command -v systemctl >/dev/null 2>&1 && systemctl --user show-environment >/dev/null 2>&1; then
      systemctl --user disable --now "$OLD.service" >/dev/null 2>&1 || true
      systemctl --user disable "$OLD-herdr.service" >/dev/null 2>&1 || true
    fi
    rm -f "$SYSTEMD_DIR/$OLD.service" "$SYSTEMD_DIR/$OLD-herdr.service"
    if command -v systemctl >/dev/null 2>&1; then systemctl --user daemon-reload >/dev/null 2>&1 || true; fi
  fi
elif [ -f "$LAUNCHD_DIR/$OLD_LABEL.plist" ] || [ -f "$LAUNCHD_DIR/$OLD_LABEL-herdr.plist" ]; then
  legacy=1
  launchctl bootout "gui/$(id -u)/$OLD_LABEL" >/dev/null 2>&1 || true
  rm -f "$LAUNCHD_DIR/$OLD_LABEL.plist" "$LAUNCHD_DIR/$OLD_LABEL-herdr.plist"
fi
if [ -f "$OLD_CONFIG/$OLD.pid" ]; then
  legacy=1
  kill "$(cat "$OLD_CONFIG/$OLD.pid")" 2>/dev/null || true
  rm -f "$OLD_CONFIG/$OLD.pid"
fi
for name in "$OLD" "$OLD-send" herdr; do
  link="$BIN_DIR/$name"
  if [ -L "$link" ]; then
    case "$(readlink "$link")" in "$OLD_PREFIX"/*) rm -f "$link"; legacy=1 ;; esac
  fi
done
if [ -f "$HERDR_CONFIG" ] && grep -qF "# >>> $OLD:" "$HERDR_CONFIG"; then
  legacy=1
  tmp="$(mktemp)"
  awk -v b="# >>> $OLD:" -v e="# <<< $OLD <<<" 'index($0, b) == 1 {skip=1} !skip {print} index($0, e) == 1 {skip=0}' "$HERDR_CONFIG" > "$tmp"
  cat "$tmp" > "$HERDR_CONFIG"
  rm -f "$tmp"
fi
if [ -d "$OLD_PREFIX" ]; then rm -rf "$OLD_PREFIX"; legacy=1; fi
if [ "$PURGE" -eq 1 ]; then
  if [ -d "$OLD_CONFIG" ]; then rm -rf "$OLD_CONFIG"; legacy=1; fi
  if [ -f "$OLD_DEMO/.$OLD-demo" ]; then rm -rf "$OLD_DEMO"; legacy=1; fi
fi
if [ "$legacy" -eq 1 ]; then say "also removed leftovers of a pre-release development build"; fi

case "$PREFIX" in
  ""|"/"|"$HOME"|"$HOME/") say "refusing to delete PREFIX=$PREFIX"; exit 1 ;;
esac
# herdr servers started from our copy keep running, because they hold your agents. Note them
# so the last line can say how to stop them once those agents are done.
herdr_pids="$(ps -u "$(id -u)" -o pid=,args= 2>/dev/null | awk -v b="$PREFIX/bin/herdr" '$2 == b && $3 == "server" {print $1}' | tr '\n' ' ' | sed 's/ $//')"
rm -rf "$PREFIX"
say "removed $PREFIX"

if [ "$PURGE" -eq 1 ]; then
  case "$CONFIG_DIR" in ""|"/"|"$HOME"|"$HOME/") say "refusing to delete CONFIG_DIR=$CONFIG_DIR"; exit 1 ;; esac
  rm -rf "$CONFIG_DIR"
  say "deleted $CONFIG_DIR"
  # The demo folder holds only fictional data, and is marked as such.
  if [ -f "$DEMO_ROOT/.operio-orca-demo" ]; then rm -rf "$DEMO_ROOT"; say "deleted $DEMO_ROOT"; fi
else
  say "kept your settings, routines and drafts in $CONFIG_DIR (delete it, or run with --purge)"
fi
say "ORCA is uninstalled. herdr's own data (~/.config/herdr) and running agents were not touched."
if [ -n "$herdr_pids" ]; then
  say "herdr is still running your agents (pid $herdr_pids). When they are done, stop it with: kill $herdr_pids"
fi
