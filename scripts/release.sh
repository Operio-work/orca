#!/usr/bin/env bash
# Build the panel release tarball, byte-for-byte reproducible:
#
#   scripts/release.sh            write dist/operio-orca-<version>.tar.gz and its .sha256
#   scripts/release.sh --check    also fail unless the sha256 equals PANEL_SHA256 in install.sh
#   scripts/release.sh --ref REF  build from another commit or tag
#
# The content comes from git, never from the working tree: the tag v<version> when it exists,
# otherwise HEAD. Uncommitted changes are never in the tarball (you get a warning).
# Same commit in, same bytes out: names sorted, mtime fixed to the release date in
# CHANGELOG.md, owner 0:0, modes normalised, gzip -n (no name or time in the header).
#
# install.sh is NOT in the tarball: it pins this tarball's sha256, so hashing itself would
# loop. Also left out: the website (site/), tests, demo screenshots, docs and design notes.
# node_modules is never shipped; the installer runs `npm ci` against package-lock.json,
# whose integrity hashes pin web-push and its dependencies.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd -P)"

REF=""
CHECK=0
while [ $# -gt 0 ]; do
  case "$1" in
    --ref) [ $# -ge 2 ] || { echo "--ref needs a value" >&2; exit 2; }; REF="$2"; shift 2 ;;
    --check) CHECK=1; shift ;;
    -h|--help) sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

# What the installer copies into ~/.local/share/operio-orca/app.
INCLUDE=(
  LICENSE THIRD_PARTY_NOTICES.md README.md README.es.md CHANGELOG.md
  package.json package-lock.json server.js chips.js uninstall.sh
  bin lib public routines skills demo catalog
)
EXCLUDE=(demo/screenshots)

TAR=tar
if ! tar --version 2>/dev/null | grep -q 'GNU tar'; then
  if command -v gtar >/dev/null 2>&1; then TAR=gtar; else echo "GNU tar is required (gtar on macOS)" >&2; exit 1; fi
fi
command -v git >/dev/null || { echo "git is required" >&2; exit 1; }

VERSION="$(node -p "require('./package.json').version")"
NAME="operio-orca-${VERSION}"

if [ -z "$REF" ]; then
  if git rev-parse -q --verify "refs/tags/v${VERSION}" >/dev/null; then REF="v${VERSION}"; else REF="HEAD"; fi
fi
COMMIT="$(git rev-parse --verify "${REF}^{commit}")"

# The tarball must carry the version it is named after.
REF_VERSION="$(git show "${COMMIT}:package.json" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).version))')"
[ "$REF_VERSION" = "$VERSION" ] || { echo "package.json at $REF is $REF_VERSION, not $VERSION" >&2; exit 1; }

# Fixed timestamp: the release date from CHANGELOG.md at that commit ("## [0.1.0] - 2026-11-09").
DATE="$(git show "${COMMIT}:CHANGELOG.md" 2>/dev/null | sed -n "s/^## \[${VERSION//./\\.}\] - \([0-9-]\{10\}\).*/\1/p" | head -1)"
[ -n "$DATE" ] || { echo "CHANGELOG.md at $REF has no '## [${VERSION}] - YYYY-MM-DD' line" >&2; exit 1; }
EPOCH="$(date -u -d "${DATE}T00:00:00Z" +%s 2>/dev/null || date -u -j -f '%Y-%m-%dT%H:%M:%SZ' "${DATE}T00:00:00Z" +%s)"

if [ "$REF" = HEAD ] && [ -n "$(git status --porcelain -- "${INCLUDE[@]}")" ]; then
  echo "warning: uncommitted changes in released files are NOT in the tarball (built from HEAD ${COMMIT:0:7})" >&2
fi

STAGE="$(mktemp -d "${TMPDIR:-/tmp}/operio-orca-release.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT
umask 022
mkdir -p "$STAGE/$NAME"
git archive --format=tar "$COMMIT" -- "${INCLUDE[@]}" | "$TAR" -xf - -C "$STAGE/$NAME"
for x in "${EXCLUDE[@]}"; do rm -rf "${STAGE:?}/$NAME/$x"; done
[ ! -e "$STAGE/$NAME/install.sh" ] || { echo "install.sh must not be in the tarball" >&2; exit 1; }

mkdir -p dist
OUT="dist/${NAME}.tar.gz"
"$TAR" --sort=name --format=gnu --mtime="@${EPOCH}" --owner=0 --group=0 --numeric-owner \
  --mode='u+rw,go-w,a+rX' -cf - -C "$STAGE" "$NAME" | gzip -9 -n > "$OUT.tmp"
mv -f "$OUT.tmp" "$OUT"

if command -v sha256sum >/dev/null; then SUM="$(sha256sum "$OUT" | awk '{print $1}')"
else SUM="$(shasum -a 256 "$OUT" | awk '{print $1}')"; fi
printf '%s  %s\n' "$SUM" "${NAME}.tar.gz" > "dist/${NAME}.tar.gz.sha256"
SIZE="$(wc -c < "$OUT" | tr -d ' ')"
FILES="$("$TAR" -tzf "$OUT" | grep -vc '/$')"

echo "built $OUT from $REF (${COMMIT:0:12}), $FILES files, $SIZE bytes"
echo "sha256 $SUM"

PINNED="$(sed -n 's/^PANEL_SHA256="\([0-9a-f]*\)".*/\1/p' "$ROOT/install.sh" | head -1)"
if [ "$CHECK" = 1 ]; then
  [ "$SUM" = "$PINNED" ] || { echo "MISMATCH: install.sh pins PANEL_SHA256=${PINNED:-<empty>}" >&2; exit 1; }
  echo "matches PANEL_SHA256 in install.sh"
elif [ "$SUM" != "$PINNED" ]; then
  echo "note: install.sh pins PANEL_SHA256=${PINNED:-<empty>}; update it to release this build" >&2
fi
