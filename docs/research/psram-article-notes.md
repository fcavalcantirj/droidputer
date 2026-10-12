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
