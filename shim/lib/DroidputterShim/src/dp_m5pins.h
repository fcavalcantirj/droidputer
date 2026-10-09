// M5 pin names for the bare-ESP32-S3 build (env m5cardputer-virtual), force-included by tools/overlay.py.
// That env compiles against the generic esp32-s3-devkitc-1 variant (the StampS3 variant hangs a bare S3 at
// boot, progress.txt 2026-09-16), which lacks the G<n> names the StampS3 variant gives every Cardputer app:
// miniacid failed 10 builds on `'G2' was not declared` (2026-10-09). Same names and values as
// variants/m5stack_stamp_s3/pins_arduino.h in the pinned framework (arduino-esp32 2.0.17).
#pragma once
#if defined(__cplusplus) && !defined(__ASSEMBLER__)
#include <stdint.h>
static const uint8_t G0  = 0;
static const uint8_t G1  = 1;
static const uint8_t G2  = 2;
static const uint8_t G3  = 3;
static const uint8_t G4  = 4;
static const uint8_t G5  = 5;
static const uint8_t G6  = 6;
static const uint8_t G7  = 7;
static const uint8_t G8  = 8;
static const uint8_t G9  = 9;
static const uint8_t G10 = 10;
static const uint8_t G11 = 11;
static const uint8_t G12 = 12;
static const uint8_t G13 = 13;
static const uint8_t G14 = 14;
static const uint8_t G15 = 15;
static const uint8_t G39 = 39;
static const uint8_t G40 = 40;
static const uint8_t G41 = 41;
static const uint8_t G42 = 42;
static const uint8_t G43 = 43;
static const uint8_t G44 = 44;
static const uint8_t G46 = 46;
#endif
