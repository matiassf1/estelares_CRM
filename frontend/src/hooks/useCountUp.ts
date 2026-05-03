import { useState, useEffect, useRef } from 'react';

export function useCountUp(target: number, duration = 700): number {
  const [value, setValue] = useState(0);
  const prevTarget = useRef(0);

  useEffect(() => {
    if (target === prevTarget.current) return;
    prevTarget.current = target;

    const start = Date.now();
    const from = value;

    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }, [target, duration]);

  return value;
}
