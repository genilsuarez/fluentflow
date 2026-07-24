import { useEffect, useState } from 'react';

export function useStatsRevealAnimation(): boolean {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const onReady = (event: Event) => {
      const detail = (event as CustomEvent<{ animate?: boolean }>).detail;
      if (detail?.animate) setAnimate(true);
    };
    window.addEventListener('lp-stats-ready', onReady);
    return () => window.removeEventListener('lp-stats-ready', onReady);
  }, []);

  return animate;
}
