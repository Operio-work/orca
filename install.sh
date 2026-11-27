#!/usr/bin/env bash
# ORCA installer — https://make.operio.work
#
#   curl -fsSL https://make.operio.work/install.sh | bash
#   bash install.sh [--source DIR] [--no-service] [--no-herdr-config] [--help]
#
# Installs, for the current user only (no sudo, no Docker):
#   ~/.local/share/operio-orca/app       the ORCA panel (Node >= 20)
#   ~/.local/share/operio-orca/bin/herdr  herdr, pinned to one release and checked by sha256
#   ~/.local/bin/operio-orca              the CLI (start | stop | status | update | llm | demo | uninstall)
#   a systemd --user unit (Linux) or a launchd agent (macOS); both load ~/.config/operio-orca/llm.env
# Your settings, routines, API keys and logs live in ~/.config/operio-orca and are never overwritten.
#
# ORCA is MIT (c) 2026 Operio. herdr is a separate project by its authors, Apache-2.0
# (https://github.com/herdrdev/herdr); this script downloads its official release binary.
# Safe to run again: it only changes what is out of date.

set -euo pipefail

# ─── Pinned versions (ORCA moves herdr and the panel together) ───────────
PANEL_VERSION="0.11.3"
HERDR_VERSION="0.9.5"
HERDR_BASE_URL="https://github.com/herdrdev/herdr/releases/download/v${HERDR_VERSION}"
# sha256 of each release asset, from the GitHub release v0.9.5 (published 2026-10-14).
# Read indirectly below as HERDR_SHA256_<platform>_<arch>.
# shellcheck disable=SC2034
HERDR_SHA256_linux_x86_64="14d9e8bc8b4a9e0118d77c32266f76d461f09b40342eb23752960bd89f59929d"
# shellcheck disable=SC2034
HERDR_SHA256_linux_aarch64="17d7536f2da50859523680ef279dffcac8e4a235f4e46fe8da6c2ec44141897c"
# shellcheck disable=SC2034
HERDR_SHA256_macos_x86_64="5fb0a908ec7f6745e3e245738b06bfad56c46391c391ab3c0955fbead01f1369"
# shellcheck disable=SC2034
HERDR_SHA256_macos_aarch64="fb77c2232a05a8035421382c894392f4174e4e38a18e48af3dd0290157c3a7e2"
# The panel release tarball (built by scripts/release.sh; install.sh itself is not in it).
# Served by make.operio.work, with the GitHub release as a mirror. Same file, same sha256.
PANEL_URL="https://make.operio.work/releases/operio-orca-${PANEL_VERSION}.tar.gz"
PANEL_MIRROR_URL="https://github.com/operio-work/orca/releases/download/v${PANEL_VERSION}/operio-orca-${PANEL_VERSION}.tar.gz"
PANEL_SHA256="4352b2ce5c38cc8575ddbee50d9f8e467ea467d864154e7a4a311b89c52de758"
# For testing only: fetch the tarball from another URL (e.g. a local copy of the site).
# The sha256 above is still enforced; there is no way to override it.
if [ -n "${OPERIO_ORCA_PANEL_URL:-}" ]; then PANEL_URL="$OPERIO_ORCA_PANEL_URL"; PANEL_MIRROR_URL=""; fi
NODE_MIN_MAJOR=20

# ─── Paths ────────────────────────────────────────────────────────────────────
PREFIX="${OPERIO_ORCA_PREFIX:-$HOME/.local/share/operio-orca}"
BIN_DIR="$HOME/.local/bin"
CONFIG_DIR="${OPERIO_ORCA_CONFIG_DIR:-$HOME/.config/operio-orca}"
HERDR_CONFIG="$HOME/.config/herdr/config.toml"
SYSTEMD_DIR="$HOME/.config/systemd/user"
LAUNCHD_DIR="$HOME/Library/LaunchAgents"
LAUNCHD_LABEL="work.operio.orca"

SOURCE=""
WITH_SERVICE=1
HERDR_CONFIG_EDIT=1

say()  { printf '%s\n' "operio-orca: $*"; }
warn() { printf '%s\n' "operio-orca: WARNING: $*" >&2; }
die()  { printf '%s\n' "operio-orca: ERROR: $*" >&2; exit 1; }

usage() {
  sed -n '2,17p' "$0" 2>/dev/null | sed 's/^# \{0,1\}//' || true
  cat <<'EOF'
Options:
  --source DIR        install the panel from a local checkout instead of a release
  --no-service        write the service files but do not enable or start them
  --no-herdr-config   do not add the "no self-update" block to ~/.config/herdr/config.toml
  -h, --help          this help

For testing only: OPERIO_ORCA_PANEL_URL=<url> fetches the panel tarball from another place
(plain http is allowed for 127.0.0.1 and localhost). The pinned sha256 is still enforced.
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --source) [ $# -ge 2 ] || die "--source needs a folder"; SOURCE="$2"; shift 2 ;;
    --source=*) SOURCE="${1#--source=}"; shift ;;
    --no-service) WITH_SERVICE=0; shift ;;
    --no-herdr-config) HERDR_CONFIG_EDIT=0; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown option: $1 (try --help)" ;;
  esac
done

[ "$(id -u)" -ne 0 ] || die "do not run this as root; ORCA installs for your user only"
[ -n "${HOME:-}" ] && [ -d "$HOME" ] || die "HOME is not set to a folder"

# ─── Platform ─────────────────────────────────────────────────────────────────
OS="$(uname -s)"
ARCH="$(uname -m)"
case "$OS" in
  Linux)  PLATFORM=linux ;;
  Darwin) PLATFORM=macos ;;
  *) die "unsupported system: $OS (Linux and macOS only)" ;;
esac
case "$ARCH" in
  x86_64|amd64)  HARCH=x86_64 ;;
  aarch64|arm64) HARCH=aarch64 ;;
  *) die "unsupported CPU: $ARCH (x86_64 and arm64 only)" ;;
esac
HERDR_ASSET="herdr-${PLATFORM}-${HARCH}"
sha_var="HERDR_SHA256_${PLATFORM}_${HARCH}"
HERDR_SHA256="${!sha_var}"
# Windows: Ubuntu under WSL2 (systemd is off there until /etc/wsl.conf turns it on).
IS_WSL=0
if [ -n "${WSL_DISTRO_NAME:-}" ] || grep -qi microsoft /proc/version 2>/dev/null; then IS_WSL=1; fi
NO_SYSTEMD=0

# ─── Tools ────────────────────────────────────────────────────────────────────
have() { command -v "$1" >/dev/null 2>&1; }

sha256_of() {
  if have sha256sum; then sha256sum "$1" | awk '{print $1}'
  elif have shasum; then shasum -a 256 "$1" | awk '{print $1}'
  else die "need sha256sum or shasum to verify downloads"
  fi
}

download() { # url dest — HTTPS only, except plain http to this computer (testing)
  local proto="=https" wget_opts=(--https-only)
  case "$1" in http://127.0.0.1[:/]*|http://localhost[:/]*) proto="=http,https"; wget_opts=() ;; esac
  if have curl; then curl -fsSL --proto "$proto" --tlsv1.2 --retry 2 -o "$2" "$1"
  elif have wget; then wget -q ${wget_opts[@]+"${wget_opts[@]}"} -O "$2" "$1"
  else die "need curl or wget to download herdr"
  fi
}

NODE_BIN="$(command -v node || true)"
[ -n "$NODE_BIN" ] || die "Node.js ${NODE_MIN_MAJOR} or newer is required (https://nodejs.org). No node found in PATH."
NODE_VERSION="$("$NODE_BIN" -p 'process.versions.node' 2>/dev/null || echo 0)"
NODE_MAJOR="${NODE_VERSION%%.*}"
[ "$NODE_MAJOR" -ge "$NODE_MIN_MAJOR" ] 2>/dev/null || die "Node.js ${NODE_MIN_MAJOR} or newer is required; found ${NODE_VERSION} at ${NODE_BIN}"
NODE_BIN="$(cd "$(dirname "$NODE_BIN")" && pwd -P)/$(basename "$NODE_BIN")"
NPM_BIN="$(command -v npm || true)"
[ -n "$NPM_BIN" ] || die "npm is required (it ships with Node.js)"

TMP="$(mktemp -d "${TMPDIR:-/tmp}/operio-orca.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

SCRIPT_DIR=""
case "${BASH_SOURCE[0]:-}" in
  ""|bash|-bash|/dev/*|/proc/*) ;;
  *) SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd -P || true)" ;;
esac
if [ -z "$SOURCE" ] && [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/server.js" ] && [ -f "$SCRIPT_DIR/package.json" ]; then
  SOURCE="$SCRIPT_DIR"
fi

# ─── 0. the panel release: download and verify before anything is installed ──
if [ -z "$SOURCE" ]; then
  [ "${OPERIO_ORCA_PANEL_URL:-}" = "" ] || warn "testing override: panel from ${PANEL_URL} (the pinned sha256 still applies)"
  say "downloading the panel ${PANEL_VERSION}"
  if ! download "$PANEL_URL" "$TMP/panel.tar.gz"; then
    [ -n "$PANEL_MIRROR_URL" ] || die "could not download ${PANEL_URL}. Nothing was installed."
    warn "could not download ${PANEL_URL}; trying the GitHub mirror"
    download "$PANEL_MIRROR_URL" "$TMP/panel.tar.gz" || die "could not download the panel. Nothing was installed."
  fi
  GOT="$(sha256_of "$TMP/panel.tar.gz")"
  [ "$GOT" = "$PANEL_SHA256" ] || die "panel checksum mismatch: expected ${PANEL_SHA256}, got ${GOT}. Nothing was installed."
  say "panel ${PANEL_VERSION} verified (sha256 ${PANEL_SHA256})"
fi

mkdir -p "$PREFIX/bin" "$BIN_DIR" "$CONFIG_DIR"
chmod 700 "$CONFIG_DIR"

# ─── 1. herdr (pinned + verified) ─────────────────────────────────────────────
HERDR_BIN="$PREFIX/bin/herdr"
if [ -x "$HERDR_BIN" ] && [ "$(sha256_of "$HERDR_BIN")" = "$HERDR_SHA256" ]; then
  say "herdr ${HERDR_VERSION} already installed and verified"
else
  if [ -n "${OPERIO_ORCA_HERDR_FILE:-}" ]; then
    say "using local herdr file ${OPERIO_ORCA_HERDR_FILE}"
    cp "$OPERIO_ORCA_HERDR_FILE" "$TMP/herdr"
  else
    say "downloading herdr ${HERDR_VERSION} (${HERDR_ASSET})"
    download "${HERDR_BASE_URL}/${HERDR_ASSET}" "$TMP/herdr"
  fi
  GOT="$(sha256_of "$TMP/herdr")"
  [ "$GOT" = "$HERDR_SHA256" ] || die "herdr checksum mismatch for ${HERDR_ASSET}: expected ${HERDR_SHA256}, got ${GOT}. Nothing was installed."
  chmod 755 "$TMP/herdr"
  mv -f "$TMP/herdr" "$HERDR_BIN"
  say "herdr ${HERDR_VERSION} installed and verified (sha256 ${HERDR_SHA256})"
fi

# ─── 2. the panel ─────────────────────────────────────────────────────────────
SRC_DIR="$TMP/src"
if [ -n "$SOURCE" ]; then
  [ -f "$SOURCE/server.js" ] && [ -f "$SOURCE/package.json" ] || die "--source ${SOURCE} is not an ORCA checkout"
  say "installing the panel from ${SOURCE}"
  mkdir -p "$SRC_DIR"
  # Copy without git history, local deps, tests, the demo screenshots or the website.
  (cd "$SOURCE" && tar -cf - --exclude=./.git --exclude=./.claude --exclude=./node_modules --exclude=./test --exclude=./demo/screenshots --exclude=./site --exclude=./dist . ) | (cd "$SRC_DIR" && tar -xf -)
else
  mkdir -p "$SRC_DIR"
  tar -xzf "$TMP/panel.tar.gz" -C "$SRC_DIR" --strip-components=1
fi
SRC_VERSION="$("$NODE_BIN" -p "require('$SRC_DIR/package.json').version")"

say "installing the panel's one dependency (npm ci)"
(cd "$SRC_DIR" && NPM_CONFIG_UPDATE_NOTIFIER=false "$NPM_BIN" ci --omit=dev --ignore-scripts --no-audit --no-fund --loglevel=error >/dev/null) \
  || die "npm ci failed; check your network or npm settings. Nothing was changed."

# Swap in atomically-ish: the old app stays until the new one is in place.
rm -rf "$PREFIX/app.old"
[ -d "$PREFIX/app" ] && mv "$PREFIX/app" "$PREFIX/app.old"
mv "$SRC_DIR" "$PREFIX/app"
rm -rf "$PREFIX/app.old"
chmod 755 "$PREFIX/app/bin/operio-orca" "$PREFIX/app/bin/operio-orca-send" "$PREFIX/app/demo/demo-herdr"
cp "$PREFIX/app/LICENSE" "$PREFIX/LICENSE"
cp "$PREFIX/app/THIRD_PARTY_NOTICES.md" "$PREFIX/THIRD_PARTY_NOTICES.md"
say "panel ${SRC_VERSION} installed in ${PREFIX}/app"

# ─── 3. commands on PATH ──────────────────────────────────────────────────────
link() { # target name
  local dest="$BIN_DIR/$2"
  if [ -L "$dest" ] || [ ! -e "$dest" ]; then
    ln -sfn "$1" "$dest"
  else
    warn "$dest exists and is not a link; left it alone"
  fi
}
link "$PREFIX/app/bin/operio-orca" operio-orca
link "$PREFIX/app/bin/operio-orca-send" operio-orca-send
# herdr on PATH only if you don't already have one there (the panel always uses its own copy).
if [ ! -e "$BIN_DIR/herdr" ] || { [ -L "$BIN_DIR/herdr" ] && [ "$(readlink "$BIN_DIR/herdr")" = "$HERDR_BIN" ]; }; then
  ln -sfn "$HERDR_BIN" "$BIN_DIR/herdr"
else
  say "kept your existing $BIN_DIR/herdr; ORCA uses its own pinned copy at $HERDR_BIN"
fi

# ─── 4. settings, example routines, manifest ──────────────────────────────────
ENV_FILE="$CONFIG_DIR/env"
if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<'EOF'
# ORCA settings (KEY=value, one per line). Restart after a change: operio-orca restart
# OPERIO_ORCA_PORT=7171
# Extra names the page may be opened by, e.g. your `tailscale serve` name:
# OPERIO_ORCA_ALLOWED_HOSTS=my-laptop.example-tailnet.ts.net
# Folders offered in "New agent" (comma separated):
# OPERIO_ORCA_FOLDERS=~,~/code
# DANGER: listen on another address than 127.0.0.1. There is no login.
# OPERIO_ORCA_HOST=127.0.0.1
EOF
  chmod 600 "$ENV_FILE"
fi
mkdir -p "$CONFIG_DIR/routines" "$CONFIG_DIR/logs"
for pack in "$PREFIX/app/routines"/*/; do
  [ -f "$pack/routine.json" ] || continue
  id="$(basename "$pack")"
  if [ ! -e "$CONFIG_DIR/routines/$id" ]; then
    cp -R "$pack" "$CONFIG_DIR/routines/$id"
    say "added example routine: $id (off until you turn it on)"
  fi
done

SERVICE=none
if [ "$PLATFORM" = linux ]; then SERVICE=systemd; else SERVICE=launchd; fi
cat > "$PREFIX/install.env" <<EOF
# Written by install.sh — read by the operio-orca CLI.
PREFIX="$PREFIX"
CONFIG_DIR="$CONFIG_DIR"
NODE_BIN="$NODE_BIN"
HERDR_BIN="$HERDR_BIN"
SERVICE="$SERVICE"
SERVICE_ENABLED="$WITH_SERVICE"
EOF
cat > "$PREFIX/manifest.json" <<EOF
{
  "panel": "$SRC_VERSION",
  "herdr": "$HERDR_VERSION",
  "herdrAsset": "$HERDR_ASSET",
  "herdrSha256": "$HERDR_SHA256",
  "platform": "$PLATFORM-$HARCH",
  "installedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

# ─── 5. herdr: no self-update (the version is pinned; `operio-orca update` moves it) ───
MARK_BEGIN="# >>> operio-orca: pinned herdr, no background update checks >>>"
MARK_END="# <<< operio-orca <<<"
if [ "$HERDR_CONFIG_EDIT" -eq 1 ]; then
  mkdir -p "$(dirname "$HERDR_CONFIG")"
  if [ -f "$HERDR_CONFIG" ] && grep -qF "$MARK_BEGIN" "$HERDR_CONFIG"; then
    : # already there
  elif [ -f "$HERDR_CONFIG" ] && grep -Eq '^[[:space:]]*\[update\][[:space:]]*(#.*)?$' "$HERDR_CONFIG"; then
    warn "$HERDR_CONFIG already has an [update] section; add these two lines to it yourself:"
    warn "  version_check = false"
    warn "  manifest_check = false"
  else
    [ -f "$HERDR_CONFIG" ] && cp "$HERDR_CONFIG" "$HERDR_CONFIG.operio-orca.bak"
    {
      printf '\n%s\n' "$MARK_BEGIN"
      printf '[update]\nversion_check = false\nmanifest_check = false\n'
      printf '%s\n' "$MARK_END"
    } >> "$HERDR_CONFIG"
    say "turned off herdr's background update checks in $HERDR_CONFIG"
  fi
fi

# ─── 6. service ───────────────────────────────────────────────────────────────
SVC_PATH="$BIN_DIR:$(dirname "$NODE_BIN"):/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin"
# API keys for the agents (operio-orca llm set NAME) go into herdr's environment every way it
# starts. The file may not exist yet: systemd's "-" and the launchd test make that fine.
# Written as %h / $HOME when the settings folder is the default one under the home folder.
LLM_ENV_UNIT="${CONFIG_DIR/#"$HOME"/%h}/llm.env"
LLM_ENV_SH="${CONFIG_DIR/#"$HOME"/\$HOME}/llm.env"
LLM_SH="set -a; [ -f \"$LLM_ENV_SH\" ] && . \"$LLM_ENV_SH\"; set +a; "
if [ "$PLATFORM" = linux ]; then
  mkdir -p "$SYSTEMD_DIR"
  cat > "$SYSTEMD_DIR/operio-orca-herdr.service" <<EOF
[Unit]
Description=herdr server for ORCA (skipped when a herdr server is already running)

[Service]
Type=simple
Environment=PATH=$SVC_PATH
# API keys for the agents (operio-orca llm); herdr's panes inherit them.
EnvironmentFile=-$LLM_ENV_UNIT
ExecCondition=/bin/sh -c '! "$HERDR_BIN" status server 2>/dev/null | grep -q "status: running"'
ExecStart=$HERDR_BIN server
Restart=on-failure
RestartSec=5
# Stopping ORCA must never take your agents with it.
KillMode=process

[Install]
WantedBy=default.target
EOF
  cat > "$SYSTEMD_DIR/operio-orca.service" <<EOF
[Unit]
Description=ORCA agent control panel (http://127.0.0.1)
Wants=operio-orca-herdr.service
After=operio-orca-herdr.service

[Service]
Type=simple
Environment=PATH=$SVC_PATH
EnvironmentFile=-$LLM_ENV_UNIT
ExecStart=$PREFIX/app/bin/operio-orca run
Restart=on-failure
RestartSec=3

[Install]
WantedBy=default.target
EOF
  if [ "$WITH_SERVICE" -eq 1 ]; then
    if have systemctl && systemctl --user show-environment >/dev/null 2>&1; then
      systemctl --user daemon-reload
      systemctl --user enable operio-orca-herdr.service operio-orca.service >/dev/null 2>&1
      # start, never restart, herdr: restarting it would end every running agent.
      systemctl --user start operio-orca-herdr.service || true
      systemctl --user restart operio-orca.service || warn "the service did not start; see: journalctl --user -u operio-orca"
      say "systemd --user service enabled and started (operio-orca.service)"
      have loginctl && [ "$(loginctl show-user "$(id -un)" -p Linger --value 2>/dev/null || echo no)" = yes ] \
        || say "tip: to keep it running after you log out: loginctl enable-linger $(id -un)"
    else
      # No systemd --user session (WSL2 without systemd, a container, a bare shell): the panel
      # cannot start with the computer, so start it by hand now and say how to fix that.
      NO_SYSTEMD=1
      sed -i.bak 's/^SERVICE="systemd"/SERVICE="none"/' "$PREFIX/install.env" && rm -f "$PREFIX/install.env.bak"
      if [ "$IS_WSL" = 1 ]; then warn "WSL without systemd: ORCA cannot start with Ubuntu yet (see the end); starting it by hand now"
      else warn "no systemd --user session here; starting the panel by hand (after a reboot: operio-orca start)"; fi
      "$PREFIX/app/bin/operio-orca" start || warn "the panel did not start; see: operio-orca doctor"
    fi
  else
    say "service files written to $SYSTEMD_DIR (not enabled: --no-service)"
  fi
else
  mkdir -p "$LAUNCHD_DIR" "$CONFIG_DIR/logs"
  xml() { printf '%s' "$1" | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g'; } # text inside <string>
  plist() { # keepalive(0|1) label program-args...
    local keep="$1" label="$2"; shift 2
    {
      printf '<?xml version="1.0" encoding="UTF-8"?>\n'
      printf '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n'
      printf '<plist version="1.0">\n<dict>\n'
      printf '  <key>Label</key><string>%s</string>\n' "$label"
      printf '  <key>ProgramArguments</key>\n  <array>\n'
      for a in "$@"; do printf '    <string>%s</string>\n' "$(xml "$a")"; done
      printf '  </array>\n'
      printf '  <key>EnvironmentVariables</key>\n  <dict><key>PATH</key><string>%s</string></dict>\n' "$SVC_PATH"
      printf '  <key>RunAtLoad</key><true/>\n'
      [ "$keep" = 1 ] && printf '  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>\n'
      printf '  <key>StandardOutPath</key><string>%s</string>\n' "$CONFIG_DIR/logs/$label.log"
      printf '  <key>StandardErrorPath</key><string>%s</string>\n' "$CONFIG_DIR/logs/$label.log"
      printf '</dict>\n</plist>\n'
    } > "$LAUNCHD_DIR/$label.plist"
  }
  # herdr server: started once at login (it exits if one is already running); never kept alive
  # by launchd, so unloading ORCA leaves your agents alone. Both load llm.env first (API keys).
  plist 0 "$LAUNCHD_LABEL-herdr" /bin/sh -c "$LLM_SH\"$HERDR_BIN\" status server 2>/dev/null | grep -q 'status: running' || exec \"$HERDR_BIN\" server"
  plist 1 "$LAUNCHD_LABEL" /bin/sh -c "${LLM_SH}exec \"$PREFIX/app/bin/operio-orca\" run"   # restarts if it crashes
  if [ "$WITH_SERVICE" -eq 1 ]; then
    # herdr: load once, never reload (that would end every running agent).
    launchctl print "gui/$(id -u)/$LAUNCHD_LABEL-herdr" >/dev/null 2>&1 \
      || launchctl bootstrap "gui/$(id -u)" "$LAUNCHD_DIR/$LAUNCHD_LABEL-herdr.plist" || warn "launchctl could not load $LAUNCHD_LABEL-herdr"
    launchctl bootout "gui/$(id -u)/$LAUNCHD_LABEL" >/dev/null 2>&1 || true
    launchctl bootstrap "gui/$(id -u)" "$LAUNCHD_DIR/$LAUNCHD_LABEL.plist" || warn "launchctl could not load $LAUNCHD_LABEL"
    say "launchd agent loaded ($LAUNCHD_LABEL)"
  else
    say "launchd agents written to $LAUNCHD_DIR (not loaded: --no-service)"
  fi
fi

# ─── 7. done ──────────────────────────────────────────────────────────────────
PORT="$(sed -n 's/^OPERIO_ORCA_PORT=\([0-9][0-9]*\).*/\1/p' "$ENV_FILE" | tail -1)"
PORT="${PORT:-7171}"
case ":$PATH:" in *":$BIN_DIR:"*) ;; *) warn "$BIN_DIR is not on your PATH; add it to use the operio-orca command" ;; esac
cat <<EOF

  ORCA ${SRC_VERSION} is installed (runs on herdr ${HERDR_VERSION}).

  Open:      http://127.0.0.1:${PORT}
  Commands:  operio-orca status | start | stop | update | doctor | logs | backup | llm | uninstall
  Settings:  ${ENV_FILE}
  API keys:  operio-orca llm set ANTHROPIC_API_KEY   (or sign in inside each agent's own terminal)
  Routines:  ${CONFIG_DIR}/routines (examples are off until you turn them on)
EOF
if [ "$IS_WSL" = 1 ] && [ "$NO_SYSTEMD" = 1 ]; then
cat <<EOF

  Windows (WSL2): systemd is off, so ORCA will not start with Ubuntu until you turn it on once:
    1. In Ubuntu:     printf '[boot]\nsystemd=true\n' | sudo tee -a /etc/wsl.conf
    2. In PowerShell: wsl --shutdown
    3. Open Ubuntu again and run the install line once more:
         curl -fsSL https://make.operio.work/install.sh | bash
  Until then, after Windows restarts run:  operio-orca start
EOF
elif [ "$NO_SYSTEMD" = 1 ]; then
cat <<EOF

  No systemd user session here, so ORCA does not start with the computer: after a reboot run
  operio-orca start. (operio-orca doctor shows the state at any time.)
EOF
fi
cat <<EOF

  It listens on this computer only, and there is no login: anyone who can reach the port
  can drive your agents. To use it from your phone, keep it on 127.0.0.1 and use either:

  - Tailscale (private network, HTTPS):
      tailscale serve --bg ${PORT}
    then add the name it prints to ${ENV_FILE}:
      OPERIO_ORCA_ALLOWED_HOSTS=<your-machine>.<your-tailnet>.ts.net
    and run: operio-orca restart

  - An SSH tunnel from the other device:
      ssh -N -L ${PORT}:127.0.0.1:${PORT} <you>@<this-computer>
    then open http://127.0.0.1:${PORT} there.

  Never expose it to the internet (no port forwarding, no Tailscale Funnel).
  ORCA is by Operio: https://make.operio.work

EOF
