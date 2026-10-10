---
slug: droidputter-phone-firmwares
date: 2026-10-10
status: open
round: 0
author_session: 2026-10-09/10 Claude Code session in ~/dev/droidputter (context ~97%): stats-site redesign, burn counter + toast, M4 (TFT_eSPI) for Marauder, phone driven over wireless ADB
---

# Handover — Droidputter: the most-requested catalog apps working end to end on Felipe's phone

> Builder: write `PLAN-r1.md` beside this file. The author reviews it before you execute anything.

## Mission

Droidputter (Android app `com.droidputter`, label "Droidputer") makes an Android phone the screen, keyboard and GPS
of an ESP32-S3 on USB-OTG; the ESP runs Cardputer apps rebuilt against the shim. Felipe, 2026-10-10: make sure the
catalog apps, especially the most requested, work on his phone (build via proxy, flash from the phone, mirror, phone
keys) and fix the ones that don't — spike first, TDD, never break the others. Scope is compatibility only (CLAUDE.md
"Scope", commit 4926f17): "works" = boots, mirrors, menus navigate with phone keys. Done = the list below verified on
the phone, each with screenshot + auto-verdict, and Marauder's enter fixed or root-caused with evidence.

## Where things stand (verified)

- [REAL] main = c09487b plus bot commits (`verdicts: #NN`): always `git pull --rebase` before pushing.
- [REAL] Phone Xiaomi 2412DPC0AG, Android 16, 192.168.0.169, Droidputter 0.0.7 from Play, analytics + verdict sharing
  consented by Felipe. Test board on its OTG port: bare ESP32-S3-N16R8 devkit, serial 7C:4F:AD:B7:76:B8 (a Droidputter
  test board since 2026-09-16; Felipe OK'd flashing it through the app).
- [REAL] Wireless ADB paired with this Mac. adb hangs here unless `export ADB_MDNS_OPENSCREEN=0` before the server
  starts; discover the port with `dns-sd -B _adb-tls-connect._tcp local.` then `dns-sd -L <instance> ...`.
- [REAL] Driver scripts in `tools/` beside this file: `ph.py` (UI dump/tap by label/keys/screenshot), `flash_app.sh
  <owner/repo> <tag>` (Catalog -> Build any GitHub repo -> bare ESP32-S3 -> wait Ready -> Flash from phone -> auto-verdict
  line -> screenshot), `batch.sh` (12 apps). Edit `DEV` in ph.py / `D` in flash_app.sh if the port changed.
- [REAL] Results so far (proxy builds, flashed from the phone):
  - stellar-map (shim 8c79bc8): flashed+verified, auto-verdict works, 710 frames in 20 s (#96); phone keys typed a date.
  - M5PORKCHOP (a551151): verified, mirrors, menu opens with the backtick key (#93).
  - ESP32Marauder (8c79bc8): verified, mirrors, arrows move one row per tap. OPEN BUG below.
  - Batch for the other 11 was running (log `tools/batch-2026-10-10-partial.log`): re-run what is missing.
- [REAL] Marauder support (on main): `shim/patches/TFT_eSPI-2.5.43-droidputter.patch` + `shim/apply-tft.sh`;
  `dp_kbdmatrix.{h,cpp}` + `dp_kbdmap.h` (Cardputer GPIO keyboard-matrix emulation); `dp_appserial.h` (app-side
  output-only Serial, build_src_flags); overlay recipe `TFT_RECIPES` (virtual env only). Other overlays generate
  byte-identical ini (checked for 5 repos + 2 refusals). Shim native tests 36/36 (`cd shim && pio test -e native`).
- [REAL] OPEN BUG: Marauder enter on a menu item shows the submenu for one frame (~330 ms, screen recording) and then the
  top menu again; USB link stays up (no reset). Not caused by the shim's 2-poll tap visibility (fixed for level-polling
  apps in 8c79bc8 with red/green tests, behaviour unchanged). c09487b adds a per-scan key trace: LOG frames
  `kbd scan=N t=ms keys=x,y;` on every key-set change, visible with `adb logcat -d | grep Droidputter`.
- [UNVERIFIED] PORKCHOP's right edge keeps old pixels from its boot splash (app or mirror? not established).

## Blocking constraints (builder: restate these before planning)
1. Compatibility only: never operate, test or extend app features beyond boot/mirror/menu navigation; never edit app
   sources (overlays and shim only).
2. Never break the others: a shim/overlay change must leave every other overlay's generated ini identical (diff old vs
   new generator) and pass shim native tests; CI runs only in batches of <= 3 (failures email Felipe).
3. Spike before plan, TDD for fixes: a failing test (red) before the fix, then green; mutants for mapping logic.
4. Never change `com.droidputter`, shim identifiers or the proxy domain. Never flash anything except via the app on the
   phone's devkit; never touch the bedside T-Display-S3 or the ESP32-C5 nurse-bell board.
5. Secrets: Play key only in `~/.config/droidputter/play-service-account.json` and Vercel env; never printed.
6. Felipe uses the phone too: ask for a hands-off window before a recorded test (AskUserQuestion).

## Accepted residuals / Refuted — don't fix
- Refuted: "enter reboots Marauder" — no USB re-enumeration, no new HELLO; it returns to the top menu.
- Refuted: "Marauder needs 2 scans per tap removed" — fixed anyway, bug persists.
- Refuted: GA Realtime test with headless Chrome — GA drops the HeadlessChrome UA; use a normal UA.
- The auto-verdict board name says "cardputer-adv" for bare-S3 builds (cosmetic, known).

## Hard rules & human-reserved decisions
- Commit + push verified work without asking; tags only on Felipe's word.
- Whether a firmware that cannot work gets a "use the prebuilt" refusal instead IS FELIPE'S CALL.

## Acceptance checklist (the author approves the plan ONLY against these)
1. Restates the 6 constraints; says how the phone is reconnected (port discovery) and how hands-off windows are asked.
2. Marauder enter: first step = flash c09487b's build via the phone, press enter once, read the key trace; the plan
   branches on the measured result (one scan vs two) with the exact next experiment for each — no guessed root cause.
3. Lists the apps to verify (most requested first: M5Cardputer examples, Pigtail, miniacid, Ultimate-Remote, BT keyboard,
   ISS tracker, VolosR Cardputer, Tiny-Journal, System Monitor, audiospectrum, WebRadio) and the evidence per app
   (proxy shim sha, flash verified, auto-verdict line, screenshot, one key press).
4. Any fix: red test first, old-vs-new ini identity check, CI batch <= 3, then the phone re-test.
5. Journal (`progress.txt`) + Solvr room `droidputter` posts per milestone.

## next_action
After APPROVED: reconnect ADB (`export ADB_MDNS_OPENSCREEN=0`; dns-sd for the port), ask Felipe for a hands-off window,
run `tools/flash_app.sh justcallmekoko/ESP32Marauder m-trace`, press enter once, read the key trace in logcat.

## Open questions
1. If Marauder's own menu flow is the cause (one scan), is a compatibility shim on the input side acceptable to Felipe?

## Pointers
- `progress.txt` (2026-10-10 entries), `CLAUDE.md` (Scope), `AGENTS.md`, `tools/overlay.py` (TFT_RECIPES, ENV_TEMPLATE).
- Shim: `shim/lib/DroidputterShim/src/` (dp_keys, dp_kbdmatrix, dp_kbdmap, dp_appserial), tests `shim/test/`.
- Memory: reference-droidputter-phone-wireless-adb, feedback-droidputter-scope-compat-not-pentest.
