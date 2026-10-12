# Firmwares to fix — list for 2026-10-13

Built 2026-10-12 from the live data, so tomorrow starts from facts. Scope stays **compatibility only** (CLAUDE.md
"Scope"): builds against the shim, flashes from the phone, mirrors, takes phone keys. No app feature work.

**Sources** (re-runnable): `site/public/data/history.json` (every build-app run up to 2026-10-09 19:00 UTC) + the
GitHub runs after it with each failed run's `failure.json`; `apps/verdicts.json` (latest verdict per app and target);
PostHog `flash_finished` failures (the proxy's daily `/api/flash-failures` files them as `flash-failed` issues).
"Tries" = build attempts for that repo and target, our own catalog rebuilds included, so it is only a rough demand signal.

Status today: 79 repo × target pairs ever built; **45 build now**; 34 fail on their latest attempt — **7 fixable**,
27 refused by design (the app offers the LauncherHub prebuilt).

## 1. Flashes, then fails on the board (runtime)

| App | Target | Evidence | Next step |
|---|---|---|---|
| **Pigtail** (benbaker76/Pigtail) | both | Boot loop: interrupt watchdog on CPU0 in ROM BLE link-layer init (#98, #112; ADV #9). Upstream 1.0.11 prebuilt runs Wi-Fi promiscuous + BLE on the same devkit; our build of the same source and esp-idf loops. NimBLE 2.5.1 refuted (pinned 2.5.0, still loops). | Single variable next: the same overlay libs **without the shim** (needs a scratch build path; the proxy always links the shim). If that boots, bisect the shim; if it loops, M5Unified 0.2.20 → 0.2.14. |
| stellar-map | Cardputer ADV | 2 of 4 verdicts broken (latest 2026-09-22): `boots=0 hello=false frames=0`, from other people's phones, board unknown. | Find out whether those were ADV-target builds flashed onto a non-ADV board [INFERRED]. If so, the fix is in the app: warn when the target doesn't match the board. |
| Cardputer System Monitor | Cardputer ADV | Latest verdict broken (2026-09-22), same `no HELLO` signature; works on the bare devkit (#109). | Same check as stellar-map. |
| M5PORKCHOP | Cardputer ADV | Manual "broken" (2026-09-25); works on the bare devkit (#93, #104). | Re-test the ADV target on a real ADV. |
| `droidputter` | bare ESP32-S3 | One broken verdict 2026-09-19 (`no HELLO`), app name `droidputter`, repo unknown. | Look up what was built under that name. Probably a test build, then nothing to fix [INFERRED]. |

## 2. Build fails we can fix (latest attempt failed, not a refusal)

| Repo | Target | Tries | Error (latest) | Likely fix [INFERRED until spiked] |
|---|---|---|---|---|
| 7h30th3r0n3/Evil-M5Core2 | both | 11 + 11 | `'function' does not name a type; did you mean 'union'?` | `std::function` without `<functional>` / C++ standard. Overlay flag or force-include for this repo. |
| geo-tp/Cardputer-Game-Station-Emulators | bare S3 | 10 | `'Wire' was not declared in this scope` | Missing `#include <Wire.h>` that an older core pulled in. Overlay force-include. |
| marivaaldo/ESP32Marauder | bare S3 | 5 | `missing-header: …/User_Setup_marauder_m5cardputer.h` | Our TFT_RECIPES entry didn't apply (`env_src "(ino)"`): the fork's layout differs. Spike its tree, then fix the recipe or drop the fork from TFT_RECIPES. |
| n0xa/m5stick-nemo | bare S3 | 4 | `no matching function for call to 'BLEAdvertisementData::addData(String)'` | BLE library API version. Pin the BLE lib the app expects. |
| geo-tp/ESP32-Bus-Pirate | bare S3 | 6 | `'RMT_MEM_NUM_BLOCKS_2' was not declared` (an arduino-esp32 3.x app) | Needs the 3.x toolchain track; not fixable on 2.0.17. Classify as refusal "needs core 3.x" so it stops looking fixable. |
| therezor/cardputer-ai | bare S3 | 3 | `ambiguating new declaration of 'uint32_t millis()'` (3.x app) | Same as above: 3.x track. |

## 3. Refused by design (no mirror possible yet; the app offers the prebuilt)

Most requested first. These are milestones, not bugs:

- **Bruce** — BruceDevices/firmware (17 + 13 tries), bmorcelli/Bruce (2 + 2): TFT_eSPI **and** arduino-esp32 3.x. Needs the 3.x toolchain track plus the TFT_eSPI shim on it.
- **M5Stick-Launcher** (11 + 6), bmorcelli/Launcher (2): Arduino_GFX. Needs an Arduino_GFX shim.
- **Marauder on the Cardputer ADV target** — justcallmekoko (2), marivaaldo (3), serialgeist (2): the TFT_eSPI recipe is bare-S3 only. Needs ADV-target support (real TFT + mirror + real keyboard).
- **ESP-IDF / MicroPython** (`not-arduino`): MicroHydra (5), uiflow-micropython (4 + 2), Flipper-Zero-ESP32-ADV (3 + 2), m5cardputer_doom (3 + 2), Sor3nt Flipper-Zero port (2), M5Gemini (2), M5Cardputer-UserDemo (2), AdvanceOS (2), GLIDE-Synth (2), mostly-a-Flipper (2), M5Apps (2), WiFi-BLE-Radar (2), xiaozhi-esp32 (1 + 1). An ESP-IDF shim would be a new milestone.

## 4. Flash failures (phone → board)

| Issue | Status |
|---|---|
| #115 `FLASH_DEFL_BEGIN timed out` (4 failures, 4 apps) | Closed: all were our own test flashes; the link-reconnect race is fixed in v0.0.8 (e3a9e71). Reopens by itself if it comes back. |
| #116 `Error writing N bytes … rc=-N` (1) | Same as #115. |

New failure kinds from real users show up as `flash-failed` issues, created daily between 12:00 and 12:59 UTC (09:00 in São Paulo) by the proxy.
