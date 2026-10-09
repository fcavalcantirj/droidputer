---
round: 1
builder_session: 2026-10-09 fresh Claude Code session (Opus 5.5) in ~/dev/droidputter, read-only verification pass, plan mode
---

# Plan r1 — Play numbers on the stats page, M4 TFT_eSPI spike, arduino-esp32 3.x spike, v0.0.7 phone acceptance

## Blocking constraints, restated
1. Identifiers are frozen: applicationId/packages `com.droidputter`, shim names (`DroidputterShim`, `DROIDPUTTER_*`,
   `droidputter.cpp`, the patch file names) and the proxy domain `droidputter-proxy.vercel.app` never change; shipped
   APKs and installed users resolve them by name.
2. No plan for M4 or 3.x until a throwaway, timeout-guarded spike has measured it. Plans are written from the measured
   numbers; anything still a guess goes back into the spike, not into the plan.
3. Secrets live only in Vercel env of the site project `droidputer`: `POSTHOG_PERSONAL_KEY`, `POSTHOG_PROJECT_ID`, and
   the new `PLAY_SERVICE_ACCOUNT_JSON`. Never in a file in the repo, a commit, memory, a log or a tool output I print.
   The `phc_…` project token is public by design.
4. `tools/overlay.py` / shim changes must leave every build that compiles today compiling the same way. Proof = CI on
   the targets plus regression pairs, in small batches, because every failed CI run emails Felipe.
5. I never run `ralph*.sh` or any loop runner. I never flash without Felipe's explicit OK. His StickS3 only under
   backup (2 identical reads) → test → restore → read-back sha256 identical. The bedside T-Display-S3 is never touched.
6. The stats page is honest: every number names its source, no device ids or IPs leave `api/stats.js`, and
   pre-release test traffic stays out of the live panels.

## Handover discrepancies
Checked live 2026-10-09 ~18:50–19:10 UTC. Clean: v0.0.7 tag peels to `365bea7`. Local `main` = origin `main` =
`36e73cf` (handover commit). Live `/api/stats`: 17 phones, 57 flashes observed, 35 mirrored (61%), PostHog live
totals 0. `history.json` 275 runs. `replay.json` 72 pairs = 38 built / 28 clear answer / 6 still failing, 13
`unsupported-graphics` pairs over the 8 repos listed. Bruce `lib/TFT_eSPI/library.json` = 2.5.43. M5GFX patch = 8
`dp::` calls. Pins: 6.12.0 / M5Unified 0.2.20 / M5GFX 0.2.27 / M5Cardputer 1.1.1. StickS3 backup sha256
`217dd6f6…9107` matches. `CopyAssetFiles` + `addGeneratedSourceDirectory` are in `build.gradle.kts`, and
`check-assets.sh` runs in both `android.yml` and `release.yml`. `UsbLinkManager.openFailed` retries 3x and reports a
non-fatal `$exception` `where=usb_open`. Vercel env names exist. Mismatches and new facts:
1. [REAL] **Bruce is an arduino-esp32 3.x app.** `BruceDevices/firmware` and `bmorcelli/Bruce` `platformio.ini [env]`:
   `platform = …pioarduino/platform-espressif32/releases/download/55.03.39/…` plus
   `platform_packages = framework-arduinoespressif32-libs @ …bmorcelli/esp32-arduino-lib-builder…` ("Arduino 3.3.10
   with exFAT"). So Bruce cannot be the M4 spike app in today's 2.0.17 bare-S3 env. Mirroring Bruce needs M4 **and** 3.x.
2. [REAL] Marauder's Cardputer target (`build_parallel.yml`, `MARAUDER_CARDPUTER`) = Arduino IDE, `esp32:esp32@2.0.11`,
   `Bodmer/TFT_eSPI` ref `V2.5.34`, `User_Setup_marauder_m5cardputer.h` copied into the library. Its root
   `platformio.ini` is native tests only.
3. [REAL] flock-you is not a Cardputer app. Its only env is `xiao_esp32s3` (`espressif32@^6.3.0`,
   `build_src_filter = +<main.cpp>`), and TFT_eSPI appears only in `display_dongle.cpp`. `includes_in()` ignores
   `build_src_filter`, which may make its refusal a false positive. Noted only; not fixing it in this round.
4. [REAL] TFT_eSPI 2.5.43 `TFT_eSPI.cpp` (Bruce's copy) has **57 direct `tft_Write_16/32` macro writes**: drawPixel
   23, setWindow 19, drawChar 8 (the fast GLCD path), writecommand 4, readAddrWindow 2, pushColor 1. A tee on only
   setWindow/pushBlock/pushPixels/drawPixel/fillRect would miss drawChar's fast path and pushColor (see M4 spike).
5. [REAL] The shim depends on M5GFX headers: `dp_display.cpp` includes `<lgfx/v1/misc/pixelcopy.hpp>`, so a
   TFT_eSPI-only app still needs (patched) M5GFX in `lib/`. It also uses 2.0.17-specific HWCDC internals
   (`hal/usb_serial_jtag_ll.h`, the mute-after-resume re-arm), which is a 3.x risk.
6. [REAL] The PlatformIO cache holds **two** pioarduino platforms: 55.03.38 (framework src = arduino-esp32 3.3.8,
   `framework-arduinoespressif32-libs` 5.5.4) and 53.03.13. Bus-Pirate pins 55.03.37 (not cached) and Bruce pins 55.03.39.
7. [REAL, docs read today] Play Reporting: scope `https://www.googleapis.com/auth/playdeveloperreporting` (confirmed).
   `anrRateMetricSet` metrics are `anrRate`, `userPerceivedAnrRate` and `distinctUsers` (+7d/28d user-weighted, not
   HOURLY), so the open UNVERIFIED items are now documented; the first live query still gates display. **Installs are
   NOT in the Reporting API.** They exist only as Cloud Storage bulk reports:
   `gs://pubsite_prod_rev_…/stats/installs/installs_<pkg>_yyyyMM_<dimension>.csv`, posted 3–7 days late, scope
   `devstorage.read_only`, and they need "View app information" at account (global) level.
8. [REAL] Vercel env also holds `POSTHOG_KEY` (Production), which `stats.js` never reads. The `stats.js` header says
   "Cached at the edge for 60 s" but the code sets `s-maxage=120`. That comment is stale; the handover is right.
9. [REAL] The handover body names its dir `…/2026-10-09-droidputer-next/`, but the real dir is
   `2026-10-09-droidputter-next`. Untracked stray `package.json`/`package-lock.json`/`node_modules/` at the repo root
   (an `npm i vercel`) are not mine: left alone and never committed (I add explicit paths only).
10. [REAL, code read] `build_result` is sent only by `proxy/api/build/[id].js` when a phone polls. Direct
    `gh workflow run` regression runs therefore do not reach PostHog. `build-app.yml:107` copies `boot_app0.bin`
    from `framework-arduinoespressif32/tools/partitions/`, a path the 3.x spike must re-measure.

## Acceptance checklist — point-by-point
1. **SA guide** → "Step P1" below: the exact message, covering the Cloud project, enabling the API, the SA, the JSON
   key, the Play Console invite with "View app information (read-only)", and `vercel env add` from `site/` via stdin
   with no git. Before sending, I prove that exact pipe command with a dummy var and remove it (Felipe is not the test bot).
2. **`stats.js` Play block** → P2–P4. Service-account JWT (RS256, `node:crypto`, no dependency) → token → GET metric
   set `freshnessInfo` → `crashRateMetricSet:query` DAILY, the last 30 days ending at the freshest DAILY date, metrics
   `distinctUsers`, `crashRate`, `userPerceivedCrashRate`. Token is cached per warm instance; the result is cached
   30 min; everything is in try/catch so the page renders without it. **Verification:** the first real query's
   response is inspected (`curl /api/stats | jq .play`, which carries `fields_seen` = the metric names Google
   returned, plus the raw `startTime` of row 0) *before* the page section ships. ANR is requested separately and shown
   only if its first query returns `anrRate`/`userPerceivedAnrRate`.
3. **Page section** → P5: `<section id="play">` in the existing design language. Latest-value tiles; a daily-users
   line and a crash-rate line via the existing `line()`; added to `tablesFrom()` (so tables + CSV) and present in the
   JSON export (whole `DATA`). Caption: "Source: Google Play Developer Reporting API · days are Pacific time
   (America/Los_Angeles) · all versions". Not-connected and no-data states are spelled out, never blank.
4. **M4 spike** → S-M4 below. App = **ESP32Marauder (`justcallmekoko`, `MARAUDER_CARDPUTER`)**, not Bruce, because
   Bruce needs 3.x (discrepancy 1) and Marauder's Cardputer target is a 2.x app (2.0.11 + TFT_eSPI 2.5.34). Three of
   the 13 refused pairs are Marauder forks. Built in the bare-S3 env (`esp32-s3-devkitc-1`, `-DDROIDPUTTER_VIRTUAL=1`)
   with a patched TFT_eSPI that tees setWindow/pushBlock/pushPixels/drawPixel/fillRect (plus whatever the coverage
   counter shows leaking, e.g. the drawChar fast path and pushColor) into `dp::`, and never inits SPI/pins in the
   virtual env. Measured: build + sizes, HELLO, frames via `tools/dp_receiver.py --png`, and a pixel-coverage ratio.
   **Bruce 2.5.43:** the patch is written against pristine `bodmer/TFT_eSPI@2.5.43`. The spike measures
   `diff -r` of Bruce's vendored copy against pristine, `patch --dry-run` on Bruce's copy, and whether Marauder builds
   on 2.5.43. A full Bruce build waits for the 3.x result; the report says so.
5. **3.x spike** → S-3x: the shim + stellar-map (green on 6.12.0 today) on pioarduino **55.03.39** (newest pinned by a
   target app, Bruce). Staged so each failure has an owner: shim alone → + patched M5GFX 0.2.27 → + M5Unified 0.2.20 →
   stellar-map link. For each stage: error count + first 3 errors. Then the three 3.x apps (Bus-Pirate, nemo,
   cardputer-ai) are compiled in that env for a green count, and the bins/`boot_app0.bin` path are compared. Then a plan
   choosing "separate core3 env" or "migration" from those numbers.
6. **Phone acceptance** → A1–A3: I first rehearse on the emulator everything that does not need USB, then give Felipe
   a 7-step checklist. Each step maps to the PostHog event that proves it, confirmed by a time-bounded HogQL query
   ≥3 min after he finishes.
7. **Gates/journal/Solvr** → every step below names its gate; `progress.txt` is appended per deliverable; Solvr room
   `droidputter` gets `[EXEC] STATUS/DONE/BLOCKED` at each milestone; verified work is committed and pushed (no tags).

## The plan

**Order** (Felipe's priorities, parallelised where nothing blocks): P0/P1 → (while Felipe makes the SA) S-M4 builds +
P2/P3 offline → P4/P5 once the env exists → S-3x builds → one device sitting for M4 + 3.x frames (Felipe's flash OK)
→ spike reports + plans to Felipe → A1–A3.

### Play numbers
- **P0** (30 s, real system): `cd site && printf 'x' | vercel env add DP_PIPE_TEST production`, check it with
  `vercel env ls`, then `vercel env rm DP_PIPE_TEST production -y`. If the CLI demands a prompt (sensitive flag), the
  guide gets the flag that worked.
- **P1, the message to Felipe** (sent once P0 passes):
  1. https://console.cloud.google.com, signed in as the Google account that owns the Play developer account →
     project picker → New project `droidputer-stats` → Create.
  2. APIs & Services → Library → "Google Play Developer Reporting API" → Enable.
  3. IAM & Admin → Service accounts → Create service account: name `droidputer-stats`, skip the role and user steps → Done.
  4. Open it → Keys → Add key → Create new key → JSON → Create (it downloads `droidputer-stats-<id>.json`). Copy the
     SA email `droidputer-stats@<project>.iam.gserviceaccount.com`.
  5. https://play.google.com/console → Users and permissions → Invite new users → paste the SA email → App
     permissions → Add app → Droidputter → tick "View app information (read-only)" → Apply → Invite user.
     *Optional, your call:* to get install counts later, also tick on the Account permissions tab "View app
     information and download bulk reports (read-only)". This is account-wide, read-only over all your apps.
  6. Key into Vercel, no git (from the repo):
     `cd ~/dev/droidputter/site && python3 -c 'import json,sys;print(json.dumps(json.load(open(sys.argv[1]))))' ~/Downloads/droidputter-stats-<id>.json | vercel env add PLAY_SERVICE_ACCOUNT_JSON production`
     then `rm ~/Downloads/droidputter-stats-<id>.json` (Google can mint a new key anytime). Or tell me the path and
     I run the same pipe; the value is never printed. Then say "done" and I redeploy.
- **P2, code** (`site/api/stats.js`, the only file besides `index.html`): `play()` beside `posthog()`/`github()` in
  the handler's `Promise.all`.
  - `PKG = "com.droidputter"` (public).
  - JWT `{iss: client_email, scope, aud: "https://oauth2.googleapis.com/token", iat, exp: iat+3600}`, signed with
    `createSign("RSA-SHA256")`, then POST form `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer`.
  - Module-level token cache until exp−60 s, and a module-level result cache of 30 min (Play publishes daily).
  - Reuses `fetchJson` with its 25 s timeout. The crash and ANR queries run in parallel.
  - Output: `{ok, source:"Google Play Developer Reporting API", timezone:"America/Los_Angeles", freshest, daily:[{day,
    users, crash_rate, user_perceived_crash_rate, anr_rate?, user_perceived_anr_rate?}], latest, fields_seen}`.
  - Errors: `{ok:false, reason}`, truncated to 200 chars, with email-shaped strings stripped.
  - Fixing the stale "60 s" header comment is in scope.
- **P3, offline proof (scratchpad only, no repo files):** generate a throwaway RSA key (`openssl genpkey`) and a fake SA
  JSON. `crypto.verify` the JWT that `stats.js` builds. Feed a docs-shaped fixture through the row mapper. Run the
  handler with an absent var, then a malformed var, and check that `play.ok=false` and the other blocks are intact.
- **P4, first real query:** after Felipe's "done", `vercel deploy --prod --yes`, then curl `/api/stats` and read
  `.play`. Gate: `fields_seen` ⊇ the requested names, and `day` strings match LA dates. If 403 (permission still
  propagating) or empty rows (too few users for Google), the API stays fail-soft and I report the exact Google
  message; the page section is not shipped until the gate passes.
- **P5, page:** section + tiles + 2 lines + table rows + caption. Verified with headless Chrome screenshots at 390 px
  and 1280 px, light and dark, plus one preview deploy without the env var (the not-connected state renders and the
  rest of the page is unchanged). Installs: the section says "installs: Google publishes them only as monthly bulk
  reports, not connected". If Felipe ticked bulk reports, a follow-up reads the month CSV, gated by its own first real
  read; this round promises nothing more.

### S-M4 spike (throwaway: `<scratchpad>/m4`, every build `timeout 1500 … > log 2>&1`, read the saved log, never re-run to read)
1. Fetch pristine `bodmer/TFT_eSPI@2.5.43` and `@2.5.34` (`pio pkg install --storage-dir <scratch>`), plus Bruce's
   `lib/TFT_eSPI` and Marauder (shallow, sparse). Measure: the Bruce-vs-pristine diff (files/lines), the
   2.5.34-vs-2.5.43 diff on the files the patch touches, and Marauder's `#include`s (TFT_eSPI, M5Cardputer?,
   `readPixel` use).
2. Throwaway patch on 2.5.43: tee the five named paths into `dp::window/bytes/repeat/fill/pixel`. Add per-path pixel
   counters plus one **bus counter** at the `tft_Write_*`/pushBlock layer, so coverage = teed ÷ bus pixels is
   measured, not eyeballed. In the virtual env: `init()` skips SPI/pins/backlight, `readPixel` reads the shadow, and
   `setRotation`/`init` call `dp::begin` with the app geometry.
3. Coverage sketch (~40 lines, scratch): GLCD font with bg (fast path), fonts 2/4, fillScreen, lines, pushImage,
   sprite pushSprite, drawPixel, readPixel. Build it in the bare-S3 virtual env with the shim (symlink) and the patched
   libs.
4. Marauder: copy `tools/` + `shim/` into scratch and disable the TFT_eSPI refusal in the copy only. Translate
   `User_Setup_marauder_m5cardputer.h` into `-DUSER_SETUP_LOADED` + `-include`, then build in `m5cardputer-virtual`.
   Measure build, flash/RAM %, and the first errors if any.
5. Device (with Felipe's OK; the bare S3 devkit, backed up first with 2 identical reads; StickS3 only by his choice
   and under its ritual): flash 3 and 4. `dp_receiver.py --png`: HELLO yes/no, frames in 20 s, coverage % (counters
   printed over serial), PNGs. Restore the devkit and confirm the read-back sha256.
6. Report: a numbers table → M4 plan (patch at a pinned version, like M5GFX, or a drop-in class, decided by the
   coverage and diff numbers; overlay changes; regression pairs) → **Felipe decides whether M4 goes beyond the spike.**

### S-3x spike (throwaway: `<scratchpad>/core3`, same guards)
1. Copy the stellar-map overlay + shim + tools. Platform = pioarduino 55.03.39, bare-S3 virtual env first, then the
   StampS3 env.
2. Stage builds a→d (shim-only sketch; + `shim/apply.sh` M5GFX 0.2.27; + M5Unified 0.2.20; stellar-map). Per stage:
   ok/fail, error count, first 3 errors, sizes. If M5Unified 0.2.20 fails, also measure the newest M5Unified, while
   the M5GFX version stays the pinned/patched one.
3. Bins: list `.pio/build/<env>/`, find `boot_app0.bin` under the pioarduino packages, and compare offsets with
   `build-app.yml:106-107`.
4. Compile Bus-Pirate, m5stick-nemo and cardputer-ai in the core3 env: green count, first error per app.
5. Device (same sitting as M4-5): stellar-map core3 → HELLO, frames, an injected key, and unplug/replug ×3 (the HWCDC
   mute path).
6. Report → plan "separate `m5cardputer-core3` env selected by `upstream_core3`" or "migrate all", decided from the
   numbers. Proof for constraint 4 = targets + ~6 regression pairs from `replay.json` `built` (both envs), in batches
   of ≤3 runs. **Felipe decides whether 3.x goes beyond the spike.**

### Phone acceptance
- **A1, rehearsal (me, emulator `dp-test`, the v0.0.7 APK from the GitHub release):** install, open, "Send" consent,
  catalog, Replay fixture renders, 0 FATAL in logcat; kill the emulator afterwards. No build request (proxy events are
  not emulator-filtered and would enter the live panels). Emulator app events are excluded by the `sdk_gphone%` filter.
- **A2, Felipe's checklist:**
  1. Update to 0.0.7. Recommended: the Play internal-testing/production build after his AAB upload, which is exactly
     what users get. A GitHub APK over a Play install may hit a signature mismatch if Play re-signs [UNVERIFIED]; if so,
     uninstall first.
  2. Open the app and answer the analytics prompt with "Send".
  3. Without an ESP: Replay fixture → the demo screen renders, no crash (crash A).
  4. Plug the ESP (OTG) → grant permission → Connection screen shows the link.
  5. Catalog → stellar-map (or PORKCHOP) → build → flash → wait for the 20 s auto-check → the mirror shows; press a key.
  6. Mid-mirror, unplug/replug ×3 → no crash. If the open fails, the Connection screen shows "could not open the ESP's
     USB port … (retry n/3)" and it recovers, or Reconnect works (crash B).
  7. Tell me the time you finished.
- **A3, confirmation (me, ≥3 min later):** HogQL bounded to his session window, non-emulator `posthog-android`
  device: `Application Opened`, `analytics_opt_in`, `catalog_open`, `build_requested`, `usb_attached`,
  `flash_finished` (`result=ok`), `link_up`, `mirror_session`, `verdict_sent`. Zero `$exception` with `fatal=true`;
  `where=usb_open` non-fatal allowed. The proxy's `build_*` events also appear. Then `/api/stats` (after the 120 s edge
  cache) shows ≥1 live device. Journal + Solvr DONE.

## Concerns
- [HIGH] M4 alone does not unlock Bruce (4 of 13 refused pairs): Bruce = TFT_eSPI **and** arduino 3.3.9 with a custom
  framework-libs package. Bruce mirroring needs both tracks, plus acceptance of upstream `platform_packages` in a core3 env.
- [HIGH] A tee on only the five named functions provably misses drawChar's fast path and pushColor (57 direct macro
  writes). The bus counter makes the gap a number. The fix path (more patch points vs a virtual-bus processor layer) is
  chosen from it in the M4 plan, not here.
- [MEDIUM] Frames/HELLO for both spikes need a device and Felipe's flash OK. Without them the spikes stop at
  build/link/coverage-in-build numbers, and the report says exactly that.
- [MEDIUM] New SA permissions can take hours to apply [UNVERIFIED: commonly reported], and Google may hold back vitals
  for a low-volume app. Both are handled fail-soft, and the section states the real state.
- [MEDIUM] Installs: monthly CSV only, 3–7 days late, account-wide permission. Felipe's call; not promised.
- [LOW] Marauder is an Arduino-IDE project with User_Setup injection, so the overlay translation is measured in S-M4.4.
- [LOW] The flock-you refusal may be a false positive (discrepancy 3). Out of scope; journaled.
- [LOW] TFT_eSPI-only apps still compile M5GFX for the shim (`pixelcopy.hpp`). The flash cost is measured.

## Questions for the author
1. Is Marauder (`MARAUDER_CARDPUTER`, 2.x) as the M4 spike app OK, with Bruce covered by diff + `patch --dry-run` on
   its vendored 2.5.43 and its full build deferred until after S-3x?
2. Does the bare S3 devkit get the full backup → test → restore ritual like the StickS3 (I plan to do it anyway), and
   may I ask Felipe for one flash OK covering both spikes' device steps in a single sitting?
3. Section placement: right after "How people use it, live" (my default), or higher?
4. Installs via bulk reports: in this round if Felipe ticks the account permission, or explicitly deferred?
