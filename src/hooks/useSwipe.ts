import { useEffect, useRef, useCallback, type RefObject } from 'react';

interface SwipeCallbacks {
  onNext: () => void;
  onPrev: () => void;
}

const THRESHOLD = 50;
const MAX_VERTICAL = 80;

/**
 * Hook that attaches horizontal swipe detection to an element.
 * Swipe left → onNext, swipe right → onPrev.
 *
 * Usage A (creates ref): const ref = useSwipe<HTMLDivElement>({ onNext, onPrev });
 * Usage B (existing ref): useSwipe({ onNext, onPrev }, existingRef);
 */
export function useSwipe<T extends HTMLElement>(
  callbacks: SwipeCallbacks,
  externalRef?: RefObject<T | null>
) {
  const internalRef = useRef<T | null>(null);
  const ref = externalRef || internalRef;
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const startRef = useRef({ x: 0, y: 0 });

  const onTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    startRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const onTouchEnd = useCallback((e: TouchEvent) => {
    const touch = e.changedTouches[0];
    const dx = touch.clientX - startRef.current.x;
    const dy = Math.abs(touch.clientY - startRef.current.y);
    if (dy > MAX_VERTICAL) return;
    if (dx < -THRESHOLD) callbacksRef.current.onNext();
    else if (dx > THRESHOLD) callbacksRef.current.onPrev();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [ref, onTouchStart, onTouchEnd]);

  return ref as RefObject<T>;
}
