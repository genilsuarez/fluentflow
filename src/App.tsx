import React, { useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { AppRouter } from './components/layout/AppRouter';
import { MemoizedHeader, MemoizedToastContainer } from './components/ui/MemoizedComponents';
import { OrientationLock } from './components/ui/OrientationLock';
import { useAppStore } from './stores/appStore';
import { useProgressStore } from './stores/progressStore';
import { useSettingsStore } from './stores/settingsStore';

import { useSystemTheme } from './hooks/useSystemTheme';
import { useTranslation } from './utils/i18n';
import { verifyCacheIntegrity } from './services/offlineManager';
import { toast } from './stores/toastStore';

// Optimized QueryClient configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60 * 1000, // 10 minutes
      gcTime: 30 * 60 * 1000, // Keep unused data in cache 30 minutes
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error instanceof Error && error.message.includes('HTTP 4')) {
          return false;
        }
        // Don't retry JSON parse errors (content issue, not transient)
        if (error instanceof Error && error.message.includes('parse JSON')) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
      // Don't auto-refetch on reconnect — user can manually refresh if needed.
      // Auto-refetch on reconnect can cause the UI to flash/error when coming
      // back to the page after a long time if the network request fails.
      refetchOnReconnect: false,
      // Allow queries to run even when offline - let service worker handle it
      networkMode: 'always',
    },
    mutations: {
      retry: 1,
      networkMode: 'always',
    },
  },
});

const AppContent: React.FC = () => {
  const currentView = useAppStore(state => state.currentView);
  const {
    offlineEnabled,
    downloadedLevels,
    language,
    setOfflineEnabled,
    setDownloadedLevels,
    setLastDownloadDate,
  } = useSettingsStore();
  const { t } = useTranslation(language);
  const integrityChecked = useRef(false);
  // Set up system theme listener
  useSystemTheme();

  // Verify cache integrity on app mount when offline mode is enabled
  useEffect(() => {
    if (!offlineEnabled || downloadedLevels.length === 0 || integrityChecked.current) return;
    integrityChecked.current = true;

    verifyCacheIntegrity(downloadedLevels)
      .then(({ missingLevels, partialLevels }) => {
        if (missingLevels.length === 0 && partialLevels.length === 0) return;

        if (missingLevels.length === downloadedLevels.length) {
          // All levels missing — disable offline mode entirely
          setOfflineEnabled(false);
          setDownloadedLevels([]);
          setLastDownloadDate(null);
          toast.warning(t('offline.title'), t('offline.cacheIntegrityAllMissing'));
        } else if (missingLevels.length > 0 || partialLevels.length > 0) {
          // Some levels missing or partial — update state and notify
          const remaining = downloadedLevels.filter(
            l => !missingLevels.includes(l) && !partialLevels.includes(l)
          );
          setDownloadedLevels(remaining);

          const problematicLevels = [...missingLevels, ...partialLevels];
          toast.info(
            t('offline.cacheIntegrityWarning'),
            t('offline.cacheIntegrityMissing', undefined, {
              levels: problematicLevels.map(l => l.toUpperCase()).join(', '),
            })
          );
        }
      })
      .catch(() => {
        // Silently fail — integrity check is non-critical
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync URL hash with Zustand state for proper navigation
  // This is the SINGLE SOURCE OF TRUTH for navigation
  // Components should ONLY update the hash, and this effect will update Zustand
  useEffect(() => {
    // Guard against concurrent hash change handlers racing each other.
    // Only one navigation resolution runs at a time; subsequent calls while
    // one is in-flight are debounced and re-run after it finishes.
    let isProcessing = false;
    let pendingHash: string | null = null;

    const resolveHash = async (hash: string) => {
      // Parse hash format: #/learn/module-id
      if (hash.startsWith('#/learn/')) {
        const moduleId = hash.replace('#/learn/', '');

        // Check current state
        const { currentModule, currentView } = useAppStore.getState();

        // If the module is already correctly set AND view is correct, do nothing
        if (currentModule?.id === moduleId && currentView !== 'menu') {
          return;
        }

        try {
          // Module needs to be loaded - fetch module metadata.
          // fetchModules() uses ApiService memory cache (10 min) and falls back
          // to Cache API, so this is resilient to network failures.
          const { fetchModules } = await import('./services/api');
          const response = await fetchModules();

          if (!response.success || !response.data) {
            console.error('[App] Failed to fetch modules:', response.error);
            // Don't redirect to menu on transient errors — let useModuleData handle the error UI.
            // Only redirect if Zustand has no usable module info at all.
            const { currentModule } = useAppStore.getState();
            if (!currentModule || currentModule.id !== moduleId) {
              const { setCurrentView, setCurrentModule } = useAppStore.getState();
              setCurrentModule(null);
              setCurrentView('menu');
            }
            return;
          }

          const module = response.data.find(m => m.id === moduleId);

          if (!module) {
            console.error('[App] Module not found:', moduleId);
            // Module genuinely doesn't exist — go to menu
            const { setCurrentView, setCurrentModule } = useAppStore.getState();
            setCurrentModule(null);
            setCurrentView('menu');
            return;
          }

          // Check prerequisites before allowing access (skip in development mode)
          const { developmentMode } = useSettingsStore.getState();
          if (!developmentMode && module.prerequisites && module.prerequisites.length > 0) {
            const { getCompletedModuleIds } = useProgressStore.getState();
            const completedIds = new Set(getCompletedModuleIds());
            const allPrereqsMet = module.prerequisites.every(id => completedIds.has(id));
            if (!allPrereqsMet) {
              console.warn('[App] Module prerequisites not met:', moduleId);
              const { setCurrentView, setCurrentModule } = useAppStore.getState();
              setCurrentModule(null);
              setCurrentView('menu');
              window.location.hash = '#/menu';
              return;
            }
          }

          // Module found and accessible - update state
          const { setCurrentModule, setCurrentView } = useAppStore.getState();
          setCurrentModule(module);
          setCurrentView(module.learningMode);
        } catch (error) {
          console.error('[App] Error in handleHashChange:', error);
          // Don't redirect to menu on transient errors — let useModuleData handle it.
          // Only redirect if Zustand has no module info at all.
          const { currentModule } = useAppStore.getState();
          if (!currentModule || currentModule.id !== moduleId) {
            const { setCurrentView, setCurrentModule } = useAppStore.getState();
            setCurrentModule(null);
            setCurrentView('menu');
          }
        }
      } else if (hash === '' || hash === '#/' || hash === '#/menu') {
        // Navigate to menu
        const { setCurrentView, setCurrentModule } = useAppStore.getState();
        setCurrentModule(null);
        setCurrentView('menu');
      }
    };

    const handleHashChange = async () => {
      const hash = window.location.hash;

      if (isProcessing) {
        // Queue the latest hash — previous intermediate hashes are irrelevant
        pendingHash = hash;
        return;
      }

      isProcessing = true;
      try {
        await resolveHash(hash);
      } finally {
        isProcessing = false;
        // If a new hash arrived while we were processing, handle it now
        if (pendingHash !== null) {
          const next = pendingHash;
          pendingHash = null;
          void resolveHash(next);
        }
      }
    };

    // Handle initial hash on mount
    handleHashChange();

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

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
