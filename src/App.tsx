import React, { useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { AppRouter } from './components/layout/AppRouter';
import { MemoizedHeader, MemoizedToastContainer } from './components/ui/MemoizedComponents';
import { OrientationLock } from './components/ui/OrientationLock';
import { useAppStore } from './stores/appStore';
import { useSettingsStore } from './stores/settingsStore';
import { useMaxLimits } from './hooks/useMaxLimits';
import { useSystemTheme } from './hooks/useSystemTheme';
import { useTranslation } from './utils/i18n';
import { verifyCacheIntegrity } from './services/offlineManager';
import { toast } from './stores/toastStore';

// Optimized QueryClient configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60 * 1000, // 10 minutes
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error instanceof Error && error.message.includes('HTTP 4')) {
          return false;
        }
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

const AppContent: React.FC = () => {
  const { currentView } = useAppStore();
  const { offlineEnabled, downloadedLevels, language, setOfflineEnabled, setDownloadedLevels, setLastDownloadDate } = useSettingsStore();
  const { t } = useTranslation(language);
  const integrityChecked = useRef(false);

  // Calculate max limits based on available data
  useMaxLimits();

  // Set up system theme listener
  useSystemTheme();

  // Verify cache integrity on app mount when offline mode is enabled
  useEffect(() => {
    if (!offlineEnabled || downloadedLevels.length === 0 || integrityChecked.current) return;
    integrityChecked.current = true;

    verifyCacheIntegrity(downloadedLevels).then(({ missingLevels }) => {
      if (missingLevels.length === 0) return;

      if (missingLevels.length === downloadedLevels.length) {
        // All levels missing — disable offline mode entirely
        setOfflineEnabled(false);
        setDownloadedLevels([]);
        setLastDownloadDate(null);
        toast.warning(
          t('offline.title'),
          t('offline.cacheIntegrityAllMissing')
        );
      } else {
        // Some levels missing — update state and notify
        const remaining = downloadedLevels.filter(l => !missingLevels.includes(l));
        setDownloadedLevels(remaining);
        toast.info(
          t('offline.cacheIntegrityWarning'),
          t('offline.cacheIntegrityMissing', undefined, { levels: missingLevels.map(l => l.toUpperCase()).join(', ') })
        );
      }
    }).catch(() => {
      // Silently fail — integrity check is non-critical
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle view changes and cleanup
  useEffect(() => {
    let prevView = 'menu';
    try {
      prevView = sessionStorage.getItem('prevView') || 'menu';
      sessionStorage.setItem('prevView', currentView);
    } catch {
      /* Private browsing or storage full */
    }

    // Clear toasts when changing views (immediate, no delays)
    if (currentView !== prevView) {
      const learningModes = ['flashcard', 'quiz', 'completion', 'sorting', 'matching', 'reading'];

      if (learningModes.includes(prevView) || learningModes.includes(currentView)) {
        toast.clearOnNavigation();
      }
    }

    // Restore scroll position when returning to menu
    if (currentView === 'menu' && prevView !== 'menu') {
      try {
        const savedScroll = sessionStorage.getItem('menuGridScrollPosition');
        if (savedScroll) {
          const scrollPos = parseInt(savedScroll, 10);
          requestAnimationFrame(() => {
            const gridElement = document.querySelector('.main-menu__grid');
            if (gridElement) {
              gridElement.scrollTop = scrollPos;
            }
          });
        }
      } catch {
        /* Private browsing */
      }
    }
  }, [currentView]);

  return (
    <ErrorBoundary>
      <div className="layout-container" data-view={currentView}>
        <MemoizedHeader />

        <main className="layout-main">
          <AppRouter />
        </main>

        <MemoizedToastContainer />
      </div>

      {/* Orientation Lock - Only visible on mobile landscape */}
      <OrientationLock />
    </ErrorBoundary>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
