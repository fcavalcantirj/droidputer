"use client";

import { useEffect, useRef, useState } from "react";

/** Animates a number from its previous value to the new one (ease-out, ~1.2 s); instant under reduced motion. */
export function useCountUp(target: number | undefined, duration = 1200) {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (target == null) return;
    const start = from.current ?? target;
    from.current = target;
    if (start === target || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    let frame = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / duration);
      setValue(Math.round(start + (target - start) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}
