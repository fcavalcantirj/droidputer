// Native tests for dp_stage.{h,cpp}: the RLE stage size decided once at link-up (2026-10-12).
#include <unity.h>
#include "dp_stage.h"

void setUp(void) {}
void tearDown(void) {}

static const size_t FLOOR = 4096, BOOST = 32768, HEADROOM = 120 * 1024;

static void test_boost_when_the_boost_and_the_headroom_both_fit(void) {
  TEST_ASSERT_EQUAL_size_t(BOOST, dp::dp_choose_stage(221172, FLOOR, BOOST, HEADROOM));   // stellar-map at link-up
}
static void test_floor_for_a_radio_app_before_its_radios_start(void) {
  TEST_ASSERT_EQUAL_size_t(FLOOR, dp::dp_choose_stage(110580, FLOOR, BOOST, HEADROOM));   // Pigtail at link-up
  TEST_ASSERT_EQUAL_size_t(FLOOR, dp::dp_choose_stage(131060, FLOOR, BOOST, HEADROOM));   // Marauder at link-up
}
static void test_threshold_is_inclusive(void) {
  TEST_ASSERT_EQUAL_size_t(BOOST, dp::dp_choose_stage(BOOST + HEADROOM, FLOOR, BOOST, HEADROOM));
  TEST_ASSERT_EQUAL_size_t(FLOOR, dp::dp_choose_stage(BOOST + HEADROOM - 1, FLOOR, BOOST, HEADROOM));
}
static void test_nothing_free_stays_on_the_floor(void) {
  TEST_ASSERT_EQUAL_size_t(FLOOR, dp::dp_choose_stage(0, FLOOR, BOOST, HEADROOM));
}
static void test_a_boost_no_bigger_than_the_floor_is_never_taken(void) {
  TEST_ASSERT_EQUAL_size_t(FLOOR, dp::dp_choose_stage(10u << 20, FLOOR, FLOOR, HEADROOM));
  TEST_ASSERT_EQUAL_size_t(FLOOR, dp::dp_choose_stage(10u << 20, FLOOR, 1024, HEADROOM));
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_boost_when_the_boost_and_the_headroom_both_fit);
  RUN_TEST(test_floor_for_a_radio_app_before_its_radios_start);
  RUN_TEST(test_threshold_is_inclusive);
  RUN_TEST(test_nothing_free_stays_on_the_floor);
  RUN_TEST(test_a_boost_no_bigger_than_the_floor_is_never_taken);
  return UNITY_END();
}
