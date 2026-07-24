import { useEffect, useState } from 'react';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true
  );
}

export function useAnimatedNumber(value: number, animate: boolean): number {
  const [display, setDisplay] = useState(animate ? 0 : value);

  useEffect(() => {
    if (!animate) {
      setDisplay(value);
      return undefined;
    }

    if (prefersReducedMotion()) {
      setDisplay(value);
      return undefined;
    }

    const from = 0;
    const duration = 650;
    const t0 = performance.now();
    let frame = 0;
    let cancelled = false;

    const step = (now: number) => {
      if (cancelled) return;
      const progress = Math.min(1, (now - t0) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress < 1) frame = requestAnimationFrame(step);
      else setDisplay(value);
    };

    setDisplay(0);
    frame = requestAnimationFrame(step);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [value, animate]);

  return display;
}
