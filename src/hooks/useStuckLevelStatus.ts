import { useEffect, useState } from 'react';
import { getStuckLevelStatus, type StuckLevelStatus } from '../services/levelProgression';

/**
 * Mismo patrón de refresco que HubFlow/LyricFlow js/level-status.js
 * (initLevelStatus): recalcula cuando el nivel local cambia (misma pestaña
 * o vía 'storage' en otra) o cuando se ajustan los umbrales de completitud.
 */
export function useStuckLevelStatus(): StuckLevelStatus | null {
  const [status, setStatus] = useState<StuckLevelStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      getStuckLevelStatus().then(result => {
        if (!cancelled) setStatus(result);
      });
    };

    refresh();
    window.addEventListener('lp-level-changed', refresh);
    window.addEventListener('lp-completion-config-changed', refresh);
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'lp-level' || event.key === 'lp-completion-config') refresh();
    };
    window.addEventListener('storage', onStorage);

    return () => {
      cancelled = true;
      window.removeEventListener('lp-level-changed', refresh);
      window.removeEventListener('lp-completion-config-changed', refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return status;
}
