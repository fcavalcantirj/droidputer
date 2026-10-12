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
- [INFERRED, to verify] Arduino 2.0.x enables PSRAM with `#ifdef BOARD_HAS_PSRAM`, i.e. by the macro's existence:
  an app that writes -DBOARD_HAS_PSRAM=0 (Pigtail does) still gets PSRAM mapped.
- [REAL] Our bare-S3 builds never define BOARD_HAS_PSRAM, so ESP.getPsramSize() reads 0 on an 8 MB-PSRAM devkit;
  the board label therefore reports PSRAM only when the build maps it ("s3-f16", dfa344b).
- [REAL] An interrupt-watchdog (IWDT) reset means interrupts stayed off too long on one CPU: a timing/concurrency
  failure that can look like a memory problem from the outside.
