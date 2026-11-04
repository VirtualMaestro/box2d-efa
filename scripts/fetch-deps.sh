#!/usr/bin/env bash
# Fetch the sources at the SHAs pinned in scripts/versions.json. Idempotent: skips what is already at its pin.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
ROOT="$(dirname "$DIR")"

for NAME in box2d3-wasm box2d box2cpp; do
  # The path goes in as an argument, so Git Bash (MSYS) converts it for a Windows node.
  SHA="$(node -p "require(process.argv[1])[process.argv[2]].sha" "$DIR/versions.json" "$NAME")"
  REPO="$(node -p "require(process.argv[1])[process.argv[2]].repo" "$DIR/versions.json" "$NAME")"
  DEST="$ROOT/deps/$NAME"

  if [ -d "$DEST/.git" ] && [ "$(git -C "$DEST" rev-parse HEAD 2>/dev/null)" = "$SHA" ]; then
    # The same SHA with changed files would build something other than the pin.
    if [ -n "$(git -C "$DEST" status --porcelain)" ]; then
      echo "deps/$NAME has local changes; the build must use the pin as it is. Remove deps/$NAME to fetch it again." >&2
      exit 1
    fi
    echo "$NAME already at $SHA"
  else
    rm -rf "$DEST"
    mkdir -p "$DEST"
    git -C "$DEST" init -q
    git -C "$DEST" remote add origin "$REPO"
    git -C "$DEST" fetch -q --depth 1 origin "$SHA"
    git -C "$DEST" checkout -q FETCH_HEAD
    echo "$NAME fetched at $SHA"
  fi
done
