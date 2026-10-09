// Headers the arduino-esp32 3.x core and Arduino-IDE builds pull in implicitly, force-included by tools/overlay.py
// ONLY on a retry after a build failed on one of their symbols ('Wire' / 'function' / 'vTaskDelay' was not declared:
// Game-Station, Evil-M5Core2, ESP32-Bus-Pirate, 2026-10-09). A build that already compiles never sees this file.
#pragma once
#if defined(__cplusplus) && !defined(__ASSEMBLER__)
#include <Arduino.h>
#include <functional>
#include <Wire.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#endif
