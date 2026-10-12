---
slug: droidputter-firmware-fixes
date: 2026-10-12
status: open
round: 0
author_session: 2026-10-10..12 builder session (Marauder enter fix, v0.0.8, stats truth, flash-failure issues) at ~96% context
---

# Handover: fix the firmwares in docs/FIRMWARES-TO-FIX.md

## Mission
Felipe (2026-10-12): fix all firmwares that need it, from `docs/FIRMWARES-TO-FIX.md`. Scope is **compatibility only**
(CLAUDE.md "Scope"): a firmware builds against the shim, flashes from the phone, mirrors, takes phone keys. Overlay
(`tools/overlay.py`) and shim only; never edit app sources; never operate any app's features.

## Read first
`CLAUDE.md`, `AGENTS.md`, `docs/FIRMWARES-TO-FIX.md`, `SPEC.md` roadmap item 7a, the last `progress.txt` entries
(2026-10-12), memory `project-droidputter-next-2026-10-12`.

## Where things stand [REAL unless marked]
- main = 73dd6f9 (plus bot `verdicts:` commits; always `git pull --rebase --autostash`).
- Released: v0.0.8 GitHub Release (Play upload = Felipe's, done/under review). Shim content key `b9a14a6.cd54eb4`.
- Proxy (personal Vercel `droidputter-proxy`, deploy `cd proxy && vercel --prod`): content-keyed build cache;
  designed refusals end green; `/api/flash-failures` files `flash-failed` issues, cron `0 12 * * *` (12:xx UTC).
  Its first scheduled run (09:00:47 UTC, old schedule) answered 502; fix 21a4428 (PostHog retry + error logging);
  cron-path runs 10:59 and 11:03 UTC answered 200. **Today's 12:xx scheduled run is NOT yet observed.**
- Stats site (git-connected: push to main with a site/ change deploys; never `vercel deploy` from site/).
- Lane A started: marivaaldo/ESP32Marauder spiked = Marauder v1.1.0 (2024-11-19), no Cardputer support at all ->
  drop it from `TFT_RECIPES` (not done yet).

## Blocking constraints
1. Compatibility only; overlays/shim only; never edit app sources.
2. Any overlay change: old-vs-new generator ini identity for the other overlays (M5PORKCHOP, stellar-map, ISS tracker,
   miniacid, VolosR/Cardputer + refusals flock-you, M5Stick-Launcher), both envs. CI <= 3 builds in flight.
3. Red test / failing run first, then the fix, then green; mutants for logic.
4. Phone runs only with Felipe's hands-off window (AskUserQuestion); phone = Xiaomi on wireless ADB
   (`ADB_MDNS_OPENSCREEN=0`), see memory reference-droidputter-phone-wireless-adb.
5. Secrets never printed; Vercel env values only via files deleted after use.
6. A tool that writes a proxy `tools/overlay.py` change moves every app's build identity (cache rebuilds once).

## Pending edits to fold into docs/FIRMWARES-TO-FIX.md (from the validator, not yet applied)
- Counts: 78 real pairs, 43 build, 35 do not = 7 fixable + 28 refused (flock-you is a refusal whose run is green
  since 07d6701; "success" no longer means "built" -- built = has parts, no failure.json).
- Section 1: the community Cardputer-ADV "broken" rows (stellar-map, System Monitor, `droidputter`) look like a wrong
  board or a transient, not firmware bugs [INFERRED by the validator from same-firmware works/broken pairs]; idea
  (needs a spike): the flasher reads flash size from the ROM and warns on a target mismatch. PORKCHOP ADV stays
  "re-test on a real ADV".

## Plan (validator's lanes, SPEC 7a)
- Lane A (no device, CI is the gate): marivaaldo (drop from TFT_RECIPES), Cardputer-Game-Station-Emulators (`'Wire'
  was not declared`), n0xa/m5stick-nemo (BLE API -> per-repo lib pin; LIB_PINS was removed in d7ec544, re-add
  data-only only if needed), 7h30th3r0n3/Evil-M5Core2 (`'function' does not name a type`). Skip ESP32-Bus-Pirate and
  cardputer-ai (need arduino-esp32 3.x).
- Lane B (one phone batch at the end, ask Felipe): flash + mirror + one navigation key per Lane-A build; Pigtail
  no-shim experiment; ADV-target re-tests need his Cardputer ADV (ask if available).

## Acceptance checklist
1. Restates the 6 constraints.
2. Verifies today's 12:xx UTC scheduled flash-failures run: `node_modules/.bin/vercel logs --environment production
   --json` (path /api/flash-failures after 12:00 UTC, status) + PostHog event `flash_failures_run` trigger=cron.
3. Each Lane-A fix: the failing run as red, the overlay change, ini identity proof, a green CI build via the proxy.
4. docs/FIRMWARES-TO-FIX.md updated (validator corrections + each fix), `progress.txt` entry per milestone, Solvr
   room `droidputter` posts.

## next_action
Verify the 12:xx UTC scheduled run (checklist 2), then Lane A item 1: drop marivaaldo from `TFT_RECIPES`.
