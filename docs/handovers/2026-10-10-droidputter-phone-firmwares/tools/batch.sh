#!/usr/bin/env bash
# Most-requested firmwares, one after another, through the phone. One block of lines per app in batch.log.
cd "$(dirname "$0")"
export ADB_MDNS_OPENSCREEN=0
for spec in "wisnc/stellar-map stellar" "m5stack/M5Cardputer m5cardputer" "benbaker76/Pigtail pigtail" "urtubia/miniacid miniacid" "geo-tp/Ultimate-Remote ultremote" "geo-tp/Bluetooth-Keyboard-Mouse-Emulator btkbd" "adammelancon/cardputer-iss-tracker iss" "VolosR/Cardputer volos" "joejee90/Tiny-Journal journal" "gdantas04/Cardputer-System-Monitor sysmon" "cyberwisk/m5Cardputer_audiospectrum spectrum" "cyberwisk/M5Cardputer_WebRadio webradio"; do
  repo=${spec%% *}; tag=${spec##* }
  echo "=== $repo ($(date -u +%H:%M:%S)) battery $(timeout 10 adb -s 192.168.0.169:36483 shell dumpsys battery 2>/dev/null | awk '/level/{print $2; exit}')%"
  timeout 1200 bash flash_app.sh "$repo" "b-$tag" 2>&1
  echo "exit=$?"
done
echo "=== BATCH DONE $(date -u +%H:%M:%S)"
