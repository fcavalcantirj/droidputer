// Pure, host-testable core of the Cardputer GPIO keyboard-matrix emulation (dp_kbdmatrix.cpp): is a given column
// input LOW while the driver drives a given row value? Mirrors the original Cardputer keyboard driver (M5's, as
// vendored by ESP32Marauder): rows 0..7 on G8/G9/G11, 7 column inputs; a held key at matrix (x = column 0..13,
// y = row 0..3, the coordinates the phone sends) pulls column x / 2 low while the row value is 7 - y for even x and
// 3 - y for odd x -- the inverse of the driver's X_map_chart / coor.y = 3 - (i mod 4). No Arduino headers.
#pragma once
#include <stdint.h>

namespace dp {

inline bool kbdmapColumnLow(int row, int column, const uint8_t* ys, const uint8_t* xs, uint8_t held) {
  for (uint8_t k = 0; k < held; k++) {
    const int x = xs[k], y = ys[k];
    const int keyRow = (x % 2 == 0) ? 7 - y : 3 - y;
    if (keyRow == row && x / 2 == column) return true;
  }
  return false;
}

}  // namespace dp
