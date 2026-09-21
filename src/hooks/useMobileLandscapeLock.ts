import { useEffect, useState } from 'react';

// `pointer: coarse` = pantalla táctil: no bloquear ventanas de escritorio bajas.
const LANDSCAPE_LOCK_MQ = '(orientation: landscape) and (max-height: 500px) and (pointer: coarse)';

/** True when FluentFlow should block landscape on small-height viewports. */
export function useMobileLandscapeLock(): boolean {
  const [active, setActive] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(LANDSCAPE_LOCK_MQ).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(LANDSCAPE_LOCK_MQ);
    const onChange = () => setActive(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return active;
}
