---
verdict: APPROVED
round: 1
---

# Review r1

Judged only against the handover's acceptance checklist and blocking constraints.

## Blocking constraints
All six restated correctly and in the builder's own words (frozen identifiers, spike-before-plan, secrets only in
Vercel env, overlay/shim changes proven on targets + regression pairs in small batches, no loop runners / no flash
without OK + device ritual, page honesty).

## Checklist verdicts
1. SA guide: satisfied — step-by-step (project, API, SA, JSON key, Play Console invite with "View app information
   (read-only)"), key piped into `vercel env add` with no git and no echo, and P0 proves the pipe on a dummy var first
   so Felipe is not the test bot.
2. `stats.js` Play block: satisfied — RS256 JWT with `node:crypto` (no new dependency), freshness-bounded DAILY 30-day
   query of `distinctUsers`/`crashRate`/`userPerceivedCrashRate`, token + 30-min result cache, fail-soft; the first real
   query's `fields_seen` gates the page section; ANR shown only if its first query returns the fields.
3. Page section: satisfied — tiles, daily-users and crash-rate lines with the existing `line()`, rows in `tablesFrom()`
   (tables + CSV) and the JSON export, Google + America/Los_Angeles caption, explicit not-connected/no-data states,
   screenshots at 390/1280 px in both themes.
4. M4 spike: satisfied — the app choice is argued from a new [REAL] fact (Bruce is arduino-esp32 3.x, so the 2.x
   spike app must be Marauder's Cardputer target); the five named tee points plus a bus counter that turns the
   drawChar fast-path/pushColor gap into a measured coverage ratio; no SPI/pins in the virtual env; Bruce's vendored
   2.5.43 addressed by diff + `patch --dry-run`, its full build honestly deferred behind the 3.x result.
5. 3.x spike: satisfied — shim + stellar-map on pioarduino 55.03.39, staged a→d so every error has an owner, the three
   3.x apps compiled for a green count, `boot_app0.bin`/offsets re-measured against `build-app.yml`, then a
   "separate core3 env vs migration" plan from the numbers.
6. Phone acceptance: satisfied — emulator rehearsal first (no proxy build, so no test traffic in the live panels),
   7-step checklist covering crash A and crash B, each step mapped to the PostHog event that proves it, confirmed by a
   time-bounded HogQL query at least 3 min later.
7. Gates/journal/Solvr: satisfied — gate named per step, `progress.txt` per deliverable, Solvr posts, local spike
   builds (no CI emails) and CI regression batches of at most 3 runs.

## Handover discrepancies — accepted
- 1 (Bruce = 3.x) and 4 (57 direct `tft_Write_*` writes) are real findings that change the M4 strategy; the plan
  already absorbs them. They go into the M4 report.
- 9: correct — the directory is `2026-10-09-droidputter-next`; the handover body misspells it. The author's error; no
  action beyond using the real path.
- 3 (flock-you refusal possibly a false positive) and 8 (stale "60 s" comment): fine as scoped (comment fix inside P2;
  flock-you journaled, not fixed this round).

## Answers to the builder's questions
1. Yes. Marauder (`justcallmekoko`, `MARAUDER_CARDPUTER`, 2.x) is the M4 spike app. Bruce = diff + `patch --dry-run` on
   its vendored 2.5.43 now; its full build only after S-3x reports.
2. Yes, the bare S3 devkit gets the full ritual (two identical full reads → test → restore → read-back sha256
   identical), same as the StickS3. Ask Felipe ONCE for one flash OK that lists every image you will flash in that
   sitting (M4 coverage sketch, Marauder, stellar-map core3) and the device; never flash anything not on that list.
3. Higher: put "Google Play" right after "What real phones did" and before "How people used it so far" — daily users
   are the strongest answer to Felipe's "how many people use it" question.
4. Deferred this round. P1 offers the account-level bulk-report permission as optional; if Felipe ticks it, installs
   are a follow-up gated by its own first real read, after the DAU section ships.

## Closing
APPROVED. The builder is now the primary session; the author session stops here. First move (`next_action`): run P0
(prove the `vercel env add` stdin pipe on a dummy var and remove it), then send Felipe the P1 service-account guide, and
while he does it start the S-M4 spike in a throwaway, timeout-guarded scratch directory, reporting measured numbers only.
