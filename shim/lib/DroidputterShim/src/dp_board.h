// HELLO's board field (docs/PROTOCOL.md, char[16]): what the ESP really is, not a constant.
// Pure (no Arduino headers) so `pio test -e native` covers it; droidputter.cpp feeds it once at begin().
#pragma once
#include <stddef.h>
#include <stdint.h>

namespace dp {
constexpr size_t DP_BOARD_LABEL_LEN = 16;   // the HELLO field, NUL included
// m5_board > 0: the board_t M5GFX's autodetect settled on (real-panel builds): 14 -> "cardputer",
// 24 -> "cardputer-adv", any other -> "m5board-<n>".
// m5_board <= 0: no board -- autodetect found nothing (0: a Cardputer-target build on a board that isn't one; the
// verdict's env says which target) or never ran (-1: virtual builds, TFT_eSPI apps) -> chip facts
// "s3-f<flash MB>-p<psram MB>", each rounded to the nearest MiB. p is the build's usable PSRAM (the heap's size, a
// little under the chip's): a build without PSRAM enabled reports p0 on a PSRAM chip.
void dp_board_label(char out[DP_BOARD_LABEL_LEN], int m5_board, uint32_t flash_bytes, uint32_t psram_bytes);
}  // namespace dp
