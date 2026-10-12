// Native tests for dp_board.{h,cpp}: HELLO's board label (SPEC roadmap 8).
#include <unity.h>
#include <string.h>
#include "dp_board.h"

void setUp(void) {}
void tearDown(void) {}

struct Guarded { char label[dp::DP_BOARD_LABEL_LEN]; char canary[8]; };

static const char* label(int m5_board, uint32_t flash, uint32_t psram) {
  static Guarded g;
  memset(&g, 'X', sizeof g);
  dp::dp_board_label(g.label, m5_board, flash, psram);
  TEST_ASSERT_EQUAL_MEMORY("XXXXXXXX", g.canary, 8);   // never writes past the 16-byte field
  TEST_ASSERT_TRUE(strnlen(g.label, dp::DP_BOARD_LABEL_LEN) < dp::DP_BOARD_LABEL_LEN);   // NUL inside the field
  return g.label;
}

static void test_real_panel_cardputer(void) { TEST_ASSERT_EQUAL_STRING("cardputer", label(14, 0, 0)); }
static void test_real_panel_cardputer_adv(void) { TEST_ASSERT_EQUAL_STRING("cardputer-adv", label(24, 0, 0)); }
static void test_real_panel_other_board_by_number(void) { TEST_ASSERT_EQUAL_STRING("m5board-26", label(26, 0, 0)); }
// Autodetect found nothing: a Cardputer-target build on a board that isn't one -- the verdict's env plus the chip
// facts say exactly that (the suspected wrong-board community reports).
static void test_real_panel_autodetect_failed_gives_chip_facts(void) {
  TEST_ASSERT_EQUAL_STRING("s3-f8-p0", label(0, 8u << 20, 0));
}
static void test_real_panel_ignores_chip_facts(void) {
  TEST_ASSERT_EQUAL_STRING("cardputer-adv", label(24, 16u << 20, 8u << 20));
}

static void test_virtual_devkit_n16r8(void) {
  // ESP.getPsramSize() reports the PSRAM heap: a little under the chip size, so MB rounds to nearest.
  TEST_ASSERT_EQUAL_STRING("s3-f16-p8", label(-1, 16u << 20, 8386295u));
}
static void test_virtual_no_psram(void) { TEST_ASSERT_EQUAL_STRING("s3-f8-p0", label(-1, 8u << 20, 0)); }
static void test_virtual_rounds_half_up(void) {
  TEST_ASSERT_EQUAL_STRING("s3-f4-p2", label(-1, 4u << 20, (2u << 20) - (1u << 19)));   // 1.5 MiB -> 2
  TEST_ASSERT_EQUAL_STRING("s3-f4-p1", label(-1, 4u << 20, (1u << 20) + (1u << 19) - 1));  // just under 1.5 -> 1
}

static void test_long_labels_truncate_inside_16_bytes(void) {
  const char* l = label(2147483647, 0, 0);            // "m5board-2147483647" = 18 chars
  TEST_ASSERT_EQUAL_size_t(15, strlen(l));
  TEST_ASSERT_EQUAL_STRING("m5board-2147483", l);
  TEST_ASSERT_LESS_OR_EQUAL_size_t(15, strlen(label(-1, 0xFFFFFFFFu, 0xFFFFFFFFu)));
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_real_panel_cardputer);
  RUN_TEST(test_real_panel_cardputer_adv);
  RUN_TEST(test_real_panel_other_board_by_number);
  RUN_TEST(test_real_panel_autodetect_failed_gives_chip_facts);
  RUN_TEST(test_real_panel_ignores_chip_facts);
  RUN_TEST(test_virtual_devkit_n16r8);
  RUN_TEST(test_virtual_no_psram);
  RUN_TEST(test_virtual_rounds_half_up);
  RUN_TEST(test_long_labels_truncate_inside_16_bytes);
  return UNITY_END();
}
