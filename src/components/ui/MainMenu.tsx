import React, { useEffect, useState, useRef } from 'react';
import { SearchBar } from './SearchBar';
import { ModuleCard } from './ModuleCard';
import { ModuleGridSkeleton } from './LoadingSkeleton';
import { ProgressionDashboard } from './ProgressionDashboard';
import { useQueryClient } from '@tanstack/react-query';
import { useAllModules, getHiddenDependencies } from '../../hooks/useModuleData';
import { useProgression } from '../../hooks/useProgression';
import { useSearch } from '../../hooks/useSearch';
import { useAppStore } from '../../stores/appStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../utils/i18n';
import type { LearningModule } from '../../types';
import { toast } from '../../stores/toastStore';
import {
  List,
  BarChart3,
  Search as SearchIcon,
  X as XIcon,
  Filter as FilterIcon,
} from 'lucide-react';
import { CategoryFilter } from './CategoryFilter';
import { ModeFilter } from './ModeFilter';
import { LevelFilter } from './LevelFilter';
import '../../styles/components/main-menu.css';

export const MainMenu: React.FC = () => {
  const { data: modules = [], isLoading, error } = useAllModules();
  const progression = useProgression();
  const { query, setQuery, results } = useSearch(modules);
  const { setPreviousMenuContext, previousMenuContext } = useAppStore();
  const { language, categories, learningModes, level, setCategories, setLearningModes, setLevel } =
    useSettingsStore();
  const { t } = useTranslation(language);
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'progression' | 'list'>(previousMenuContext);
  const [highlightedModuleId, setHighlightedModuleId] = useState<string | null>(null);
  const [expandedFilter, setExpandedFilter] = useState<'category' | 'mode' | 'level' | null>(null);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const hasScrolledToNext = useRef(false);

  // Access raw (unfiltered) modules from the query cache for dependency calculations
  const allModulesRaw = queryClient.getQueryData<LearningModule[]>(['modules']) ?? [];

  // Persistent current module ID (next recommended).
  // If the recommended module is hidden by the category filter, fall back to the
  // first visible unlocked-and-not-completed module so the highlight stays visible.
  const currentModuleId = React.useMemo(() => {
    const recommended = progression.getNextRecommendedModule();
    if (!recommended) return null;

    const isVisible = modules.some(m => m.id === recommended.id);
    if (isVisible) return recommended.id;

    // Fallback: first unlocked, non-completed module in the visible list
    const fallback = modules.find(
      m => progression.canAccessModule(m.id) && progression.getModuleStatus(m.id) !== 'completed'
    );
    return fallback?.id ?? null;
  }, [progression, modules]);

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

          // Use actual scrollable height (clientHeight) instead of getBoundingClientRect
          // to avoid issues on mobile where the grid rect may not reflect the visible area
          const visibleHeight = gridRef.current.clientHeight;
          const cardOffsetInGrid = gridRef.current.scrollTop + (cardRect.top - gridRect.top);

          // Center the card with a small top padding so it's never clipped
          const scrollTop = cardOffsetInGrid - visibleHeight / 2 + cardRect.height / 2;

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
      toast.error(t('mainMenu.connectionError'), t('mainMenu.connectionErrorDesc'), {
        action: {
          label: t('mainMenu.retryAction'),
          onClick: () => window.location.reload(),
        },
      });
    }
  }, [error, t]);

  const handleModuleClick = (module: any) => {
    // Check if module is accessible
    if (!progression.canAccessModule(module.id)) {
      const missingPrereqs = progression.getMissingPrerequisites(module.id);
      const prereqNames = missingPrereqs.map(p => p.name).join(', ');

      toast.warning(
        t('mainMenu.moduleBlocked'),
        t('mainMenu.moduleBlockedDesc', undefined, { prereqs: prereqNames }),
        { duration: 3000 }
      );
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
      flashcard: t('mainMenu.modeFlashcard'),
      quiz: t('mainMenu.modeQuiz'),
      completion: t('mainMenu.modeCompletion'),
      sorting: t('mainMenu.modeSorting'),
      matching: t('mainMenu.modeMatching'),
      reading: t('mainMenu.modeReading'),
    };

    toast.info(
      t('mainMenu.startingModule'),
      `${module.name} - ${modeLabels[module.learningMode] || t('mainMenu.modeDefault')}`,
      { duration: 1500 }
    );

    // Save current menu context before navigating to learning mode
    setPreviousMenuContext(viewMode);

    // Navigate to the module
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
            label={t('common.searchLabel')}
            description={t('common.searchDescription')}
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
            aria-label={t('mainMenu.retryLoading')}
          >
            {t('mainMenu.tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="main-menu">
      {/* Header with view toggle */}
      <div className="main-menu__header">
        <div
          className={`main-menu__search-row${isSearchExpanded ? ' main-menu__search-row--search-expanded' : ''}`}
        >
          <div className="main-menu__search">
            <SearchBar
              query={query}
              onQueryChange={val => {
                setQuery(val);
              }}
              placeholder={t('common.searchPlaceholder')}
              label={t('common.searchLabel')}
              description={t('common.searchDescription')}
              clearLabel={t('common.clearSearch')}
              onSearchFocus={() => {
                setIsSearchExpanded(true);
                setExpandedFilter(null);
              }}
              onSearchBlur={() => {
                // Delay collapse so clear button click registers
                // Only collapse if query is empty — keep expanded while text is visible
                setTimeout(() => {
                  if (!query) setIsSearchExpanded(false);
                }, 150);
              }}
            />
          </div>
          {isSearchExpanded && (
            <button
              className="main-menu__search-close"
              onClick={() => {
                setQuery('');
                setIsSearchExpanded(false);
                // Blur the search input to remove focus ring
                const input = document.querySelector('.search-bar__input') as HTMLElement;
                input?.blur();
              }}
              aria-label={t('common.closeSearch')}
              type="button"
            >
              <XIcon size={16} />
            </button>
          )}
          <CategoryFilter
            inline
            isExpanded={expandedFilter === 'category'}
            onToggle={() => setExpandedFilter(prev => (prev === 'category' ? null : 'category'))}
          />
          <ModeFilter
            inline
            isExpanded={expandedFilter === 'mode'}
            onToggle={() => setExpandedFilter(prev => (prev === 'mode' ? null : 'mode'))}
          />
          <LevelFilter
            inline
            isExpanded={expandedFilter === 'level'}
            onToggle={() => setExpandedFilter(prev => (prev === 'level' ? null : 'level'))}
          />
        </div>

        <div className="main-menu__view-toggle">
          <button
            className={`main-menu__view-btn ${viewMode === 'progression' ? 'main-menu__view-btn--active' : ''}`}
            onClick={() => setViewMode('progression')}
            aria-label={t('mainMenu.progressViewLabel')}
          >
            <BarChart3 className="main-menu__view-icon" />
            {t('mainMenu.progressView')}
          </button>
          <button
            className={`main-menu__view-btn ${viewMode === 'list' ? 'main-menu__view-btn--active' : ''}`}
            onClick={() => setViewMode('list')}
            aria-label={t('mainMenu.listViewLabel')}
          >
            <List className="main-menu__view-icon" />
            {t('mainMenu.allModules')}
          </button>
        </div>
      </div>

      {/* Content based on view mode and search */}
      {query && viewMode === 'list' ? (
        // Search results view (All Modules)
        results.length === 0 ? (
          <div className="main-menu__no-results" role="status" aria-live="polite">
            <SearchIcon className="main-menu__no-results-icon" aria-hidden="true" />
            <p className="main-menu__no-results-text">
              {t('mainMenu.noModulesFound', undefined, { query })}
            </p>
            <p className="main-menu__no-results-hint">{t('mainMenu.searchHint')}</p>
          </div>
        ) : (
          <>
            <div className="main-menu__results-header" role="status" aria-live="polite">
              <SearchIcon className="main-menu__results-header-icon" aria-hidden="true" />
              <span className="main-menu__results-header-text">
                {t('mainMenu.showingResults', undefined, {
                  count: results.length,
                  total: modules.length,
                })}
              </span>
            </div>
            <div className="main-menu__grid">
              <div
                className="main-menu__grid-container"
                role="grid"
                aria-label={t('mainMenu.modulesAvailable', undefined, { count: results.length })}
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
                    isCurrentModule={currentModuleId === module.id}
                    hiddenDependencies={getHiddenDependencies(
                      module,
                      allModulesRaw,
                      categories,
                      learningModes
                    )}
                  />
                ))}
              </div>
            </div>
          </>
        )
      ) : viewMode === 'progression' ? (
        // Progression dashboard view
        <ProgressionDashboard
          onModuleSelect={handleModuleClick}
          searchQuery={query}
          onClearSearch={() => {
            setQuery('');
            setIsSearchExpanded(false);
            setExpandedFilter(null);
          }}
        />
      ) : (
        // List view (original grid)
        <>
          {!query && (categories.length > 0 || learningModes?.length > 0 || level !== 'all') && (
            <div className="main-menu__results-header" role="status" aria-live="polite">
              <FilterIcon className="main-menu__results-header-icon" aria-hidden="true" />
              <span className="main-menu__results-header-text">
                {t('mainMenu.showingResults', undefined, {
                  count: modules.length,
                  total: allModulesRaw.length,
                })}
              </span>
              <button
                className="main-menu__clear-filters-btn"
                type="button"
                onClick={() => {
                  setCategories([]);
                  setLearningModes([]);
                  setLevel('all');
                  setExpandedFilter(null);
                  setQuery('');
                  setIsSearchExpanded(false);
                }}
                aria-label={t('mainMenu.clearFilters')}
              >
                <XIcon size={14} aria-hidden="true" />
                {t('mainMenu.clearFilters')}
              </button>
            </div>
          )}
          <div className="main-menu__grid" ref={gridRef}>
            <div
              className="main-menu__grid-container"
              role="grid"
              aria-label={t('mainMenu.modulesAvailable', undefined, { count: modules.length })}
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
                  isCurrentModule={currentModuleId === module.id}
                  hiddenDependencies={getHiddenDependencies(
                    module,
                    allModulesRaw,
                    categories,
                    learningModes
                  )}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
