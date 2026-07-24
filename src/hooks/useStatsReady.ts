import { useEffect, useState } from 'react';
import { shouldDeferStatsDisplay } from '../utils/statsBootstrap';

export function useStatsReady(): boolean {
  const [ready, setReady] = useState(!shouldDeferStatsDisplay());

  useEffect(() => {
    if (ready) return undefined;

    const onReady = () => setReady(true);
    window.addEventListener('lp-stats-ready', onReady);
    return () => window.removeEventListener('lp-stats-ready', onReady);
  }, [ready]);

  return ready;
}
