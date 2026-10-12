#include "dp_stage.h"

namespace dp {
size_t dp_choose_stage(size_t largest_free, size_t floor, size_t boost, size_t headroom) {
  if (boost <= floor) return floor;
  return largest_free >= boost + headroom ? boost : floor;
}
}  // namespace dp
