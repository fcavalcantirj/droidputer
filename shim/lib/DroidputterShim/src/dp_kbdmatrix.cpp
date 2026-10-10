// Cardputer GPIO keyboard-matrix emulation (see dp_kbdmatrix.h). Compiled into every shim build, active only with
// -DDROIDPUTTER_KBD_MATRIX (which the overlay sets together with -include dp_kbdmatrix.h).
#if defined(ARDUINO) && defined(DROIDPUTTER_KBD_MATRIX)
#include "droidputter.h"
#include "dp_kbdmap.h"
#include "driver/gpio.h"
#include "soc/gpio_reg.h"
#undef gpio_get_level
extern "C" int gpio_get_level(gpio_num_t gpio_num);   // the real one (its header declaration was renamed by the macro)

// Column pins in the order the original keyboard driver reads them (input_list); the row/column math is dp_kbdmap.h.
static const int8_t kColumnPins[7] = {13, 15, 3, 4, 5, 6, 7};

extern "C" int dp_gpio_get_level(gpio_num_t pin) {
  int column = -1;
  for (int k = 0; k < 7; k++)
    if (kColumnPins[k] == (int)pin) { column = k; break; }
  if (column < 0) return gpio_get_level(pin);
  const uint32_t out = REG_READ(GPIO_OUT_REG);   // the output latch: readable even on output-only pins
  const int row = ((out >> 8) & 1) | (((out >> 9) & 1) << 1) | (((out >> 11) & 1) << 2);
  // ONE snapshot of the phone's held keys per matrix scan (the driver scans rows 0..7, columns 0..6 in order, so a
  // scan starts at row 0 / column 0), and a tap reported to exactly one scan: the original Cardputer driver's apps
  // act on the key LEVEL every scan (Marauder: one select per scan), so a tap kept for two scans selected twice.
  static uint8_t ys[16], xs[16], held = 0;
  if (row == 0 && column == 0) held = dp::injectedKeysOnce(ys, xs, 16);
  return dp::kbdmapColumnLow(row, column, ys, xs, held) ? 0 : 1;   // a held key pulls its column low; idle = pulled up
}
#endif
