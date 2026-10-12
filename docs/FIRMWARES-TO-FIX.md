# Firmwares to fix — list for 2026-10-13

Built 2026-10-12 from the live data, so tomorrow starts from facts. Scope stays **compatibility only** (CLAUDE.md
"Scope"): builds against the shim, flashes from the phone, mirrors, takes phone keys. No app feature work.

**Sources** (re-runnable): `site/public/data/history.json` (every build-app run up to 2026-10-09 19:00 UTC) + the
GitHub runs after it with each failed run's `failure.json`; `apps/verdicts.json` (latest verdict per app and target);
PostHog `flash_finished` failures (the proxy's daily `/api/flash-failures` files them as `flash-failed` issues).
"Tries" = build attempts for that repo and target, our own catalog rebuilds included, so it is only a rough demand signal.

Status after Lane A (984fb1d, 2026-10-12): 79 repo × target pairs; **44 build now**; 35 do not — 30 refused by design
(the app offers the LauncherHub prebuilt) + **5 need the arduino-esp32 3.x track** (Evil-M5Core2 × 2, m5stick-nemo,
ESP32-Bus-Pirate, cardputer-ai); none is fixable on 2.0.17 today. From the validator's recount (78 pairs, 43 build,
7 fixable, 28 refused): Game-Station builds (+1 build), marivaaldo's pair became a refusal (+1 refused), serialgeist's
bare-S3 pair is new and refused (+1 pair, +1 refused). "Built" = the run has parts and no `failure.json`:
since 07d6701 a designed refusal ends with a GREEN run plus `failure.json` (flock-you is one), so a green run alone
no longer means built.

## 1. Flashes, then fails on the board (runtime)

| App | Target | Evidence | Next step |
|---|---|---|---|
| **Pigtail** (benbaker76/Pigtail) | bare S3 | **FIXED 7e5303d** [REAL, phone, public verdict #123 works]. Cause measured 2026-10-12: the shim's static 32 KB RLE stage left ~92 KB of internal DMA RAM, below the ~117 KB Pigtail's Wi-Fi + BLE take at init -> interrupt-watchdog loop in BLE controller init. Upstream and our overlay without the shim both booted (libs cleared). Fix: 4 KB static stage floor + a 32 KB internal boost taken once at the first HELLO_ACK only if 120 KB stays free (Pigtail stays on the floor, stellar-map boosts and keeps its throughput). | Cardputer ADV target (#9): re-test on a real ADV. |
| stellar-map | Cardputer ADV | 2 of 4 verdicts broken (latest 2026-09-22): `boots=0 hello=false frames=0`, from other people's phones, board unknown. The same firmware has "works" verdicts beside the "broken" ones, so these look like a wrong board or a transient, not a firmware bug [INFERRED by the validator from the same-firmware works/broken pairs]. | Idea (needs a spike first): the flasher reads the flash size from the ROM and warns when the target doesn't match the board. SPEC 8 (true board in HELLO) makes future verdicts say which board they ran on. |
| Cardputer System Monitor | Cardputer ADV | Latest verdict broken (2026-09-22), same `no HELLO` signature; works on the bare devkit (#109). Likely board mismatch or transient, as for stellar-map [INFERRED]. | Same as stellar-map. |
| M5PORKCHOP | Cardputer ADV | Manual "broken" (2026-09-25); works on the bare devkit (#93, #104). | Re-test the ADV target on a real ADV. |
| `droidputter` | bare ESP32-S3 | One broken verdict 2026-09-19 (`no HELLO`), app name `droidputter`, repo unknown. Likely board mismatch or transient, as for stellar-map [INFERRED]. | Look up what was built under that name. Probably a test build, then nothing to fix [INFERRED]. |

## 2. Build fails we can fix (latest attempt failed, not a refusal)

| Repo | Target | Tries | Error (latest) | Cause and fix |
|---|---|---|---|---|
| 7h30th3r0n3/Evil-M5Core2 | both | 11 + 11 | `'function' does not name a type; did you mean 'union'?` | **3.x TRACK** (2026-10-12). SPIKED [REAL]: not `std::function`. PlatformIO's `.ino` converter (`pioino.py` `PROTOTYPE_RE`) matches 16 JavaScript functions inside 9 raw strings of the 56,213-line sketch and emits them as C++ prototypes. Upstream asks for M5Stack core <= 2.1.4 (a 2.x app). A PlatformIO pre-script that ignores prototype matches inside raw strings removed all 16 [REAL local]; the build then stops on arduino-esp32 3.x framework types missing from 2.0.17 (`esp_now_recv_info_t`, HID `KEY_*` constants) plus 14 sketch functions PlatformIO's prototype regex misses. So today's sketch is a 3.x app despite its README; the pre-script is NOT landed (no green build from it). |
| geo-tp/Cardputer-Game-Station-Emulators | bare S3 | 10 | `'Wire' was not declared in this scope` | **FIXED 984fb1d** [REAL CI run 38247057067: parts, RAM 42.6 %, flash 98.5 %]. SPIKED [REAL chain]: gnu++17 deduction-guide clash -> the gnu++14 retry -> `'Wire' was not declared` in `src/share/input.cpp`, which reaches Wire only through M5Cardputer.h -> M5Unified -> M5GFX `common.hpp` `#if __has_include(<Wire.h>)`. Cause [INFERRED]: our `lib_ldf_mode = deep+` evaluates that `#if` as false, so the Wire library never reaches the include path (upstream uses PlatformIO's default chain mode). A blanket Wire.h force-include is REFUTED (fix/compat-retry: specreg.h's `#define PS 230` breaks the Atari core). Fix: `Wire` as a per-repo lib dep (EXTRA_LIB_DEPS); then the link failed on its non-static `INLINE` C functions, because the overlay dropped upstream's `build_src_flags` (-O3): now carried (merged with a recipe's own key). Phone check: Lane B. |
| marivaaldo/ESP32Marauder | bare S3 | 5 | `missing-header: …/User_Setup_marauder_m5cardputer.h` | **DROPPED 984fb1d -> refusal** [REAL CI run 38247156414: green + failure.json unsupported-graphics; serialgeist run 38247090442 the same]. Our TFT_RECIPES entry didn't apply (`env_src "(ino)"`): the fork's layout differs. SPIKED 2026-10-12: the fork is Marauder v1.1.0 (last commit 2024-11-19), no MARAUDER_CARDPUTER anywhere, no m5cardputer User_Setup -> it can never build for the Cardputer: DROP it from TFT_RECIPES (then it refuses like any TFT_eSPI app and offers the prebuilt); ini identity check for the others. serialgeist/ESP32Marauder (also in TFT_RECIPES, never built for the bare S3) is the same [REAL]: last push 2024-02-15, 0 `CARDPUTER` in configs.h, no m5cardputer User_Setup -> drop it too. |
| n0xa/m5stick-nemo | bare S3 | 4 | `no matching function for call to 'BLEAdvertisementData::addData(String)'` | **3.x TRACK**. SPIKED 2026-10-12 [REAL]: not a lib pin. nemo's own CI builds on `m5stack:esp32@3.2.5` (arduino-esp32 3.x) with `-DCARDPUTER`; `addData(String)` is the 3.x BLE API. 3.x track, like the two below. |
| geo-tp/ESP32-Bus-Pirate | bare S3 | 6 | `'RMT_MEM_NUM_BLOCKS_2' was not declared` (an arduino-esp32 3.x app) | Needs the 3.x toolchain track; not fixable on 2.0.17. Classify as refusal "needs core 3.x" so it stops looking fixable. |
| therezor/cardputer-ai | bare S3 | 3 | `ambiguating new declaration of 'uint32_t millis()'` (3.x app) | Same as above: 3.x track. |

## 3. Refused by design (no mirror possible yet; the app offers the prebuilt)

Most requested first. These are milestones, not bugs:

- **Bruce** — BruceDevices/firmware (17 + 13 tries), bmorcelli/Bruce (2 + 2): TFT_eSPI **and** arduino-esp32 3.x. Needs the 3.x toolchain track plus the TFT_eSPI shim on it.
- **M5Stick-Launcher** (11 + 6), bmorcelli/Launcher (2): Arduino_GFX. Needs an Arduino_GFX shim.
- **Marauder on the Cardputer ADV target** — justcallmekoko (2), marivaaldo (3), serialgeist (2): the TFT_eSPI recipe is bare-S3 only. The marivaaldo and serialgeist forks refuse on both targets since 984fb1d (their trees predate Marauder's Cardputer support). Needs ADV-target support (real TFT + mirror + real keyboard).
- **ESP-IDF / MicroPython** (`not-arduino`): MicroHydra (5), uiflow-micropython (4 + 2), Flipper-Zero-ESP32-ADV (3 + 2), m5cardputer_doom (3 + 2), Sor3nt Flipper-Zero port (2), M5Gemini (2), M5Cardputer-UserDemo (2), AdvanceOS (2), GLIDE-Synth (2), mostly-a-Flipper (2), M5Apps (2), WiFi-BLE-Radar (2), xiaozhi-esp32 (1 + 1). An ESP-IDF shim would be a new milestone.

## 4. Flash failures (phone → board)

| Issue | Status |
|---|---|
| #115 `FLASH_DEFL_BEGIN timed out` (4 failures, 4 apps) | Closed: all were our own test flashes; the link-reconnect race is fixed in v0.0.8 (e3a9e71). Reopens by itself if it comes back. |
| #116 `Error writing N bytes … rc=-N` (1) | Same as #115. |

New failure kinds from real users show up as `flash-failed` issues, created daily between 12:00 and 12:59 UTC (09:00 in São Paulo) by the proxy.
