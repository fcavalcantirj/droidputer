---
slug: droidputer-next
date: 2026-10-09
status: open
round: 0
author_session: 2026-10-09 Claude Code session in ~/dev/droidputter (context ~87%) that shipped v0.0.7, fixed the Play crashes, built droidputer.vercel.app and planned what follows
---

# Handover — Droidputer, next phase: Play numbers on the stats page, TFT_eSPI shim (M4), arduino-esp32 3.x shim, phone acceptance

> Builder: write `PLAN-r1.md` beside this file in `docs/handovers/2026-10-09-droidputer-next/`.

## Mission

Droidputer (Android app `com.droidputter`, label "Droidputer", + an ESP32-S3 "shim" library) makes an Android phone
the screen, keyboard and GPS of an ESP32-S3 running Cardputer apps, over USB-OTG. v0.0.7 shipped today. Next, in
Felipe's priority order:
1. **The stats site is the centrepiece** — https://droidputer.vercel.app, "a GORGEOUS piece of art with raw real-time
   analytics and HOW people use droidputer", fed by the app (PostHog), GitHub, the build proxy, verdicts and — new —
   Google Play. Walk Felipe through creating the Play service account, then show real Play daily users + crash rates.
2. **M4: TFT_eSPI shim** so TFT_eSPI apps (Bruce, every Marauder, flock-you) mirror on the phone. SPIKE FIRST.
3. **arduino-esp32 3.x support** so 3.x-core apps (ESP32-Bus-Pirate, m5stick-nemo, cardputer-ai, and a growing
   share of new apps) build. SPIKE FIRST.
4. **v0.0.7 acceptance on Felipe's phone + an ESP** (also the first real live phone on the page).
Felipe's standing instruction: **"BEST MOST ROBUST"**. Done = Play numbers live on the page, both spikes measured and
their plans approved by Felipe, acceptance passed.

## Where things stand (verified)

Repo `/Users/fcavalcanti/dev/droidputter` (local folder keeps the old name ON PURPOSE), GitHub
`fcavalcantirj/droidputer` (renamed today; old URLs redirect, measured), personal account `fcavalcantirj`.
- [REAL] main = the commit adding this handover; everything below is merged and deployed.
- [REAL] **v0.0.7 released** (tag on `365bea7`): `droidputer-v0.0.7.apk/.aab`, versionCode 7, same signing key as
  v0.0.6 (cert sha256 `85051d2e…`). Fixes both Play production crashes of v0.0.6: (a) APK/AAB had NO assets since
  v0.0.1 → "Replay fixture" FileNotFoundException (10 users) — now `CopyAssetFiles` +
  `androidComponents…addGeneratedSourceDirectory` in `android/app/build.gradle.kts`, gated by `android/check-assets.sh`
  in `android.yml` + `release.yml`; (b) `UsbDpTransport.<init>` IOException → port released, 3 retries with backoff in
  `UsbLinkManager.openFailed`, error on the Connection screen. [TEST] release APK on the emulator: Replay fixture
  renders, 0 FATAL. [UNVERIFIED] crash (b) on a real phone. **NOT yet uploaded to Play** (Felipe's step).
- [REAL] Stats site `site/` (Vercel project `droidputer`, team flowcoders = Felipe's personal; deploy
  `cd site && vercel deploy --prod --yes`). Sections, all live: hero 240x135 "ESP screen" (pixel-quantised canvas);
  **What real phones did** (the app's automatic post-flash verdicts: 17 phones, 57 flashes watched, 61% came up
  mirrored, apps per phone, what they flashed, frames in 20 s); **How people used it so far** (275 classified builds
  `site/data/history.json`, 53 apps, hardware split, phones voting over time, downloads per release, GitHub referrers
  snapshot `site/data/traffic.json` taken 2026-10-09); **How people use it, live** (PostHog, counts only from
  2026-10-09 19:00 UTC = after v0.0.7; zero so far — earlier events were the author's emulator/proxy tests);
  Builds before/after the fix (`site/data/replay.json`: 72 pairs → 38 build, 28 refused with a reason, 6 fail);
  Crashes & verdicts; Raw data (JSON/CSV downloads + every table); Why; `/privacy` (static copy of `docs/PRIVACY.md`,
  regenerate by hand when it changes). API `site/api/stats.js` = HogQL + GitHub + local data, edge cache
  `s-maxage=120, stale-while-revalidate=600`. Design follows the dataviz skill (tokens, light/dark, hover tooltips, tables).
- [REAL] PostHog Cloud US, project **655499**. App: opt-in analytics + own crash handler (`android/app/.../telemetry/Telemetry.kt`;
  the project setting "exception autocapture" is OFF by PostHog default and the SDK obeys it — hence our own handler).
  Proxy sends `build_dispatched/joined/cache_hit/failed_cached/throttled`, `build_result`, `verdict_filed`.
  Events are ingested < 1 s but QUERYABLE only 2–3 min later; every HogQL query must be time-bounded.
- [REAL] Google Play Developer Reporting API (docs read 2026-10-09): `apps/{app}/crashRateMetricSet` has metrics
  `crashRate`, `userPerceivedCrashRate`, `distinctUsers` (+ 7d/28d user-weighted variants, not HOURLY); DAILY periods use
  timezone `America/Los_Angeles`, HOURLY uses UTC; permission "View app information (read-only)". [UNVERIFIED] the OAuth
  scope string (believed `https://www.googleapis.com/auth/playdeveloperreporting`), the `anrRateMetricSet` field names,
  and whether install counts are available there (they may need Play Console's Cloud Storage reports instead).
- [REAL] Build lane: phone → proxy (`proxy/`, Vercel project `droidputter-proxy`, https://droidputter-proxy.vercel.app —
  domain hardcoded in every APK) → GitHub Actions `.github/workflows/build-app.yml` → `tools/overlay.py`. A failed run
  carries `failure.json` {class, reason}; the proxy answers deterministic failures from a 24 h cache; the app shows the
  reason and, for refusals, "Flash the working prebuilt" (`LauncherHub.matchRepo`, exact owner/repo; 18 of 20 refused
  repos have a LauncherHub prebuilt).
- [REAL] Refused as `unsupported-graphics` (13 pairs): TFT_eSPI = BruceDevices/firmware, bmorcelli/Bruce,
  justcallmekoko/ESP32Marauder, serialgeist/ESP32Marauder, marivaaldo/ESP32Marauder, colonelpanichacks/flock-you;
  Arduino_GFX = bmorcelli/Launcher, bmorcelli/M5Stick-Launcher (M4 does NOT cover Arduino_GFX). Bruce vendors its own
  `lib/TFT_eSPI` (version 2.5.43, measured). Every TFT_eSPI build that "succeeded" before refusals existed got an
  automatic `broken` verdict (`hello=false`): the shim never sees TFT_eSPI drawing.
- [REAL] Shim stack today: `espressif32@6.12.0` (arduino-esp32 2.0.17), M5GFX 0.2.27 + M5Cardputer 1.1.1 patched by
  `shim/patches/*.patch` via `shim/apply.sh`, `m5stack/M5Unified@0.2.20` pinned in `tools/overlay.py`. The M5GFX patch
  adds 8 `dp::` calls to `Panel_LCD.cpp` (setWindow, pixels, fill, …) — the model for a TFT_eSPI patch. The bare-S3
  env uses `esp32-s3-devkitc-1` + `-DDROIDPUTTER_VIRTUAL=1` (no panel; `Panel_Droidputter` draws into the shim's shadow).
- [REAL] Local PlatformIO cache already holds a second espressif32 platform plus `framework-arduinoespressif32-libs`,
  `framework-espidf` and `toolchain-xtensa-esp-elf` (signs of a pioarduino / arduino-esp32 3.x platform); upstream
  ESP32-Bus-Pirate pins `https://github.com/pioarduino/platform-espressif32/releases/download/55.03.37/platform-espressif32.zip`.
- [REAL] Still failing, exact first errors: ESP32-Bus-Pirate `'RMT_MEM_NUM_BLOCKS_2' was not declared` (3.x API);
  m5stick-nemo `BLEAdvertisementData::addData(String)` (3.x API); cardputer-ai `ambiguating new declaration of
  'uint32_t millis()'`; Evil-M5Core2 (both envs): PlatformIO's .ino→cpp prototype generator misreads JavaScript inside
  raw strings (`function send(key)`, `async …`) in a 44,639-line sketch; Game-Station `'Wire' was not declared` in
  `src/share/input.cpp` (root cause UNKNOWN, see residuals).
- [REAL] Felipe's StickS3 was used and RESTORED (backup `~/.config/droidputter/backups/sticks3-ac276ed268b8-2026-10-09.bin`,
  sha256 `217dd6f6…9107`); PORKCHOP/miniacid/saturn bare-S3 builds run and mirror on it (`tools/dp_receiver.py` as the phone).

Commands (verbatim, used today):
```bash
export GH_TOKEN=$(gh auth token --user fcavalcantirj)   # personal account per command; the enterprise token gets 403
gh workflow run build-app.yml -R fcavalcantirj/droidputer --ref <branch> -f repo=<owner/repo> -f name=<overlay-name> -f env=<m5cardputer|m5cardputer-virtual> -f request_id=<unique-id> -f shim=<short-sha>
cd android && ./gates.sh && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew --no-daemon :core:test :app:assembleDebug :app:assembleRelease :app:bundleRelease && bash check-assets.sh app/build/outputs/apk/release/app-release.apk app/build/outputs/bundle/release/app-release.aab
cd proxy && npm test          # 88 tests
cd shim && pio test -e native # 5 suites
cd site && vercel deploy --prod --yes ; cd proxy && vercel deploy --prod --yes
```
Emulator: AVD `dp-test` (API 35 arm64): `$HOME/Library/Android/sdk/emulator/emulator -avd dp-test -no-window -no-audio -no-snapshot -no-boot-anim -gpu swiftshader_indirect` (kill when done).

## Blocking constraints (builder: restate these before planning)
1. Never change `com.droidputter` (applicationId/packages), the shim identifiers (`DroidputterShim`, `DROIDPUTTER_*`,
   `droidputter.cpp`, patch names) or the proxy domain — installed users and every shipped APK depend on them.
2. SPIKE BEFORE PLANNING (Felipe's rule): M4 and 3.x each start with a throwaway, timeout-guarded spike that measures;
   each plan is written from those numbers. A plan containing "hypothesis / to be proven" is refused.
3. Secrets never in files, commits, memory or logs: Felipe's PostHog personal key and the Play service-account JSON
   live ONLY in Vercel env (site project `droidputer`: `POSTHOG_PERSONAL_KEY`, `POSTHOG_PROJECT_ID`, new e.g.
   `PLAY_SERVICE_ACCOUNT_JSON`). The PostHog project token `phc_…` is public by design.
4. A change in `tools/overlay.py` or the shim must not alter any build that compiles today: prove it with CI on targets
   AND regression pairs. Each failed CI run emails Felipe: small, targeted batches only.
5. Never run `ralph*.sh` or any build/agent loop runner. Never flash a device without Felipe's explicit OK; his StickS3
   only under backup (2 identical reads) → test → restore → read-back sha256 identical. Never touch the bedside T-Display-S3.
6. Stats page honesty: every number names its source; no device ids or IPs leave `api/stats.js`; pre-release test
   traffic stays out of the live panels.

## Accepted residuals / Refuted — don't fix
- Refuted: "PostHog lost an event" — it was query lag (2–3 min). Check `created_at` before chasing.
- Refuted: a blanket compat retry (force-including Arduino.h/Wire.h via build_flags) — it breaks library units and drags
  Arduino's `B0..B11111111` macros into emulator code; branch `fix/compat-retry` kept, NOT merged (no build turned green).
- Refuted for Game-Station: "M5Unified includes Wire.h" (0.2.28 does not) and "its vendored M5Cardputer includes it"
  (1.1.1 does not). Root cause unknown; the measurable next step is an include-tree (`-H`) build of the upstream repo.
- ESP-IDF/MicroPython repos can never be shim builds → the prebuilt hand-off is the answer, not a build.
- Don't rename the local folder; don't "fix" absolute paths in committed `apps/*/platformio.ini`.
- GitHub traffic stays a dated snapshot until Felipe sends a fine-grained PAT (Administration: read).

## Hard rules & human-reserved decisions
- Commit + push verified work without asking (standing grant); **tags only on Felipe's word**.
- Creating the Play service account, inviting it in Play Console, and uploading the v0.0.7 AAB to Play (privacy URL
  `https://droidputer.vercel.app/privacy`) are FELIPE'S actions; the builder guides him.
- Whether M4 / 3.x go beyond the spike IS FELIPE'S CALL after the numbers.
- Phone acceptance is Felipe's device: give him a short checklist; never make him the first tester of an untried path.

## Acceptance checklist (the author approves the plan ONLY against these)
1. A step-by-step guide for Felipe to create the service account (Cloud project, enable "Google Play Developer Reporting
   API", create SA + JSON key, invite the SA email in Play Console → Users and permissions with "View app information
   (read-only)"), and how the key reaches Vercel env (`vercel env add … production` from `site/`) without git.
2. `site/api/stats.js` gains a Play block (service-account JWT → access token → `crashRateMetricSet:query`, DAILY,
   last 28–30 days): daily `distinctUsers` and crash rates; ANR only if verified; cached; fails soft (page renders
   without it). The plan states how each field name and the scope are VERIFIED by a first real query before shown.
3. Page: a "Google Play" section in the same design language (daily active users line, crash-rate line, latest values as
   tiles), included in tables + JSON/CSV export, labelled with Google as the source and the LA-timezone caveat.
4. M4 spike: one TFT_eSPI app (the plan says which and why) built in the bare-S3 env with a patched TFT_eSPI that tees
   setWindow/pushBlock/pushPixels/drawPixel/fillRect into the existing `dp::` API and never drives SPI in the virtual
   env; measured result (builds, HELLO, frames via `tools/dp_receiver.py` or a captured fixture) before any plan;
   addresses Bruce's vendored TFT_eSPI 2.5.43.
5. 3.x spike: shim + one known-good app (e.g. stellar-map) on the pioarduino platform; measured compile/link errors of
   the shim, the M5GFX patch and M5Unified; then a plan (separate env vs migration) from those numbers.
6. Phone acceptance checklist for v0.0.7 (install, Send, flash an app, mirror, Replay fixture without ESP, unplug/replug
   during the link for crash B) and how its events are confirmed in PostHog (~3 min lag).
7. Every deliverable verified per the gates above; `progress.txt` appended; Solvr room `droidputter` posts.

## next_action
Give Felipe the service-account guide (checklist 1) in one message and, while he does it, start the M4 spike in a
throwaway directory (timeout-guarded), reporting measured numbers only.

## Open questions
1. Install counts: Reporting API or Play Console's Cloud Storage reports? Verify; don't promise installs until measured.
2. M4: patch TFT_eSPI (pinned version, like M5GFX) or provide a drop-in `TFT_eSPI` shim class? The spike decides.

## Pointers
- Previous handover (executed): `docs/handovers/2026-10-09-droidputter-v007/HANDOVER.md` (status superseded, with evidence/).
- Journal `progress.txt` (last entries 2026-10-09); rules `CLAUDE.md`, `AGENTS.md`, `docs/GROUND_RULES.md`.
- Site: `site/index.html`, `site/api/stats.js`, `site/data/*.json`, `site/vercel.json`. Proxy: `proxy/lib/*.js`.
- Shim: `shim/lib/DroidputterShim/src/` (dp_display.cpp tee, dp_panel.cpp virtual panel, dp_shadow), `shim/patches/`, `shim/apply.sh`.
- Overlay: `tools/overlay.py` (preflight, classify_build, retries). App: `android/app/src/main/java/com/droidputter/`.
- PostHog: https://us.posthog.com project 655499. Play Console: Felipe's account. Memory:
  `~/.claude/projects/-Users-fcavalcanti-dev-droidputter/memory/project-droidputter-build-fix-analytics-2026-10-09.md`.
