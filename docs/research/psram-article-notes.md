# PSRAM article -- running notes

Raw material for the article Felipe asked for (SPEC items 10 and 11): what PSRAM is, how firmwares live without it,
and what the workarounds gain and cost. Append as findings land. Label every line [REAL] (measured), [TEST] or
[INFERRED].

## Background
- The ESP32-S3 has about 512 KB of on-chip SRAM, shared by code data, task stacks, Wi-Fi/BLE buffers and the heap.
  PSRAM is an extra RAM chip (2-8 MB) on an SPI bus, cached, slower; some memory must stay internal anyway (Wi-Fi
  buffers, ISR code, some DMA). Source: Espressif datasheet, via docs/research/2026-10-12-no-psram-memory-engineering-breezybox-claw.md.
- The Cardputer's StampS3 is an ESP32-S3FN8: 8 MB flash, no PSRAM (same source; the report's citations don't
  resolve, so confirm against M5Stack's own page before publishing).
- No-PSRAM techniques the report describes (BreezyBox `claw`): render the screen in strips instead of a full
  framebuffer; reserve big buffers early and lend them instead of free/realloc; judge memory by
  heap_caps_get_largest_free_block() and DMA-capable free memory, not total free heap; bound everything; stream to SD.

## The story so far: dead ends, decisions, why (validator's record, 2026-10-12)
Kept so the article can tell how we got there, not only where. Commits named where they exist.
- Hardware: bare ESP32-S3-WROOM-1-N16R8 devkit (16 MB flash, 8 MB octal PSRAM) on the USB-C OTG port of a Poco X7 Pro
  (Android 16), Droidputter from Google Play; the Cardputer ADV target is an ESP32-S3FN8 (no PSRAM).
- Symptom: Pigtail (benbaker76, an anti-stalker BLE/Wi-Fi app) boot-loops on our builds: "Interrupt wdt timeout on
  CPU0" inside the ROM BLE controller init (#98, #112; ADV #9); the upstream 1.0.11 prebuilt runs on the same devkit.
- Dead end 1 [REAL]: "the BLE library is newer" -- NimBLE-Arduino pinned back to 2.5.0 (f381e44): the binary changed
  (1,460,416 vs 1,460,496 B) and it still looped. Reverted (d7ec544).
- Dead end 2 [REAL]: "the library versions" -- upstream's CI logs had expired (GitHub HTTP 410), so versions came from
  release dates [INFERRED] and the binaries (identical esp_app_desc). Then measured: V1 = upstream unchanged with
  today's libraries (M5Cardputer 1.1.1, M5Unified 0.2.25, M5GFX 0.2.32, NimBLE 2.5.1) BOOTS; V2 = our overlay's
  libraries without the shim BOOTS. Libraries cleared; the shim is the variable.
- Dead end 3 [REAL]: the validator's "timing, not memory" suspicion (an IWDT means interrupts off too long, and ~92 KB
  internal DMA RAM was still free) -- refuted by P1: shrinking one buffer and nothing else fixed it.
- Counting lesson [REAL]: "77 Guru Meditations in 60 s" was ~24 boots/min; the panic prints on two consoles (UART0 +
  the secondary USB-Serial/JTAG), so count boots, not crash lines.
- Measurement lesson [REAL]: frames/20 s is not a throughput metric across buffer sizes; bytes out is.
- Why NOT "move the buffers to PSRAM": the Cardputer ADV has no PSRAM, and Pigtail loops there too (#9); and turning
  PSRAM on for every bare-S3 build (BOARD_HAS_PSRAM) would change every app's malloc behaviour just to fix one.
- Why NOT a per-app list (8 KB default + 4 KB for Pigtail): it only protects apps we already know, and a crash loop is a
  far worse failure than slower animation. Felipe's rule: "best, most robust".
- DECISION (validator, 2026-10-12): a 4 KB static stage floor for every app (Pigtail's ~9 KB headroom profile from
  boot) + an opportunistic 32 KB boost allocated ONCE at link-up (first HELLO_ACK, after the app's own init) only when
  the largest free internal block leaves a fixed headroom (start 64 KB): stellar-map (~280 KB free) keeps full
  throughput, Pigtail (~9 KB) stays on the floor. Pure size-choice function, host-tested; implementation pending.
- Label story [REAL]: the HELLO board label first said "s3-f16-p0" on an 8 MB-PSRAM devkit (our builds never map
  PSRAM); now PSRAM is shown only when mapped: "s3-f16" (dfa344b), "s3-f16-p8" for Pigtail (which maps it).
- Data hygiene [REAL]: a manual recovery (BOOT + RST, chip in download mode) made the app file a false public
  "stellar-map broken" verdict (#120); removed from apps/verdicts.json (45ed681) with an explanation on the issue.
- Open: why the devkit dropped off the phone's USB once (13:28 UTC, port power_role=no-power) -- unknown.

## Droidputter findings (2026-10-12)
- [REAL] Our shim's fixed internal-RAM cost: 98,592 B of .bss = dp::fb 64,800 (240x135 RGB565 shadow) + dp::stage
  32,768 + dp::ring 1,024 (ELF diff, Pigtail with vs without the shim).
- [REAL] Pigtail, Cardputer-target env on the devkit: without the shim, heap min 48,132 B, boots; with it, heap
  free 20,768 / min 9,376 B and Wi-Fi gets 5 of 8 rx buffers. Upstream build (V1) and our libs without the shim (V2)
  both boot, so the libraries are cleared and the shim is the variable.
- [REAL] Pigtail, virtual env with the shim (P0): crash loop ("Interrupt wdt timeout on CPU0", BLE never starts)
  while about 86-92 KB internal DMA-capable RAM is still free -> NOT a plain out-of-memory. Cause pending (P1: stage
  4 KB). Lesson either way: "free heap" alone does not explain a crash.
- [REAL] Arduino 2.0.x enables PSRAM with `#ifdef BOARD_HAS_PSRAM`, i.e. by the macro's existence: an app that
  writes -DBOARD_HAS_PSRAM=0 (Pigtail does) still gets PSRAM mapped -- measured twice on the N16R8 devkit: the heap
  probe's total free ~8.4 MB in Pigtail's virtual build, and its HELLO board label "s3-f16-p8" (2026-10-12).
- [REAL] Our bare-S3 builds never define BOARD_HAS_PSRAM, so ESP.getPsramSize() reads 0 on an 8 MB-PSRAM devkit;
  the board label therefore reports PSRAM only when the build maps it ("s3-f16", dfa344b).
- [REAL] An interrupt-watchdog (IWDT) reset means interrupts stayed off too long on one CPU: a timing/concurrency
  failure that can look like a memory problem from the outside.
- [REAL] The cause, by one variable (Pigtail, virtual env with the shim, bare S3 devkit, 2026-10-12, scratch builds with
  a heap probe: LOG frames of heap_caps free / largest block for MALLOC_CAP_8BIT and MALLOC_CAP_DMA, 1 s apart):
  | build | change | boots/min | internal DMA free before the radios (largest block) | BLE |
  |---|---|---|---|---|
  | P0 | today's shim | ~24 (crash loop, 8 boots / 20 s) | 91,816 B (81,908) | never starts |
  | P1 | dp::stage 32 KB -> 4 KB | 0 resets | 120,488 B (110,580) | starts; the shim links and mirrors |
  | P1b | TX ring 32 KB -> 8 KB, stage 32 KB | ~24 (crash loop) | 91,816 B (81,908) | never starts |
  In P1, Wi-Fi + BLE init then take about 117 KB of internal DMA-capable RAM: 3,308 B left at t=2 s, 2,680 B at
  t=19 s. So the radios need ~117 KB of INTERNAL DMA RAM at init and P0 had ~92 KB: the BLE controller cannot
  get it and the failure surfaces as an interrupt watchdog [the alloc-failure -> IWDT step INFERRED].
- [REAL] The 32 KB TX ring is heap and lands in PSRAM when PSRAM is mapped (P1b: total free +24.6 KB, internal DMA
  free unchanged), so it does not compete; a .bss buffer (dp::stage) always sits in internal RAM.
- [REAL] Confirmed the BOARD_HAS_PSRAM inference: Pigtail's virtual builds (-DBOARD_HAS_PSRAM=0) report ~8.4 MB total
  free (PSRAM mapped), while internal DMA-capable free is ~92 KB. "Free heap" said 8 MB while the crash was a
  92-vs-117 KB internal-RAM shortfall.
- [REAL] Operational: a firmware that crash-loops (or a half-written image) reboots the ESP32-S3 every ~2.5 s, and each
  reboot drops its USB-Serial/JTAG device, so flashing over USB fails mid-write (FLASH_DEFL_DATA timed out, "Error
  writing 64 bytes", "USB get_status request failed"). Recovery: hold BOOT, tap RST (download mode stays put), flash,
  then tap RST to start the new image.
- [REAL] Stage size vs cost (2026-10-12, scratch builds, bare S3 devkit, dev app; ESP-side STATS for the first ~30 s
  after boot; 0 frames dropped in every run). "Frames/20 s" is NOT a throughput measure across stage sizes (a smaller
  stage splits an update into more, smaller frames: stellar-map 763 -> 941 frames), so bytes out is the measure:
  | stage | stellar-map bytes out | Marauder bytes out | stellar-map internal heap free | Pigtail (virtual) |
  |---|---|---|---|---|
  | 32 KB | 12.9 MB | 0.52 MB | 250,956 B | crash loop (P0) |
  | 16 KB | 13.8 MB | 0.54 MB | 267,340 B | not tested (~108 KB DMA free, computed) |
  | 8 KB | 10.9 MB (-16 %) | 0.51 MB | 275,532 B | boots, BLE up, links |
  | 4 KB | 7.1 MB (-45 %) | 0.51 MB | 279,628 B | boots (P1) |
  Static RAM moves by exactly the stage delta (stellar-map 125,864 -> 97,192 B). Animated full-screen apps pay for a
  small stage (fewer rows per flush tick, so redraws coalesce [INFERRED from the flush code]); menu apps pay nothing.
- [REAL] Margin, not just "boots" (Pigtail virtual, 5 min each, probe every 10 s; heap_caps minimum-since-boot):
  | stage | DMA free before radios | DMA free after radios (end / min) | largest internal block (min) | internal free (min) | warnings |
  |---|---|---|---|---|---|
  | 8 KB | 116,392 B | 2,296 / 892 B | 3,572 B | 4,564 B | none, 0 resets |
  | 4 KB | 120,488 B | 1,960 / 1,404 B | 7,668 B | 9,188 B | none, 0 resets |
  The radios take nearly all internal DMA RAM that exists (~2 KB left either way): DMA headroom does not scale
  with what we free, so "min DMA free >= 8 KB" is unreachable this way; the freed RAM shows up as general internal
  headroom (largest block and minimum free roughly double from 8 KB to 4 KB).
- [REAL] SPEC 8 label with PSRAM mapped: the Pigtail scratch build (it maps PSRAM via -DBOARD_HAS_PSRAM=0) reports
  "s3-f16-p8" on the N16R8 devkit.
- [REAL] When could a shim size its buffers "after the app's init"? Link-up (the phone's first HELLO_ACK) vs the
  app's own allocations, bare S3 devkit, probe every 0.5 s:
  | app | first HELLO_ACK | largest internal block at the ack | later |
  |---|---|---|---|
  | stellar-map | 333 ms | 221,172 B | flat (no radios) |
  | Marauder | 1,604 ms | 131,060 B | 77,812 B from ~3 s (its own allocations; radios start only on demand) |
  | Pigtail | 505 ms | 110,580 B | radios start at ~2.25 s, then 7,668 B |
  Link-up comes BEFORE a radio app's init (Pigtail: ~1.7 s earlier), so "the RAM looks free at link-up" is not
  "the app is done allocating". Any later grab must leave room for the app's worst case (Wi-Fi + BLE took ~117 KB
  of internal RAM here), not a guessed margin.
