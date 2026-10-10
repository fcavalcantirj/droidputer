#!/usr/bin/env bash
# One catalog run on the phone: Catalog -> "Build any GitHub repo" <owner/repo> (bare ESP32-S3) -> wait Ready ->
# Flash from phone -> wait "done:" -> 22 s post-flash check -> back to the mirror -> screenshot <tag>.
# Usage: flash_app.sh <owner/repo> <tag>
set -u
REPO=$1; TAG=$2
cd "$(dirname "$0")"
export ADB_MDNS_OPENSCREEN=0
D=192.168.0.169:36483
ph() { python3 -I ph.py "$@"; }
key() { timeout 10 adb -s $D shell input keyevent "$1"; }
ts() { date -u +%H:%M:%S; }

front() {   # Droidputter in front, on its mirror screen (Catalog visible)
  for _ in 1 2 3 4; do
    ph texts 2>/dev/null | grep -qx "Catalog" && return 0
    if timeout 10 adb -s $D shell dumpsys window 2>/dev/null | grep -q "mCurrentFocus=.*com.droidputter"; then key 4; else timeout 15 adb -s $D shell monkey -p com.droidputter -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1; fi
    sleep 2
  done
  ph texts 2>/dev/null | grep -qx "Catalog"
}
front || { echo "$(ts) app not in front"; exit 1; }
ph tap Catalog >/dev/null || { echo "$(ts) no Catalog button"; exit 1; }
sleep 2
ph tap "Droidputer builds" >/dev/null 2>&1; sleep 1
ph tap "bare ESP32-S3" >/dev/null 2>&1; sleep 1
# reveal the repo field
for _ in 1 2 3 4; do ph texts | grep -q "Build any GitHub repo" && break; timeout 10 adb -s $D shell input swipe 1356 800 1356 600 300; sleep 1; done
ph tap "Build any GitHub repo: owner/repo or URL" >/dev/null || { echo "$(ts) no repo field"; exit 1; }
sleep 1
timeout 10 adb -s $D shell input keyevent 123; for _ in $(seq 1 40); do key 67 >/dev/null; done   # clear the field
timeout 10 adb -s $D shell input text "$REPO"; sleep 1; key 111; sleep 1
echo "$(ts) build requested: $REPO"
ph tap Build >/dev/null || { echo "$(ts) no Build button"; exit 1; }
# wait for the build: Ready (cached or fresh CI) or a refusal / failure
for i in $(seq 1 150); do
  t=$(ph texts 2>/dev/null | tr '\n' '|')
  if echo "$t" | grep -qE "Built on demand|Parts\|"; then   # build detail open: the Flash button sits below the fold
    for _ in 1 2 3 4 5 6; do ph texts 2>/dev/null | grep -q "Flash from phone" && break; timeout 10 adb -s $D shell input swipe 1356 900 1356 500 300; sleep 1; done
    t=$(ph texts 2>/dev/null | tr '\n' '|')
  fi
  if echo "$t" | grep -q "Flash from phone"; then echo "$(ts) ready"; break; fi
  if echo "$t" | grep -qiE "refused|failed|cannot|error"; then echo "$(ts) BUILD NOT READY: $(echo "$t" | grep -oiE '[^|]*(refused|failed|cannot|error)[^|]*' | head -2)"; exit 2; fi
  sleep 4
done
echo "$t" | grep -q "Flash from phone" || { echo "$(ts) build timeout"; exit 3; }
echo "$(ts) $(echo "$t" | grep -oE 'shim [0-9a-f]{7}' | head -1) $(echo "$t" | grep -oE 'firmware.bin  [0-9]+ B' | head -1)"
ph tap "Flash from phone" >/dev/null
echo "$(ts) flashing"; sleep 6   # the previous run's FAILED: line stays on screen until the new flash replaces it
for i in $(seq 1 60); do
  t=$(ph texts 2>/dev/null | tr '\n' '|')
  if echo "$t" | grep -qE "done: .*flashed and verified"; then echo "$(ts) $(echo "$t" | grep -oE 'done: [^|]*' | head -1)"; break; fi
  if echo "$t" | grep -qiE "flash failed|error:|FAILED:"; then echo "$(ts) FLASH FAILED: $(echo "$t" | grep -oiE '[^|]*(failed|error)[^|]*' | head -2)"; exit 4; fi
  sleep 3
done
for i in $(seq 1 12); do
  v=$(ph texts 2>/dev/null | grep -m1 -oE "auto-verdict [^|]*")
  [ -n "$v" ] && break
  sleep 3
done
echo "$(ts) ${v:-no auto-verdict line seen}"
front
sleep 2
ph shot "$TAG" >/dev/null
echo "$(ts) screenshot $TAG; status: $(ph texts 2>/dev/null | grep -E 'LINKED|DETACHED|OPEN|RECONNECT|ERROR' | head -1)"
