#!/usr/bin/env bash
# Materialise the patched TFT_eSPI for an app overlay that draws through TFT_eSPI (ESP32Marauder, ...): copies
# pristine bodmer/TFT_eSPI 2.5.43 into <app>/lib/TFT_eSPI and applies shim/patches/TFT_eSPI-2.5.43-droidputter.patch,
# which adds the DROIDPUTTER virtual processor (built with -DDROIDPUTTER_VIRTUAL: no SPI, no pins, every pixel to the
# phone). The same patch applies to 2.5.34 (Marauder's own CI pin) and to Bruce's vendored 2.5.43 with `patch -l -F3`.
# Pristine source from PlatformIO's global library storage, picked by VERSION (library.json), downloaded once with
# `pio pkg install -g` when missing -- same rules and portability as shim/apply.sh.
# Usage: shim/apply-tft.sh <app-dir>
set -euo pipefail
APP=${1:?app dir (e.g. apps/esp32marauder)}
HERE=$(cd "$(dirname "$0")" && pwd)
TFT_VER=2.5.43
CORE=${PLATFORMIO_CORE_DIR:-$HOME/.platformio}
PIO=${PIO:-$(command -v pio || echo "$CORE/penv/bin/pio")}

lib_version() {   # <lib-dir> -> version from its library.json ("" if none)
  python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("version", ""))' "$1/library.json" 2>/dev/null || true
}
find_lib() {   # <storage-dir> <Name> <version> -> the folder holding exactly that version
  local d
  for d in "$1/$2@$3" "$1/$2" "$1/$2"@*; do
    [ -d "$d" ] && [ "$(lib_version "$d")" = "$3" ] && { echo "$d"; return 0; }
  done
  return 1
}

TFT=$(find_lib "$CORE/lib" TFT_eSPI "$TFT_VER" || true)
if [ -z "$TFT" ]; then
  TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
  (cd "$TMP" && "$PIO" pkg install -g --skip-dependencies -l "bodmer/TFT_eSPI@$TFT_VER" >/dev/null)
  TFT=$(find_lib "$CORE/lib" TFT_eSPI "$TFT_VER")
fi

mkdir -p "$APP/lib"; rm -rf "$APP/lib/TFT_eSPI"
cp -R "$TFT" "$APP/lib/TFT_eSPI"
rm -rf "$APP/lib/TFT_eSPI/examples"   # 300+ sketches PlatformIO would otherwise scan
(cd "$APP/lib" && patch -p1 < "$HERE/patches/TFT_eSPI-$TFT_VER-droidputter.patch" >/dev/null)
echo "patched TFT_eSPI $TFT_VER ready in $APP/lib (from $TFT + droidputter virtual processor)"
