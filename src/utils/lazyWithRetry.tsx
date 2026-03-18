import React, { lazy, type ComponentType } from 'react';

/**
 * Wrapper around React.lazy that handles chunk loading failures after deploys.
 *
 * When a new version is deployed, old chunk filenames (with content hashes) no longer exist.
 * If a user has a stale index.html cached, dynamic imports will fail with a network error.
 *
 * This utility:
 * 1. Catches the import error
 * 2. Checks if a reload was already attempted (via sessionStorage flag)
 * 3. If not, forces a full page reload to get the fresh index.html
 * 4. If already retried, shows the error fallback to avoid infinite reload loops
 */

const RELOAD_KEY = 'chunk-reload-retry';

function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('loading chunk') ||
    msg.includes('loading css chunk') ||
    msg.includes('dynamically imported module') ||
    msg.includes('error loading') ||
    msg.includes('failed to fetch')
  );
}

export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback?: React.FC
): React.LazyExoticComponent<T> {
  return lazy(() =>
    importFn().catch((error: unknown) => {
      const hasRetried = sessionStorage.getItem(RELOAD_KEY);

      if (!hasRetried && isChunkLoadError(error)) {
        sessionStorage.setItem(RELOAD_KEY, '1');
        window.location.reload();
        // Return a never-resolving promise to prevent rendering while reloading
        return new Promise<{ default: T }>(() => {});
      }

      // Already retried or not a chunk error — clear flag and show fallback
      sessionStorage.removeItem(RELOAD_KEY);

      if (fallback) {
        return { default: fallback as unknown as T };
      }
      throw error;
    })
  );
}

/**
 * Clear the retry flag on successful app load.
 * Call this once in main.tsx after the app renders successfully.
 */
export function clearChunkRetryFlag(): void {
  sessionStorage.removeItem(RELOAD_KEY);
}
