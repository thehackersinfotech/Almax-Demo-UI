import { useEffect, useState } from "react";

interface UseCountUpOptions {
  duration?: number;
  enabled?: boolean;
  decimals?: number;
}

/** Ease-out cubic count-up for dashboard metrics. */
export function useCountUp(target: number, options: UseCountUpOptions = {}) {
  const { duration = 900, enabled = true, decimals = 0 } = options;
  const [value, setValue] = useState(enabled ? 0 : target);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }

    let start: number | null = null;
    let raf = 0;

    const tick = (ts: number) => {
      if (start === null) start = ts;
      const progress = Math.min(1, (ts - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      const next = target * eased;
      setValue(decimals > 0 ? parseFloat(next.toFixed(decimals)) : Math.round(next));
      if (progress < 1) raf = requestAnimationFrame(tick);
      else setValue(target);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, enabled, decimals]);

  return value;
}
