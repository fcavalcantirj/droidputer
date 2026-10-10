---
verdict: APPROVED
round: 1
---

# Review r1 — APPROVED with binding amendments (no new round)

The amendments below are part of the approval. Fold them into execution and report them in the final report;
do not write a PLAN-r2.

## Checklist
1. **Satisfied.** All 6 constraints are restated correctly. The reconnect steps (OPENSCREEN=0, dns-sd -B/-L, timeouts,
   DEV/D update) are given, and hands-off windows are asked with AskUserQuestion stating the duration.
2. **Satisfied in structure; the branch conclusions are amended (A1–A4).** The first step is exactly `next_action`,
   and the plan branches on measurement. But branch (a)'s "app-side" and branch (b)'s "edge, not level" fix go beyond
   what the trace can show.
3. **Satisfied**, with A5 on which keys to press. The app order and the per-app evidence are right, and harvesting
   the batch log instead of re-running it is right.
4. **Satisfied.** Red test first, `overlay.py` untouched (or the ini identity check), CI ≤ 3, and a phone re-test of the
   fixed app plus stellar-map and PORKCHOP.
5. **Satisfied.**

## Binding amendments
- **A1 — branch (a), "one scan and the menu still returns", is not proof of app-side.**
  - [REAL, code read] `dp_kbdmatrix.cpp:28-33`: the phone keys are sampled only on the read of row 0 / column 0.
  - Every other matrix read until the next (0,0) read answers from the same static `ys/xs/held` snapshot.
  - So a read made outside a full scan, after scan N, still sees scan N's enter, and the per-scan trace cannot show it.
  - Before recording app-side, run two more experiments:
    - (i) A read-level trace in the same Marauder-only path (LOG frames, kbd_matrix builds only, like c09487b). For
      each snapshot interval, log the number of matrix reads and every read that returned LOW (row, column, ms).
    - (ii) Enter once on two different top-level entries that open a submenu, to tell an item-specific return from a
      generic one.
  - Only then: app-side, with both traces as evidence, and Open Question 1 goes to Felipe.
- **A2 — branch (b): hold time is real, so "the count scales with the hold" is expected, not a bug.**
  - [REAL, code read] `SoftKeyboard.kt:81-97` sends KEY down on press and KEY up on release.
  - `MainActivity.kt:761` logs every send as `key r=<row> c=<col> down|up`, under tag `Droidputter`, in the same logcat
    capture.
  - A held key is visible every scan by design, because a physical key is.
  - The criterion: on-span = `t` of the last scan with 13,2 minus `t` of the first (ESP clock), compared with the
    phone's down→up interval from the `key r=2 c=13` lines (phone clock; compare durations only).
    - on-span ≤ hold + one scan period: the shim is faithful, so continue with A1.
    - on-span > hold + one scan period: the shim keeps the key after its up. Write a red host test for that.
  - An "edge, report once per press" change is **excluded**: it would drop a held key after one scan for every
    kbd_matrix app.
- **A3 — branch (c).** The method exists already: count the `key r=2 c=13 down` lines in the same capture. No Android
  change is needed.
- **A4 — add branch (e), "not reproduced"** (the submenu stays on 3 of 3 presses). Repeat once with the 300 ms hold and
  once with fn latched (Felipe: "with or without FN"). If it still does not reproduce, record "not reproduced on
  c09487b" with the trace, and stop that item.
- **A5 — keys (scope).**
  - The per-app key evidence uses navigation keys: arrows (fn-mode `;` `.`) or the app's menu key (PORKCHOP: backtick).
  - Enter is pressed only on a top-level entry that opens a submenu.
  - In Marauder, never select an entry inside a submenu.
- **A6 — Pigtail: fixing it does not need a question.**
  - [REAL] `rst=5` is `ESP_RST_INT_WDT` (interrupt watchdog), the 6th value of the `esp_reset_reason_t` enum in the
    2.0.17 framework's `esp_system.h`.
  - Felipe already authorized spiking and fixing any firmware that doesn't work (2026-10-10: "you CAN make marauder and
    every firwmware burnt that doesnt work, you are allowed to spike and make it work").
  - So: measure the cause (no guessing), then fix per checklist item 4.
  - Ask Felipe only if the measured result is "cannot work", because a refusal or "use the prebuilt" IS FELIPE'S CALL.

## Answers to the builder's questions
1. **The author session keeps the batch alive** until `batch.log` ends with `=== BATCH DONE hh:mm:ss`, so poll for
   that line. After it, the phone is yours alone.
   - Done so far: miniacid works (#99). Ultimate-Remote was building at 02:57.
   - Screenshots are `b-<tag>.png` beside `batch.log`.
   - Use the tracked `tools/` copies for your own runs.
2. **No.** Remove the key trace, and A1's read-level trace, in the commit that closes the enter item (fix or recorded
   residual).
3. **No.** See A6.

## Status
The handover is APPROVED, and the builder is now the primary session. `next_action` is unchanged:
1. Wait for `=== BATCH DONE`.
2. Reconnect ADB.
3. Ask Felipe for a hands-off window.
4. Run `tools/flash_app.sh justcallmekoko/ESP32Marauder m-trace`, press enter once while capturing logcat, and read
   the trace.
