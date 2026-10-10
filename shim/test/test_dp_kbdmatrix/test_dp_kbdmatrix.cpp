// The keyboard-matrix emulation, checked against the ORIGINAL driver's own decode (ESP32Marauder Keyboard.cpp,
// MARAUDER_CARDPUTER: X_map_chart + coor.y = 3 - (i mod 4)), replayed here over dp::kbdmapColumnLow.
#include <unity.h>
#include <vector>
#include "dp_keys.h"
#include "dp_kbdmap.h"

struct Chart { uint8_t value, x_1, x_2; };
static const Chart X_map_chart[7] = {{1, 0, 1}, {2, 2, 3}, {4, 4, 5}, {8, 6, 7}, {16, 8, 9}, {32, 10, 11}, {64, 12, 13}};
struct P { int x, y; };

// Marauder's updateKeyList(), with _get_input() reading the emulated column levels for the snapshot.
static std::vector<P> driverScan(const uint8_t* ys, const uint8_t* xs, uint8_t held) {
  std::vector<P> keys;
  for (int i = 0; i < 8; i++) {
    uint8_t input_value = 0;
    for (int j = 0; j < 7; j++)
      if (dp::kbdmapColumnLow(i, j, ys, xs, held)) input_value |= (uint8_t)(1 << j);   // LOW = pressed
    if (!input_value) continue;
    for (int j = 0; j < 7; j++) {
      if (!(input_value & (1 << j))) continue;
      P coor;
      coor.x = (i > 3) ? X_map_chart[j].x_1 : X_map_chart[j].x_2;
      coor.y = (i > 3) ? (i - 4) : i;
      coor.y = -coor.y + 3;
      keys.push_back(coor);
    }
  }
  return keys;
}

void setUp() {}
void tearDown() {}

static void test_every_key_decodes_back_to_itself(void) {
  for (uint8_t y = 0; y < 4; y++)
    for (uint8_t x = 0; x < 14; x++) {
      uint8_t ys[1] = {y}, xs[1] = {x};
      std::vector<P> got = driverScan(ys, xs, 1);
      TEST_ASSERT_EQUAL_INT_MESSAGE(1, (int)got.size(), "exactly one key decoded");
      TEST_ASSERT_EQUAL_INT(x, got[0].x);
      TEST_ASSERT_EQUAL_INT(y, got[0].y);
    }
}

static void test_two_held_keys_both_decode(void) {   // shift + 9 = '(' on the original keyboard
  uint8_t ys[2] = {2, 0}, xs[2] = {1, 9};
  std::vector<P> got = driverScan(ys, xs, 2);
  TEST_ASSERT_EQUAL_INT(2, (int)got.size());
  bool shift = false, nine = false;
  for (auto& p : got) { shift |= (p.x == 1 && p.y == 2); nine |= (p.x == 9 && p.y == 0); }
  TEST_ASSERT_TRUE(shift); TEST_ASSERT_TRUE(nine);
}

static void test_no_key_no_column_low(void) {
  TEST_ASSERT_EQUAL_INT(0, (int)driverScan(nullptr, nullptr, 0).size());
}

static void test_enter_tap_is_seen_by_exactly_one_scan(void) {   // the double-select of 2026-10-10
  dp::dp_keys_release_all();
  dp::dp_keys_push(2, 13, 1); dp::dp_keys_push(2, 13, 0);
  uint8_t ys[16], xs[16];
  uint8_t held = dp::dp_keys_snapshot_min(ys, xs, 16, 1);
  std::vector<P> scan1 = driverScan(ys, xs, held);
  held = dp::dp_keys_snapshot_min(ys, xs, 16, 1);
  std::vector<P> scan2 = driverScan(ys, xs, held);
  TEST_ASSERT_EQUAL_INT(1, (int)scan1.size());
  TEST_ASSERT_EQUAL_INT(13, scan1[0].x); TEST_ASSERT_EQUAL_INT(2, scan1[0].y);
  TEST_ASSERT_EQUAL_INT(0, (int)scan2.size());
}

int main(int argc, char** argv) {
  UNITY_BEGIN();
  RUN_TEST(test_every_key_decodes_back_to_itself);
  RUN_TEST(test_two_held_keys_both_decode);
  RUN_TEST(test_no_key_no_column_low);
  RUN_TEST(test_enter_tap_is_seen_by_exactly_one_scan);
  return UNITY_END();
}
