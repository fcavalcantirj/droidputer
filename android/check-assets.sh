#!/usr/bin/env bash
# Fails when a built APK/AAB lacks the assets the app opens at run time. v0.0.1..v0.0.6 shipped with NO assets
# (the copy tasks never ran) and "Replay fixture" crashed with FileNotFoundException for Play users (2026-10-09).
# Usage: check-assets.sh <app.apk|app.aab>...   (an AAB keeps them under base/assets/)
set -euo pipefail
REQUIRED=(fixtures/pense-bem/boot.bin fixtures/pense-bem/boot.jsonl catalog/catalog.json catalog/verdicts.json)
status=0
for pkg in "$@"; do
  prefix="assets/"; [[ "$pkg" == *.aab ]] && prefix="base/assets/"
  listing=$(unzip -Z1 "$pkg")
  for a in "${REQUIRED[@]}"; do
    if ! grep -qx "$prefix$a" <<<"$listing"; then echo "::error::$pkg is missing $prefix$a"; status=1; fi
  done
  [ $status -eq 0 ] && echo "assets ok: $pkg"
done
exit $status
