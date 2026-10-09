// Force-included (build_src_flags, the app's own sources only) by tools/overlay.py on ONE retry, when a build
// stops at "'function' does not name a type": the sketch writes `function<...>` with a `using namespace std;`
// that PlatformIO's .ino conversion places AFTER the generated prototypes (the Arduino IDE did not), as in
// Evil-M5Core2's Cardputer sketch (CI 2026-10-09). Never seen by a build that compiles.
#pragma once
#if defined(__cplusplus) && !defined(__ASSEMBLER__)
#include <functional>
using std::function;
#endif
