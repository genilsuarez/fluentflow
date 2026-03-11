import React, { useEffect, useState, useRef } from 'react';
import { SearchBar } from './SearchBar';
import { ModuleCard } from './ModuleCard';
import { ModuleGridSkeleton } from './LoadingSkeleton';
import { ProgressionDashboard } from './ProgressionDashboard';
import { useAllModules } from '../../hooks/useModuleData';
import { useProgression } from '../../hooks/useProgression';
import { useSearch } from '../../hooks/useSearch';
import { useAppStore } from '../../stores/appStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../utils/i18n';
import { toast } from '../../stores/toastStore';
import { List, BarChart3 } from 'lucide-react';
import '../../styles/components/main-menu.css';

export const MainMenu: React.FC = () => {
  const { data: modules = [], isLoading, error } = useAllModules();
  const progression = useProgression();
  const { query, setQuery, results } = useSearch(modules);
  const { setCurrentModule, setCurrentView, setPreviousMenuContext, previousMenuContext } =
    useAppStore();
  const { language } = useSettingsStore();
  const { t } = useTranslation(language);
  const [viewMode, setViewMode] = useState<'progression' | 'list'>(previousMenuContext);
  const [highlightedModuleId, setHighlightedModuleId] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const hasScrolledToNext = useRef(false);

  // Sync view mode with stored context when component mounts
  useEffect(() => {
    setViewMode(previousMenuContext);
  }, [previousMenuContext]);

  // Update stored context when view mode changes
  useEffect(() => {
    setPreviousMenuContext(viewMode);
  }, [viewMode, setPreviousMenuContext]);

  // Scroll to next recommended module and highlight it
  const scrollToNextModule = React.useCallback(
    (behavior: ScrollBehavior = 'smooth') => {
      const nextModule = progression.getNextRecommendedModule();
      if (!nextModule || !gridRef.current) return;

      setHighlightedModuleId(nextModule.id);

      const scrollTimer = setTimeout(() => {
        const moduleCard = document.querySelector(`[data-module-id="${nextModule.id}"]`);

        if (moduleCard && gridRef.current) {
          const gridRect = gridRef.current.getBoundingClientRect();
          const cardRect = moduleCard.getBoundingClientRect();

          // Calculate scroll position to center the card vertically
          const scrollTop =
            gridRef.current.scrollTop +
            (cardRect.top - gridRect.top) -
            gridRect.height / 2 +
            cardRect.height / 2;

          gridRef.current.scrollTo({
            top: Math.max(0, scrollTop),
            behavior,
          });
        }
      }, 150);

      const highlightTimer = setTimeout(() => {
        setHighlightedModuleId(null);
      }, 2500);

      return () => {
        clearTimeout(scrollTimer);
        clearTimeout(highlightTimer);
      };
    },
    [progression]
  );

  // Stable ref to always call the latest version of scrollToNextModule
  const scrollFnRef = useRef(scrollToNextModule);
  useEffect(() => {
    scrollFnRef.current = scrollToNextModule;
  }, [scrollToNextModule]);

  // Auto-scroll to next recommended module when entering All Modules view
  // This covers both: returning from a completed lesson and switching tabs
  useEffect(() => {
    if (viewMode !== 'list' || isLoading || !modules.length) return;

    // Clear the post-lesson flag if present (no longer needed as a separate trigger)
    try {
      sessionStorage.removeItem('autoScrollToNext');
    } catch {
      /* */
    }

    // Wait for the grid to mount and cards to render before scrolling
    const timerId = setTimeout(() => {
      scrollFnRef.current('smooth');
    }, 300);

    return () => clearTimeout(timerId);
  }, [viewMode, isLoading, modules.length]);

  // Show welcome toast when modules are loaded (only once per session)
  useEffect(() => {
    if (modules.length > 0 && !isLoading) {
      toast.welcomeOnce(modules.length);
    }
  }, [modules.length, isLoading]);

  // Show toast on error
  useEffect(() => {
    if (error) {
      toast.error('Error de conexión', 'No se pudieron cargar los módulos. Verifica tu conexión.', {
        action: {
          label: 'Reintentar',
          onClick: () => window.location.reload(),
        },
      });
    }
  }, [error]);

  const handleModuleClick = (module: any) => {
    // Check if module is accessible
    if (!progression.canAccessModule(module.id)) {
      const missingPrereqs = progression.getMissingPrerequisites(module.id);
      const prereqNames = missingPrereqs.map(p => p.name).join(', ');

      toast.warning('Módulo bloqueado', `Completa primero: ${prereqNames}`, { duration: 3000 });
      return;
    }

    // Save scroll position before changing view
    const gridElement = document.querySelector('.main-menu__grid');
    if (gridElement) {
      try {
        sessionStorage.setItem('menuGridScrollPosition', gridElement.scrollTop.toString());
      } catch {
        /* */
      }
    }

    // Reset auto-scroll flag when user manually selects a module
    hasScrolledToNext.current = false;

    // Show toast when starting a module
    const modeLabels: Record<string, string> = {
      flashcard: 'Flashcards',
      quiz: 'Quiz',
      completion: 'Completar oraciones',
      sorting: 'Ejercicio de clasificación',
      matching: 'Ejercicio de emparejamiento',
      reading: 'Lectura',
    };

    toast.info(
      'Iniciando módulo',
      `${module.name} - ${modeLabels[module.learningMode] || 'Ejercicio'}`,
      { duration: 1500 }
    );

    // Save current menu context before navigating to learning mode
    setPreviousMenuContext(viewMode);
    setCurrentModule(module);
    setCurrentView(module.learningMode);

    // Update URL hash for proper navigation
    window.location.hash = `#/learn/${module.id}`;
  };

  if (isLoading) {
    return (
      <div className="main-menu">
        <div className="main-menu__search">
          <SearchBar
            query=""
            onQueryChange={() => {}}
            placeholder={t('common.searchPlaceholder')}
            disabled={true}
          />
        </div>
        <ModuleGridSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="main-menu">
        <div className="main-menu__error" role="alert">
          <p className="main-menu__error-text">{t('errors.errorLoadingModules')}</p>
          <p className="main-menu__error-text">
            {error instanceof Error ? error.message : t('errors.unexpectedErrorOccurred')}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="main-menu__error-btn"
            aria-label="Retry loading modules"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="main-menu">
      {/* Header with view toggle */}
      <div className="main-menu__header">
        <div className="main-menu__search">
          <SearchBar
            query={query}
            onQueryChange={setQuery}
            placeholder={t('common.searchPlaceholder')}
          />
        </div>

        <div className="main-menu__view-toggle">
          <button
            className={`main-menu__view-btn ${viewMode === 'progression' ? 'main-menu__view-btn--active' : ''}`}
            onClick={() => setViewMode('progression')}
            aria-label="Progression view"
          >
            <BarChart3 className="main-menu__view-icon" />
            Progress
          </button>
          <button
            className={`main-menu__view-btn ${viewMode === 'list' ? 'main-menu__view-btn--active' : ''}`}
            onClick={() => setViewMode('list')}
            aria-label="List view"
          >
            <List className="main-menu__view-icon" />
            All Modules
          </button>
        </div>
      </div>

      {/* Content based on view mode and search */}
      {query ? (
        // Search results view
        results.length === 0 ? (
          <div className="main-menu__no-results" role="status" aria-live="polite">
            <p className="main-menu__no-results-text">
              No modules found for "<strong>{query}</strong>"
            </p>
            <p className="main-menu__no-results-hint">
              Try adjusting your search terms or browse all available modules.
            </p>
          </div>
        ) : (
          <>
            <div className="main-menu__grid">
              <div
                className="main-menu__grid-container"
                role="grid"
                aria-label={`${results.length} learning modules available`}
              >
                {results.map((module, index) => (
                  <ModuleCard
                    key={module.id}
                    module={module}
                    onClick={() => handleModuleClick(module)}
                    tabIndex={0}
                    role="gridcell"
                    aria-posinset={index + 1}
                    aria-setsize={results.length}
                  />
                ))}
              </div>
            </div>
            <div className="main-menu__results-count" role="status" aria-live="polite">
              Showing <strong>{results.length}</strong> of <strong>{modules.length}</strong> modules
            </div>
          </>
        )
      ) : viewMode === 'progression' ? (
        // Progression dashboard view
        <ProgressionDashboard onModuleSelect={handleModuleClick} />
      ) : (
        // List view (original grid)
        <div className="main-menu__grid" ref={gridRef}>
          <div
            className="main-menu__grid-container"
            role="grid"
            aria-label={`${modules.length} learning modules available`}
          >
            {modules.map((module, index) => (
              <ModuleCard
                key={module.id}
                module={module}
                onClick={() => handleModuleClick(module)}
                tabIndex={0}
                role="gridcell"
                aria-posinset={index + 1}
                aria-setsize={modules.length}
                isNextRecommended={highlightedModuleId === module.id}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
