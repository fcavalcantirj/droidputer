// Cardputer GPIO keyboard-matrix emulation (see dp_kbdmatrix.h). Compiled into every shim build, active only with
// -DDROIDPUTTER_KBD_MATRIX (which the overlay sets together with -include dp_kbdmatrix.h).
#if defined(ARDUINO) && defined(DROIDPUTTER_KBD_MATRIX)
#include "droidputter.h"
#include "driver/gpio.h"
#include "soc/gpio_reg.h"
#undef gpio_get_level
extern "C" int gpio_get_level(gpio_num_t gpio_num);   // the real one (its header declaration was renamed by the macro)

// Column pins in the order the original keyboard driver reads them (input_list); row = the 3-bit value it writes to
// G8 (bit 0), G9 (bit 1), G11 (bit 2). A key at matrix (x = column 0..13, y = row 0..3, the coordinates the phone
// sends) is seen on column pin x / 2 while the row value is 7 - y for even x, 3 - y for odd x -- the inverse of the
// driver's X_map_chart / coor.y = 3 - (i mod 4) mapping.
static const int8_t kColumnPins[7] = {13, 15, 3, 4, 5, 6, 7};

extern "C" int dp_gpio_get_level(gpio_num_t pin) {
  int column = -1;
  for (int k = 0; k < 7; k++)
    if (kColumnPins[k] == (int)pin) { column = k; break; }
  if (column < 0) return gpio_get_level(pin);
  const uint32_t out = REG_READ(GPIO_OUT_REG);   // the output latch: readable even on output-only pins
  const int row = ((out >> 8) & 1) | (((out >> 9) & 1) << 1) | (((out >> 11) & 1) << 2);
  // ONE snapshot of the phone's held keys per matrix scan: the driver scans rows 0..7, columns 0..6 in order, so a
  // scan starts at row 0 / column 0. dp::injectedKeys() counts snapshots to keep a quick tap visible for
  // DP_KEYS_MIN_SEEN app polls; called on all 56 column reads it would expire a tap inside one scan.
  static uint8_t ys[16], xs[16], held = 0;
  if (row == 0 && column == 0) held = dp::injectedKeys(ys, xs, 16);
  for (uint8_t k = 0; k < held; k++) {
    const int x = xs[k], y = ys[k];
    const int keyRow = (x % 2 == 0) ? 7 - y : 3 - y;
    if (keyRow == row && x / 2 == column) return 0;   // a held key pulls its column low
  }
  return 1;   // idle column: pulled up
}
#endif
