import { useState, useEffect } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

/**
 * Hook that listens to browser online/offline events and exposes
 * reactive connection status combined with offline mode state.
 */
export function useOfflineStatus(): {
  isOnline: boolean;
  isOfflineMode: boolean;
} {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const { offlineEnabled, downloadedLevels } = useSettingsStore();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const isOfflineMode = !isOnline && offlineEnabled && downloadedLevels.length > 0;

  return { isOnline, isOfflineMode };
}
