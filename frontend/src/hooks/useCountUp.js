import { useEffect, useRef, useState } from "react";

const DURATION = 700;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

// Animates a number from its previous value to the new one.
//   const shown = useCountUp(data?.revenue);
// Starts from 0 the first time, then rolls between values when filters change.
// With reduced motion turned on, it just returns the target.
export function useCountUp(target) {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    if (target === undefined || target === null) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      fromRef.current = target;
      setValue(target);
      return;
    }

    const from = fromRef.current;
    const start = performance.now();
    let frame;
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / DURATION);
      const current = from + (target - from) * easeOutCubic(progress);
      setValue(progress === 1 ? target : current);
      if (progress < 1) frame = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      fromRef.current = target;
    };
  }, [target]);

  return Math.round(value);
}
