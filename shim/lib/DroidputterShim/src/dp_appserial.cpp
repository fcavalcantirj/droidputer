// The real-port side of dp_appserial.h: writes reach the USB serial port under the link lock. Compiled into every shim
// build without the app flag (so Serial here is always the core's port); unreferenced, the linker drops it.
#ifdef ARDUINO
#include <Arduino.h>
#include <stddef.h>
#include "dp_internal.h"
#ifdef Serial
#undef Serial
#endif

size_t dp_app_serial_write(const uint8_t* data, size_t n) {
  dp::internal::LinkLock guard;   // a frame the shim is writing is never split by app text
  return Serial.write(data, n);
}
int dp_app_serial_available_for_write() { return Serial.availableForWrite(); }
void dp_app_serial_flush() { dp::internal::LinkLock guard; Serial.flush(); }
#endif
