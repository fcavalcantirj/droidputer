---
slug: droidputer-v007
date: 2026-10-09
status: superseded
round: 0
author_session: 2026-10-09 Claude Code session in ~/dev/droidputter that dissected the 174 failed proxy builds, added PostHog analytics, built droidputer.vercel.app and renamed the repo
---

# Handover — Droidputer v0.0.7: fix the Play production crashes, close the remaining gaps, release, prove on hardware

> Builder: write your `PLAN-r1.md` beside this file (`docs/handovers/2026-10-09-droidputer-v007/`). The author's
> working copy is `/Users/fcavalcanti/.claude/plans/dude-we-need-to-ticklish-trinket.md` (same content).

## Mission

Droidputer (Android app `com.droidputter` + an ESP32-S3 "shim" library) lets an Android phone be the screen,
keyboard and GPS of an ESP32-S3 running Cardputer apps, over USB-OTG. **v0.0.6 is in production on Google Play
and crashes for real users** (Felipe's Play Console screenshot, 2026-10-09). This handover's job:
(0) fix both production crashes at the root, with a CI gate so they cannot ship again; (1) turn the proxy's
"this repo can't be mirrored" refusals into a one-tap path to the working LauncherHub prebuilt; (2) fix the
last failing builds where a robust fix exists; (3) publish the real usage history on the stats page;
(4) tag v0.0.7; (5) prove M5PORKCHOP runs on Felipe's StickS3 — and restore the StickS3's firmware after.
Felipe's standing instruction for all of it: **"BEST MOST ROBUST"**. Done = all acceptance items green and
v0.0.7 released.

## Where things stand (verified)

Repo `/Users/fcavalcanti/dev/droidputter` (local folder keeps the old name on purpose), GitHub
`fcavalcantirj/droidputer` (renamed today), personal account `fcavalcantirj`.

Git state at handover:
- [REAL] `origin/main` = `fa4a4d7` (site replay card) plus the one commit that adds this handover file.
  Everything up to `fa4a4d7` is merged and deployed.
- [REAL] Current branch `fix/compat-retry` (one commit on top of main, rebased onto the handover commit: compat-retry in
  `tools/overlay.py` + new `shim/lib/DroidputterShim/src/dp_compat_core.h`), pushed.
- [REAL] UNCOMMITTED on that branch: `site/api/stats.js`, `site/index.html` (new "How people used it so far"
  section + verdict timeline + traffic) and untracked `site/data/traffic.json` (GitHub traffic snapshot taken
  2026-10-09). Rendered locally with real sources [TEST]: 278 builds requested, 53 apps, 24 voting phones,
  90 visitors/14 d. Not deployed yet.
- [REAL] Untracked `package.json`, `package-lock.json`, `node_modules/` at the repo root: appeared 12:34 when the
  Vercel CLI was run; never committed; not part of the project. Leave or delete only if Felipe says.

### Production crashes (Play Console, v0.0.6 versionCode 6)
- [REAL] `com.droidputter.MainActivity.copyDemoFixtureToCache` `java.io.FileNotFoundException` — 10 users, 19
  events (79.2%), last 5 days ago.
- [REAL] `com.droidputter.usb.UsbDpTransport.<init>` `java.io.IOException` — 1 user, 5 events, last 7 days ago.
- [REAL] Root cause of crash A, measured 2026-10-09: the built APKs contain **no assets** (`unzip -l` of
  `android/app/build/outputs/apk/debug/app-debug.apk`: 0 entries under `assets/`; release APK: only
  `assets/dexopt`), and `android/app/build/generated/demoAssets` and `generated/catalogAssets` do not exist —
  the copy tasks never run. The wiring that fails (android/app/build.gradle.kts, verbatim):
  ```kotlin
          getByName("main") {
              // Providers derived from the copy tasks, not plain directories: every consumer of the assets
              // (mergeAssets, lintVital's model writer, ...) then depends on the copy tasks implicitly -- the
              // release CI run of 2026-09-05 failed on "uses this output without declaring a dependency".
              assets.srcDir(copyDemoFixture.map { it.destinationDir })
              assets.srcDir(copyCatalogManifest.map { it.destinationDir })
          }
  ```
  The crashing code (MainActivity.kt, verbatim):
  ```kotlin
      private fun copyDemoFixtureToCache(): String {
          val dir = File(cacheDir, DEMO_FIXTURE_ASSET_DIR).apply { mkdirs() }
          for (name in DEMO_FIXTURE_ASSET_FILES) {
              assets.open("$DEMO_FIXTURE_ASSET_DIR/$name").use { input ->
                  File(dir, name).outputStream().use { output -> input.copyTo(output) }
              }
          }
          return File(dir, "boot").path
      }
  ```
  with `DEMO_FIXTURE_ASSET_FILES = listOf("boot.bin", "boot.jsonl")`, `DEMO_FIXTURE_ASSET_DIR = "fixtures/pense-bem"`.
  "Replay fixture" is the button shown when no ESP is attached. The same hole drops the offline seeds
  `catalog/catalog.json` / `catalog/verdicts.json`.
- [REAL] AGP is 8.7.3 (`android/build.gradle.kts`: `id("com.android.application") version "8.7.3"`); its
  `com.android.build.api.variant.Sources.getAssets()` returns `SourceDirectories.Layered` with
  `addGeneratedSourceDirectory(TaskProvider<TASK>, (TASK) -> DirectoryProperty)` (checked with javap on
  gradle-api-8.7.3.jar).
- [REAL] Crash B path: `UsbLinkManager.open()` (android/app/.../usb/UsbLinkManager.kt ~187) does
  `val opened = UsbDpTransport(driver.ports[0], connection)`; `UsbDpTransport` `init` (verbatim):
  ```kotlin
      init {
          port.open(connection)
          port.setParameters(BAUD_RATE, 8, UsbSerialPort.STOPBITS_1, UsbSerialPort.PARITY_NONE)
          port.setDTR(true)
          port.setRTS(true)
      }
  ```
  Nothing catches an IOException there. [UNVERIFIED] exact message (Play shows only the headline); typical cause
  is the ESP re-enumerating right after a reset/flash.

### Build pipeline (proxy -> GitHub Actions `build-app.yml` -> `tools/overlay.py`)
- [REAL] 275 build runs 2026-09-04..10-08, 174 failed; dissected by first real error and fixed today (shared
  shadow framebuffer in the bare-S3 shim, M5 pin names, preflight classes, PlatformIO `extends`/`${}` resolver,
  submodules, partition/-zmuldefs/gnu++14 retries, one `.ino` per build folder, `_vendored/` libs without shim
  libs, upstream `build_src_filter`/`lib_ignore`, `failure.json` -> proxy `failure_class`/`reason` + 24 h
  negative cache). Classified history: `site/data/history.json`.
- [REAL] CI replay of the 72 repo/env pairs ever built: 38 build, 28 refused early with a reason, 6 fail
  (`site/data/replay.json`). Still failing: Evil-M5Core2 (both envs), Game-Station (virtual), ESP32-Bus-Pirate,
  m5stick-nemo, cardputer-ai (all virtual).
- [REAL] Compat-retry CI on `fix/compat-retry` (34e894a): Evil x2 and Game-Station now stop at
  `needs Wire.h, which no known library provides`; Bus-Pirate at `'RMT_MEM_NUM_BLOCKS_2' was not declared`
  (arduino-esp32 3.x API); stellar-map regression OK. Cause [REAL, reasoned from the CI result]: the retry
  force-includes `<Wire.h>` via `-include`, but PlatformIO's library finder scans sources, not `-include`
  flags, so the Wire framework library never gets on the include path.
- [REAL] Refusal coverage, measured against the live LauncherHub feed (`https://api.launcherhub.net/giveMeTheList`,
  2,847 entries, 1,626 with a `github` field): 18 of 20 refused repos have a prebuilt whose `github` is exactly
  that repo. Not matched: `bmorcelli/Bruce` (old name of `BruceDevices/firmware`) and `pinchepasta/mostly-a-Flipper`.
  The app already stores that field: `LauncherHub.kt:77` `sourceRepo = obj.str("github")?.trim().orEmpty()`.
- [REAL] Catalog navigation to an entry already exists: `catalogNavigateTo` (MainActivity.kt:151) -> `CatalogScreen(navigateTo=...)`;
  CatalogScreen sets `tab = 0` when navigating (CatalogScreen.kt:83); tab 1 = LauncherHub.

### Analytics + stats site
- [REAL] PostHog Cloud US, project id 655499. App events + own crash handler (`android/app/.../telemetry/Telemetry.kt`);
  `$exception` from a forced emulator crash is in the project; release (R8) build events arrived. Proxy sends
  `build_dispatched/joined/cache_hit/failed_cached/throttled`, `build_result`, `verdict_filed`.
- [REAL] Events are ingested in < 1 s (`created_at`) but only become QUERYABLE 2–3 min later. HogQL must be
  time-bounded (unbounded scans hit "max execution time").
- [REAL] Stats site `site/` -> Vercel project `droidputer` (team flowcoders = Felipe's personal), live at
  https://droidputer.vercel.app, `/privacy` = static copy of `docs/PRIVACY.md` (generated by a scratch script;
  regenerate by hand if PRIVACY.md changes). Proxy `proxy/` -> Vercel project `droidputter-proxy`
  (https://droidputter-proxy.vercel.app — the domain is hardcoded in every shipped APK).
- [REAL] Live page today: 0 phones — no released app sends analytics (v0.0.6 predates them). Only v0.0.7 fixes that.

### Hardware session (DONE by the author, 2026-10-09 ~14:50-15:10, Felipe's StickS3 on the Mac)
- [REAL] Device: ESP32-S3-PICO-1 rev v0.2, MAC ac:27:6e:d2:68:b8, 8 MB flash, 8 MB PSRAM, port /dev/cu.usbmodem101,
  the only Espressif device attached (0x303a:0x1001).
- [REAL] Backup: two full 8 MB reads, both sha256 `217dd6f68699da3896a55c440766cc61db93270058255b5cb7590237851f9107`;
  kept at `~/.config/droidputter/backups/sticks3-ac276ed268b8-2026-10-09.bin` (original: Arduino 2.0.17 app in app0,
  default_8MB layout; prints `SPIKE dock bat_mv=...` on boot).
- [REAL] Runs on hardware with `tools/dp_receiver.py` as the phone, 60 s each, no reboot, no panic, 0 dropped
  (screens in `evidence/`): M5PORKCHOP-virtual (1,383 frames, 8.6 MB, ~290 KB/s, heap 65.6 -> 36.9 KB, ASCII-pig
  screen), miniacid-virtual (746 frames, 7.3 MB, heap ~204 KB, 303A synth screen), saturn-virtual (67 frames,
  heap ~44 KB, menu screen).
- [REAL] Restore: `write_flash 0x0 <backup>` (esptool hash verified) + full read-back sha256 identical to the
  backup; the StickS3 boots its own firmware again (`SPIKE dock ...`, no droidputter frames).
- [REAL] Traps seen: esptool cannot connect while a shim app streams ~290 KB/s on the same CDC port
  (`Invalid head of packet (0xE5)`) -- flash again once a lighter app runs, or use `--connect-attempts 10`;
  `dp_receiver.py` (Python) reports CRC "bad" frames at >~120 KB/s while the ESP's own STATS show 0 dropped --
  a host-receiver limit, not firmware.
- Not exercised: crash B's IOException path (the transport is the Android app's, not the Mac receiver's).

### Rename
- [REAL] Repo renamed `droidputter` -> `droidputer`: old raw URLs serve 200, API GET 301, POST 307 (Node fetch
  follows); end-to-end proxy build on the renamed repo finished `ready`, 4 parts. GitHub Pages does NOT redirect:
  `https://fcavalcantirj.github.io/droidputter/PRIVACY.html` -> 404.

### Commands (verbatim, used today)
```bash
# GitHub as the personal account WITHOUT switching the machine-wide gh account (enterprise token gets 403):
export GH_TOKEN=$(gh auth token --user fcavalcantirj)
# dispatch one build on a branch (zsh: pass args explicitly, `set -- $var` does not word-split):
gh workflow run build-app.yml -R fcavalcantirj/droidputer --ref <branch> -f repo=<owner/repo> -f name=<overlay-name> -f env=<m5cardputer|m5cardputer-virtual> -f request_id=<unique-id> -f shim=<short-sha>
# Android gates (same as CI):
cd android && ./gates.sh && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew --no-daemon :core:test :app:assembleDebug :app:assembleRelease
# proxy tests:
cd proxy && npm test
# shim host tests:
cd shim && pio test -e native
# deploy (personal Vercel, CLI is logged in as fcavalcantirj):
cd site && vercel deploy --prod --yes      # stats site
cd proxy && vercel deploy --prod --yes     # build proxy
```
Emulator for app tests: AVD `dp-test` (API 35 arm64, `~/.android/avd/dp-test.avd`), start with
`$HOME/Library/Android/sdk/emulator/emulator -avd dp-test -no-window -no-audio -no-snapshot -no-boot-anim -gpu swiftshader_indirect`
(Homebrew `avdmanager` cannot see this SDK; the AVD was written by hand). Kill it when done.

## Blocking constraints (builder: restate these before planning)
1. `com.droidputter` (applicationId and Kotlin packages), the shim identifiers (`DroidputterShim`, `DROIDPUTTER_*`,
   `droidputter.cpp`, patch file names) and the proxy domain `droidputter-proxy.vercel.app` NEVER change — a new
   applicationId is a different app on Play and orphans every installed user; the proxy domain is in every APK.
2. The StickS3 is Felipe's device with firmware he wants back. Before ANY flash: back up the full flash twice
   (identical sha256), and after testing write the backup back and verify by read-back sha256. Never target the
   LilyGO T-Display-S3 (live bedside device) — if more than one ESP is attached or the chip isn't an S3, stop.
3. A build behaviour change in `tools/overlay.py` must not alter any build that compiles today: new behaviour
   only on a specific classified failure (retry) or proven by CI on the targets AND regression pairs.
4. Felipe's PostHog personal key lives only in Vercel env (site project: `POSTHOG_PERSONAL_KEY`,
   `POSTHOG_PROJECT_ID`; proxy: `POSTHOG_KEY`, `GITHUB_REPO`). Never write it to a file, a commit, memory or a log.
5. Never execute `ralph*.sh` or any build/agent loop runner (Felipe runs those himself).
6. Each failed CI build emails Felipe (the dispatch runs with his token): keep verification batches small and
   targeted; never re-dispatch a whole corpus without saying so.

## Accepted residuals / Refuted — don't fix
- Refuted 2026-10-09: "a PostHog event was lost because of the proxy's 1.5 s send timeout" — wrong; events were
  ingested in < 1 s and only queryable 2–3 min later. The 4 s cap stays as margin. Don't chase lost events
  without checking `created_at` and waiting 3 min.
- Refuted: building Bruce/Launcher/Marauder through the proxy "successfully" — every such TFT_eSPI build was
  auto-verdicted broken (`hello=false`); they are refused on purpose until the TFT_eSPI shim (M4) exists.
- ESP-IDF / MicroPython repos (MicroHydra, Doom, UIFlow, Flipper ports, M5Apps, M5Gemini, UserDemo,
  AdvanceOS, WiFi-BLE Radar, GLIDE-Synth) can never be rebuilt against an Arduino shim — the fix is the
  prebuilt hand-off, not a build.
- Bus-Pirate, nemo, cardputer-ai use arduino-esp32 3.x APIs while the shim is on 2.0.17 (espressif32@6.12.0):
  they stay as precise "needs arduino-esp32 3.x" answers; moving the shim to 3.x is not in scope.
- `apps/*/platformio.ini` committed overlays contain absolute Mac paths (`/Users/fcavalcanti/dev/droidputter/...`):
  known, harmless (CI regenerates overlays) — don't "fix" them in this work.
- Don't rename the local folder `~/dev/droidputter` (breaks Claude memory path, CLAUDE.md, absolute paths).
- The PostHog project setting "exception autocapture" is OFF by PostHog default; the app does not rely on it
  (own handler in Telemetry.kt). Don't switch the SDK autocapture back on (it would double-count).

## Hard rules & human-reserved decisions
- Commit + push verified work on the droidputter repo without asking (standing grant); tags only on Felipe's word —
  **v0.0.7 tag: Felipe said YES (2026-10-09), but only after every gate passes.**
- Uploading the AAB to Google Play and editing the Play Console IS FELIPE'S CALL (manual: privacy URL ->
  `https://droidputer.vercel.app/privacy`, optional store name "Droidputer").
- Plugging the StickS3 into the Mac IS FELIPE'S CALL; he agreed only under the backup/restore protocol.
- Live GitHub traffic: Felipe will create a fine-grained PAT (repo droidputer, Administration: read); until he
  sends it, the dated snapshot stays.
- M4 TFT_eSPI shim: Felipe said "after this plan, separate spike first" — not part of this handover.
- Deleting the archived throwaway repo `fcavalcantirj/dp-rename-spike-b`, the stray root `node_modules/`, or the
  ~2 GB emulator files IS FELIPE'S CALL.

## Acceptance checklist (the author approves the plan ONLY against these)
1. Crash A root fix uses `androidComponents.onVariants { it.sources.assets?.addGeneratedSourceDirectory(...) }`
   with a typed task exposing a `DirectoryProperty` output (not `assets.srcDir(provider)`), for BOTH the demo
   fixture and the catalog seeds.
2. Crash A defence: `startDemoReplay()` cannot crash on a missing/unreadable fixture (status-line message instead).
3. A CI gate in `android.yml` AND `release.yml` fails the build when the APK (and in release, the AAB under
   `base/assets/`) lacks `assets/fixtures/pense-bem/boot.bin`, `boot.jsonl` and `assets/catalog/catalog.json`;
   the plan says how it proves the gate fails on the old wiring (e.g. run it against the v0.0.6 release AAB).
4. Crash B: `UsbDpTransport` closes the port if a step after `open` fails; `UsbLinkManager.open()` catches
   IOException, closes the connection, shows it on the link status, retries with backoff (bounded), reports one
   non-fatal `Telemetry.exception`, and never crashes.
5. Prebuilt hand-off: a pure, unit-tested `:core` matcher (https/ssh, `.git`, trailing slash, case, multiple hits)
   on `CatalogEntry.sourceRepo`; shown only for refusal classes (unsupported-graphics, not-arduino,
   library-repo); the button opens the LauncherHub entry via the existing `catalogNavigateTo`, switching to the
   LauncherHub tab; `prebuilt_offered` / `prebuilt_opened` events.
6. Compat retry corrected: adds the `Wire` framework library to `lib_deps` on the retry (not only `-include`);
   proven by CI on Evil-M5Core2 (both envs) and Game-Station plus at least 2 regression pairs that build today.
7. Site: the uncommitted "How people used it so far" work is committed and deployed; production `/`, `/privacy`,
   `/api/stats` return 200 and the numbers equal `history.json` / `verdicts.json` / releases; when Felipe's
   traffic token exists, `api/stats.js` reads traffic live with the snapshot as fallback.
8. Verification on the emulator `dp-test`: fresh install, no ESP -> "Replay fixture" renders the Pense-Bem screen
   (screenshot, no crash); a refused build (one real proxy request) shows the prebuilt button and opens it.
9. Gates before the tag: shim `pio test -e native`, `android/gates.sh`, `:core:test`, `:app:assembleDebug`,
   `:app:assembleRelease`, proxy `npm test`, the new asset gate — all green; then tag `v0.0.7` and confirm the
   release workflow published `droidputer-v0.0.7.apk/.aab`.
10. [ALREADY DONE by the author 2026-10-09, see "Hardware session" -- builder: do NOT repeat unless the shim changes]
    StickS3 session follows Blocking constraint 2 step by step (identify, double backup, test PORKCHOP/miniacid/
    saturn virtual builds with `tools/dp_receiver.py` as the phone stand-in for 60 s each, restore, read-back
    sha256 equal), and reports boots / HELLO / frames / a PNG per app; it also exercises crash B's USB open path.
11. `progress.txt` gets one appended entry with [REAL]/[TEST]/[UNVERIFIED] labels; Solvr room `droidputter`
    gets `[EXEC] STATUS/DONE/BLOCKED` posts.

## next_action
Write the AGP variant-API asset wiring (checklist 1) on a new branch off `main`, build the debug APK, and run
`unzip -l android/app/build/outputs/apk/debug/app-debug.apk | grep -E "assets/(fixtures|catalog)/"` — it must list
`boot.bin`, `boot.jsonl`, `catalog.json` (and `verdicts.json`) before anything else is touched.

## Open questions
1. Should the `UsbDpTransport` retry also fire `linkManager.reconnect()` semantics, or stay local to `open()`?
   (Author leans: local bounded retry, then wait for the next attach intent.)
2. Should the stats page count the prebuilt hand-off as "refusal turned into a working app"? (Author leans yes,
   from `prebuilt_opened`.)

## Pointers
- Plan context and decisions: this file; project rules: `CLAUDE.md`, `AGENTS.md`, `docs/GROUND_RULES.md`,
  append-only journal `progress.txt` (today's entry is the last one).
- Build lane: `.github/workflows/build-app.yml`, `tools/overlay.py`, `proxy/lib/builds.js`, `proxy/lib/artifact.js`.
- App: `android/app/build.gradle.kts`, `android/app/src/main/java/com/droidputter/MainActivity.kt`,
  `.../usb/UsbLinkManager.kt`, `.../usb/UsbDpTransport.kt`, `.../catalog/{BuildFlow,BuildRequestPanel,CatalogScreen,LauncherHubRepository}.kt`,
  `android/core/src/main/kotlin/com/droidputter/core/catalog/LauncherHub.kt`, `.../telemetry/Telemetry.kt`.
- Site: `site/index.html`, `site/api/stats.js`, `site/data/{history,replay,traffic}.json`, `site/vercel.json`.
- Secrets: Vercel env of projects `droidputer` and `droidputter-proxy` (`vercel env ls production` from
  `site/` or `proxy/`); release keystore in `~/.config/droidputter` (release.yml reads `RELEASE_*` secrets).
- PostHog: https://us.posthog.com project 655499 (query API `https://us.posthog.com/api/projects/655499/query/`).
- Play Console: crashes under Android vitals → Crashes and ANRs (Felipe has access).
- Memory: `~/.claude/projects/-Users-fcavalcanti-dev-droidputter/memory/project-droidputter-build-fix-analytics-2026-10-09.md`.

## SUPERSEDED (2026-10-09 ~19:00, by the author session -- executed instead of handed over)
Done and verified; a builder must NOT redo these:
- 0. Both Play crashes fixed (main 251ecce): typed CopyAssetFiles + addGeneratedSourceDirectory; check-assets.sh in
  android.yml/release.yml (fails on the published v0.0.6 APK/AAB, passes now); demo replay guarded; USB open
  retried 3x with backoff and shown on the Connection screen. [TEST] release APK on the emulator: Replay fixture
  renders, 0 FATAL. Crash B on real hardware: [UNVERIFIED] until a phone + ESP session.
- 1. Prebuilt hand-off (main 365bea7): LauncherHub.matchRepo + tests; verified on the emulator through the real proxy
  (BruceDevices/firmware -> "Flash the working prebuilt: Bruce for Cardputer & ADV" -> LauncherHub detail 1.16.1).
- 2. Compat retry: tried on fix/compat-retry, NOT merged -- no build turned green. Evil-M5Core2's real blocker is
  PlatformIO's .ino prototype generator misparsing JavaScript inside raw strings; Game-Station relies on headers its
  vendored M5Cardputer pulled in (forcing Wire.h brings Arduino's binary macros into emulator code); Bus-Pirate,
  nemo, cardputer-ai need arduino-esp32 3.x.
- 3. Site: "How people used it so far" live (main b2137c3). Live traffic still waits for Felipe's token.
- 4. v0.0.7 tagged on 365bea7 and released (droidputer-v0.0.7.apk/.aab, versionCode 7, same signing key as v0.0.6).
- 5. StickS3 proof done (see "Hardware session").
Still open: Felipe uploads droidputer-v0.0.7.aab to Play (privacy URL https://droidputer.vercel.app/privacy);
acceptance on Felipe's phone + an ESP; the GitHub traffic token; M4 TFT_eSPI spike.
