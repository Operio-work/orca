#!/usr/bin/env bash
# Deploy make.operio.work: build, back up what is live, then rsync build/ to box1.
#
#   scripts/deploy.sh             build + back up + upload
#   scripts/deploy.sh --dry-run   build, then show what rsync would change (no backup, no upload)
#   scripts/deploy.sh --no-build  upload the existing build/ as is
#
# Overrides (environment): DEPLOY_TARGET (default deploy@box1),
# DEPLOY_DIR (default /var/www/make.operio.work), DEPLOY_BACKUPS (default ~deploy/backups/make.operio.work),
# DEPLOY_KEEP (backups to keep, default 10), SITE_URL (default https://make.operio.work).
set -euo pipefail

TARGET="${DEPLOY_TARGET:-deploy@box1}"
DIR="${DEPLOY_DIR:-/var/www/make.operio.work}"
BACKUPS="${DEPLOY_BACKUPS:-backups/make.operio.work}"   # relative = inside the deploy user's home
KEEP="${DEPLOY_KEEP:-10}"
SITE_URL="${SITE_URL:-https://make.operio.work}"
DRY=0
BUILD=1

for arg in "$@"; do
  case "$arg" in
    --dry-run|-n) DRY=1 ;;
    --no-build) BUILD=0 ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

cd "$(dirname "$0")/.."
say() { printf '\033[1;33m▸\033[0m %s\n' "$*"; }

command -v rsync >/dev/null || { echo "rsync is not installed" >&2; exit 1; }

if [ "$BUILD" = 1 ]; then
  say "installing dependencies and building (with the prerender checks)"
  npm ci --no-audit --no-fund
  npm run build
fi
if [ ! -f build/index.html ] || [ ! -f build/install.sh ] || ! ls build/releases/*.tar.gz >/dev/null 2>&1; then
  echo "build/ is incomplete; run npm run build" >&2; exit 1
fi

RSYNC=(rsync -az --human-readable --itemize-changes)
[ "$DRY" = 1 ] && RSYNC+=(--dry-run)

if [ "$DRY" = 1 ]; then
  say "dry run: changes rsync would make on $TARGET:$DIR"
  "${RSYNC[@]}" --delete build/ "$TARGET:$DIR/"
  say "dry run only: nothing was backed up or uploaded"
  exit 0
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
say "backing up the live site to $TARGET:~/$BACKUPS/$STAMP (keeping the last $KEEP)"
ssh "$TARGET" "set -e; mkdir -p '$DIR' \"\$HOME/$BACKUPS\";
  if [ -n \"\$(ls -A '$DIR' 2>/dev/null)\" ]; then cp -a '$DIR' \"\$HOME/$BACKUPS/$STAMP\"; fi;
  ls -1d \"\$HOME/$BACKUPS\"/*/ 2>/dev/null | sort | head -n -$KEEP | xargs -r rm -rf"

# Hashed assets first (never deleted mid-deploy), then the pages, then remove what is gone.
say "uploading assets"
"${RSYNC[@]}" build/_app/ "$TARGET:$DIR/_app/"
say "uploading pages and removing stale files"
"${RSYNC[@]}" --delete build/ "$TARGET:$DIR/"

say "checking the live site"
fail=0
for path in / /es /catalog /install /install.sh /sitemap.xml; do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$SITE_URL$path" || true)"
  printf '  %-14s %s\n' "$path" "$code"
  [ "$code" = 200 ] || fail=1
done
type="$(curl -sI --max-time 15 "$SITE_URL/install.sh" | tr -d '\r' | awk -F': ' 'tolower($1)=="content-type"{print $2}')"
printf '  install.sh type: %s\n' "${type:-?}"
case "$type" in text/plain*) ;; *) fail=1 ;; esac
# The live panel tarball must match the sha256 the live install.sh pins.
pinned="$(curl -fsS --max-time 15 "$SITE_URL/install.sh" | sed -n 's/^PANEL_SHA256="\([0-9a-f]*\)".*/\1/p' | head -1 || true)"
pver="$(sed -n 's/^PANEL_VERSION="\([^"]*\)".*/\1/p' build/install.sh | head -1)"
live="$(curl -fsS --max-time 60 "$SITE_URL/releases/free-orca-$pver.tar.gz" | { sha256sum 2>/dev/null || shasum -a 256; } | awk '{print $1}' || true)"
printf '  panel tarball: %s (pinned %s)\n' "${live:-?}" "${pinned:-?}"
[ -n "$pinned" ] && [ "$live" = "$pinned" ] || fail=1

if [ "$fail" = 1 ]; then
  echo "Live check failed. Roll back with:" >&2
  echo "  ssh $TARGET 'rsync -a --delete ~/$BACKUPS/$STAMP/ $DIR/'" >&2
  exit 1
fi
say "deployed $STAMP"
