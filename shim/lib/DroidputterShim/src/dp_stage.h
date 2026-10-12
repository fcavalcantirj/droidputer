// The RLE stage (dp_display.cpp): a 4 KB floor in .bss for every app, plus a 32 KB internal boost taken ONCE at the
// first HELLO_ACK when plenty of internal RAM stays free. Pure (no Arduino headers) so `pio test -e native` covers it.
//
// 2026-10-12 (progress.txt): a static 32 KB stage pushed Pigtail's internal DMA RAM to ~92 KB, below the ~117 KB its
// Wi-Fi + BLE take at init -> interrupt-watchdog boot loop. The link comes up BEFORE a radio app's init (Pigtail acks
// ~1.7 s before it starts its radios), so "RAM looks free at link-up" is not enough: the boost needs the radios' whole
// intake (HEADROOM 120 KB) left over after it.
#pragma once
#include <stddef.h>

namespace dp {
#ifndef DP_STAGE_BYTES
#define DP_STAGE_BYTES 4096                 // the floor, static
#endif
#ifndef DP_STAGE_BOOST_BYTES
#define DP_STAGE_BOOST_BYTES 32768          // today's throughput, when RAM allows
#endif
#ifndef DP_STAGE_HEADROOM_BYTES
#define DP_STAGE_HEADROOM_BYTES (120 * 1024)  // left free after a boost: Wi-Fi + BLE took ~117 KB at init
#endif
// The stage size to use: `boost` if the largest free internal block holds it AND still leaves `headroom`, else
// `floor`. A boost no bigger than the floor is never taken.
size_t dp_choose_stage(size_t largest_free, size_t floor, size_t boost, size_t headroom);
}  // namespace dp
