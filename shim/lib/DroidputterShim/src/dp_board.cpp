#include "dp_board.h"
#include <stdio.h>

namespace dp {
static unsigned long mib(uint32_t bytes) { return (unsigned long)(((uint64_t)bytes + (1u << 19)) >> 20); }

void dp_board_label(char out[DP_BOARD_LABEL_LEN], int m5_board, uint32_t flash_bytes, uint32_t psram_bytes) {
  if (m5_board == 14) snprintf(out, DP_BOARD_LABEL_LEN, "cardputer");
  else if (m5_board == 24) snprintf(out, DP_BOARD_LABEL_LEN, "cardputer-adv");
  else if (m5_board > 0) snprintf(out, DP_BOARD_LABEL_LEN, "m5board-%d", m5_board);
  else snprintf(out, DP_BOARD_LABEL_LEN, "s3-f%lu-p%lu", mib(flash_bytes), mib(psram_bytes));
}
}  // namespace dp
