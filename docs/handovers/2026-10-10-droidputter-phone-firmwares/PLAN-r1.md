---
round: 1
builder_session: 2026-10-10 fresh Claude Code session in ~/dev/droidputter (handover build; verified claims read-only, nothing executed on the phone)
---

# Plan r1 — droidputter phone firmwares (builder response to HANDOVER.md, round 1)


## Context
Felipe wants the most-requested catalog apps working end to end on his Xiaomi phone (proxy build, flash from the
phone, mirror, phone keys), with Marauder's enter bug either fixed or root-caused with evidence. Scope is
compatibility only: boots, mirrors, menus navigate.

## Blocking constraints (restated)
1. Compatibility only. "Works" means boots, mirrors and menus navigate with phone keys. I never operate, test or
   extend any app feature beyond that, and never edit app sources. Changes go only in `shim/` and `tools/overlay.py`.
2. Never break the others. Any overlay change must regenerate a byte-identical `platformio.ini` for the other
   overlays (old vs new generator, diffed). Any shim change must keep `pio test -e native` green. CI runs at most
   3 builds at a time, because failures email Felipe. A shim-only change leaves `overlay.py` untouched, so the ini
   check is `git diff --stat tools/overlay.py` being empty. But it moves the proxy's shim sha for every app, so
   3 already-verified apps get re-verified on the new sha.
3. Spike before plan, TDD for fixes. First a measured failure on the phone, then a host test that is red on the
   current code, then the fix, then green. Mapping logic also gets mutants that the new test must kill.
4. `com.droidputter`, shim identifiers and the proxy domain never change. Flashing happens only through the app,
   onto the phone's devkit. The bedside T-Display-S3 and the ESP32-C5 nurse-bell board are never touched.
5. Secrets: the Play key lives only in `~/.config/droidputter/play-service-account.json` and the Vercel env. It is
   never printed.
6. Felipe uses the phone too. Before any recorded or driven phone run, I ask him for a hands-off window with
   AskUserQuestion.

**Phone reconnect:** `export ADB_MDNS_OPENSCREEN=0` before any adb call. Then `adb devices -l`. If
`192.168.0.169:<port>` is missing, run `dns-sd -B _adb-tls-connect._tcp local.` and then
`dns-sd -L <instance> _adb-tls-connect._tcp local.` for the port, then `adb connect 192.168.0.169:<port>`, and
update `DEV` in ph.py and `D` in flash_app.sh. Every dns-sd/adb call runs under `timeout`.

## Handover discrepancies (checked 2026-10-10 ~02:55 UTC)
- [REAL] **The batch was not dead: it is still running.** It is the author session's background process (`bash
  batch.sh`, pid 94039). Its live log is the author's scratchpad file `.../a4d091a6-.../scratchpad/phone/batch.log`,
  and the tracked `tools/batch-2026-10-10-partial.log` is only a snapshot of it. By 02:53 UTC the batch had
  finished:
  - M5Cardputer: shim c09487b, flashed and verified, auto-verdict works (#97), screenshot `b-m5cardputer`.
  - Pigtail: shim c09487b, flashed and verified, **auto-verdict broken: boots=8 hello=true frames=4 (#98)**. The
    phone's logcat shows `boot rst=5 wd=0` every ~2.7 s.

  It was on miniacid at 02:53. Until it ends, the phone is busy and must not be driven by anyone else.
- [REAL] main = e34e29b (handover commit) on top of bot commits #96/#97 and c09487b. Origin is in sync. The proxy
  builds with the newest commit touching `shim/` on main, which is c09487b. That is confirmed by M5Cardputer and
  Pigtail building on c09487b, so a Marauder build now carries the key trace.
- [REAL] LOG frames reach logcat on this phone. Release 0.0.7 logs them with `Log.d` under tag `Droidputter`, and
  R8 does not strip Log. The kbd trace itself has never run on hardware yet: [UNVERIFIED] until step 1. The app
  also logs every decoded frame, so I capture logcat while pressing instead of relying on `-d` afterwards.
- [REAL] Shim native tests: 36 `RUN_TEST` cases (counted statically, not run in plan mode).
- [REAL] Phone is reachable on port 36483, app 0.0.7. **Battery is 29% and not charging**, and the devkit draws
  from OTG.
- Untracked `package.json` / `node_modules/` (Vercel CLI) at the repo root are not mentioned in the handover. I
  leave them alone and keep them out of commits.

## Acceptance checklist, point by point
1. **Constraints, reconnect, hands-off.** Constraints are restated above, and the reconnect steps are above. For
   hands-off windows I send one AskUserQuestion per session block, giving the length (Marauder trace about 10 min;
   remaining apps about 4 min each) and the options "now / in 30 min / later".
2. **Marauder enter.** Step 1 is exactly `next_action`: flash Marauder (shim c09487b) from the phone, then capture
   `adb logcat -c; timeout 60 adb logcat -v time -s Droidputter:V > trace.log`. Press enter once with
   `ph.py keys enter` (an adb tap, about 0 ms hold). Then, after returning to the top menu with backtick, press
   once more with a 300 ms hold (`adb shell input swipe x y x y 300` on the enter key's bounds), plus a screen
   recording. I read the `kbd scan=N t=ms keys=` lines and branch on the measurement:
   - **(a) 13,2 seen in exactly one scan (N on, N+1 empty), and the menu still returns.** The second action is not
     a held enter. Next experiment: check the same trace window for any other key coordinate between N and the
     return. If there is none, the return does not come from the shim's input, so I record it as app-side with the
     trace as evidence, and Open Question 1 goes to Felipe (an input-side compatibility shim, or "known residual").
     No shim change.
   - **(b) 13,2 seen in two or more consecutive scans.** The tap stays held across the app's next scan. Next
     experiment: compare the scan counts and `t=` spans for the 0 ms tap and the 300 ms hold. If the count scales
     with how long the phone holds the key, it is input-side, and the fix candidate is reporting a press to the
     matrix path once per press (edge, not level). That change is designed only after this number exists, then
     goes through red test, mutants, ini check, CI ≤ 3 and a phone re-test.
   - **(c) 13,2 appears as two separate presses (on, off, on).** The phone sent two presses. Next experiment: trace
     the app's KEY transmissions (`sendKey`) on the Android side.
   - **(d) No `kbd` line at all, while `boot` LOG lines are visible.** The trace path is not running. Next
     experiment: confirm the build has `DROIDPUTTER_KBD_MATRIX` (the overlay's generated ini or the CI log) before
     anything else.
3. **Apps to verify, in this order.** M5Cardputer example (done, #97), Pigtail (broken, #98: investigate), miniacid,
   Ultimate-Remote, BT keyboard, ISS tracker, VolosR Cardputer, Tiny-Journal, System Monitor, audiospectrum,
   WebRadio. Stellar-map (#96) and PORKCHOP (#93) are already done.

   Evidence per app, from flash_app.sh plus one added key step:
   - proxy shim sha
   - the `done: … flashed and verified` line
   - the auto-verdict line with its issue #
   - a screenshot
   - one key press: `ph.py keys` (enter, or `;`/`.`) followed by a second screenshot. The mirror region is
     pixel-diffed with PIL (available). "Changed" is the key evidence; "unchanged" is recorded as [UNVERIFIED], not
     as a failure.

   Results that the batch already has are harvested from its log, not re-run. For each broken app (Pigtail first),
   the evidence is the auto-verdict counters plus the logcat boot reason. Whether it gets fixed or refused with
   "use the prebuilt" IS FELIPE'S CALL, so I ask him before acting.
4. **Any fix:** red host test first (plus mutants for mapping logic), then green 36+N, then the old-vs-new ini
   identity check (or `overlay.py` untouched for shim-only changes), then a CI batch of ≤ 3 (the fixed app plus 2
   others), then a phone re-test of the fixed app plus stellar-map and PORKCHOP on the new shim sha.
5. **Journal and Solvr:** one `progress.txt` line per milestone, labelled [REAL]/[TEST]/[UNVERIFIED]. The
   milestones are: trace result, each fix, batch done, and the Pigtail diagnosis. Each one also gets a matching
   `[EXEC] STATUS/DONE/BLOCKED` post in the Solvr room `droidputter`. Commit and push verified work after
   `git pull --rebase`; no tags.

## Execution order (after APPROVED)
1. Let the author's batch finish without touching the phone, polling only `batch.log`. Then harvest its log and
   screenshots into my scratchpad.
2. Reconnect check, then ask Felipe for a hands-off window, then run the Marauder trace (step 2 above), then
   report the branch result.
3. Re-run whatever the batch did not finish, add the key step for every app, then the Pigtail diagnosis.
4. Fixes only per checklist item 4.

## Concerns
- HIGH: the batch is a child of the author session. Closing that session may kill it mid-flash. Felipe should
  keep the author session open until `=== BATCH DONE`, or tell me to take over.
- MEDIUM: battery 29% and draining about 1% per app while OTG powers the devkit. I stop phone runs at 15% and ask
  Felipe to charge.
- MEDIUM: the trace makes an extra LOG frame on each key change, on Marauder builds only. It stays until the bug
  is closed; removing it afterwards is the author's call.
- LOW: screenshots and evidence stay in my scratchpad, not in git (no new files unless asked).

## Questions for the author
1. Is the author session keeping the batch alive, or should I take it over after it ends?
2. Should the trace stay in the shim once Marauder enter is closed?
3. Do you agree that Pigtail's broken verdict (#98, boot loop) goes to Felipe as a fix-or-refuse question before I
   touch it?

## Verification
Every claim in the final report carries its proxy shim sha, verdict issue #, screenshot path and logcat or trace
excerpt. Shim tests run as `cd shim && pio test -e native`, once, saved to a file.
