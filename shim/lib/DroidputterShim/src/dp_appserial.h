// Output-only Serial for apps that READ the USB serial port themselves. On the bare-S3 build the phone link owns
// every byte the phone sends (keys, GPS, HELLO_ACK, pings); ESP32Marauder's command line reads the shared port with
// Serial.readStringUntil('\n') every loop, swallowed the key frames and echoed them back 1 s later (measured on the
// phone, 2026-10-10: no key ever reached the shim). Force-included into the APP'S OWN SOURCES only (build_src_flags:
// -DDROIDPUTTER_APP_SERIAL -include dp_appserial.h) by the overlay recipe of such an app -- never into the framework,
// whose HWCDC.cpp defines the real Serial. The app's Serial still prints (through the link lock, so text never splits
// a frame) but reads nothing: the phone never sends command-line text. The app's source stays untouched.
#pragma once
#if defined(__cplusplus) && defined(DROIDPUTTER_APP_SERIAL)
#include <Arduino.h>   // the core's Serial is declared before the app's name is redirected
#include <stddef.h>

size_t dp_app_serial_write(const uint8_t* data, size_t n);
int dp_app_serial_available_for_write();
void dp_app_serial_flush();

class DpAppSerial : public Stream {
 public:
  template <typename... A> void begin(A...) {}   // the link already runs the port
  void end() {}
  int available() override { return 0; }
  int read() override { return -1; }
  int peek() override { return -1; }
  void flush() override { dp_app_serial_flush(); }
  size_t write(uint8_t c) override { return dp_app_serial_write(&c, 1); }
  size_t write(const uint8_t* buffer, size_t size) override { return dp_app_serial_write(buffer, size); }
  int availableForWrite() override { return dp_app_serial_available_for_write(); }
  using Print::write;
  operator bool() const { return true; }
  template <typename... A> void setDebugOutput(A...) {}
  template <typename... A> void setRxBufferSize(A...) {}
  template <typename... A> void setTxBufferSize(A...) {}
  template <typename... A> void setTxTimeoutMs(A...) {}
};
inline DpAppSerial dp_app_serial;   // C++17 inline: one object, defined only where the app uses it
#undef Serial
#define Serial dp_app_serial
#endif
