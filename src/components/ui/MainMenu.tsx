import React, { useEffect, useState, useRef, useTransition } from 'react';
import { SearchBar } from './SearchBar';
import { ModuleCard } from './ModuleCard';
import { ModuleGridSkeleton } from './LoadingSkeleton';
import { ProgressionDashboard } from './ProgressionDashboard';
import { HomeDashboard } from './HomeDashboard';
import { useQueryClient } from '@tanstack/react-query';
import { useAllModules, getHiddenDependencies } from '../../hooks/useModuleData';
import { useProgression } from '../../hooks/useProgression';
import { useSearch } from '../../hooks/useSearch';
import { useModuleNavigation } from '../../hooks/useModuleNavigation';
import { useAppStore } from '../../stores/appStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useProgressStore } from '../../stores/progressStore';
import { useTranslation } from '../../utils/i18n';
import type { LearningModule } from '../../types';
import { toast } from '../../stores/toastStore';
import { BarChart3, List, Search as SearchIcon, X as XIcon } from 'lucide-react';
import { UnifiedFilter } from './UnifiedFilter';
import '../../styles/components/main-menu.css';

export const MainMenu: React.FC = () => {
  const { data: modules = [], isLoading, error } = useAllModules();
  const progression = useProgression();
  const { query, setQuery, results } = useSearch(modules);
  const { setPreviousMenuContext, previousMenuContext } = useAppStore();
  const { language, categories, learningModes, level: _level } = useSettingsStore();
  const { t } = useTranslation(language);
  const queryClient = useQueryClient();
  const [viewMode, setViewModeRaw] = useState<'progression' | 'list'>(() => {
    // Map legacy stored values to the new semantics
    // 'progression' now means 'home' tab, 'list' means 'modules' tab
    return previousMenuContext === 'list' ? 'list' : 'progression';
  });
  const [_isPending, startTransition] = useTransition();
  const setViewMode = React.useCallback((mode: 'progression' | 'list') => {
    startTransition(() => {
      setViewModeRaw(mode);
    });
  }, []);
  const [highlightedModuleId, setHighlightedModuleId] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [modulesView, setModulesView] = useState<'progress' | 'all'>('progress');
  const gridRef = useRef<HTMLDivElement>(null);

  // Access raw (unfiltered) modules from the query cache for dependency calculations
  const allModulesRaw = queryClient.getQueryData<LearningModule[]>(['modules']) ?? [];

  // Pre-compute module statuses and hidden dependencies once for all cards
  // instead of each ModuleCard calling useProgression() individually
  const { getModuleCompletion } = useProgressStore();
  const moduleStatusMap = React.useMemo(() => {
    const map = new Map<
      string,
      { status: 'completed' | 'unlocked' | 'locked'; missingCount: number; progressPct: number }
    >();
    for (const m of modules) {
      const completion = getModuleCompletion(m.id);
      map.set(m.id, {
        status: progression.getModuleStatus(m.id),
        missingCount: progression.getMissingPrerequisites(m.id).length,
        progressPct: completion?.bestScore || 0,
      });
    }
    return map;
  }, [modules, progression, getModuleCompletion]);

  // Pre-compute hidden dependencies map once (avoids creating a new Map per card)
  const hiddenDepsMap = React.useMemo(() => {
    if (categories.length === 0 && (!learningModes || learningModes.length === 0)) return null;
    const map = new Map<string, string[]>();
    for (const m of modules) {
      const deps = getHiddenDependencies(m, allModulesRaw, categories, learningModes);
      if (deps.length > 0) map.set(m.id, deps);
    }
    return map;
  }, [modules, allModulesRaw, categories, learningModes]);

  // Shared module navigation logic
  const { navigateToModule } = useModuleNavigation(viewMode);

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
  useEffect(() => {
    if (viewMode !== 'list' || modulesView !== 'all' || isLoading || !modules.length) return;

    try {
      sessionStorage.removeItem('autoScrollToNext');
    } catch {
      /* */
    }

    const timerId = setTimeout(() => {
      scrollFnRef.current('smooth');
    }, 100);

    return () => clearTimeout(timerId);
  }, [viewMode, modulesView, isLoading, modules.length]);

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

  const handleModuleClick = (module: LearningModule) => {
    // Save scroll position before changing view
    const gridElement = document.querySelector('.main-menu__grid');
    if (gridElement) {
      try {
        sessionStorage.setItem('menuGridScrollPosition', gridElement.scrollTop.toString());
      } catch {
        /* */
      }
    }

    navigateToModule(module);
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
      {/* Content based on menu context */}
      {viewMode === 'progression' ? (
        // Home view: hero + stats inline
        <HomeDashboard />
      ) : (
        // Modules view: search + filters + view toggle + content
        <>
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
                    setIsFilterOpen(false);
                  }}
                  onSearchBlur={() => {
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
                    const input = document.querySelector('.search-bar__input') as HTMLElement;
                    input?.blur();
                  }}
                  aria-label={t('common.closeSearch')}
                  type="button"
                >
                  <XIcon size={16} />
                </button>
              )}
              <UnifiedFilter
                isOpen={isFilterOpen}
                onToggle={() => setIsFilterOpen(prev => !prev)}
              />
            </div>

            <div className="main-menu__view-toggle">
              <button
                className={`main-menu__view-btn ${modulesView === 'progress' ? 'main-menu__view-btn--active' : ''}`}
                onClick={() => setModulesView('progress')}
                aria-label={t('mainMenu.progressViewLabel')}
              >
                <BarChart3 className="main-menu__view-icon" />
                {t('mainMenu.progressView')}
              </button>
              <button
                className={`main-menu__view-btn ${modulesView === 'all' ? 'main-menu__view-btn--active' : ''}`}
                onClick={() => setModulesView('all')}
                aria-label={t('mainMenu.listViewLabel')}
              >
                <List className="main-menu__view-icon" />
                {t('mainMenu.allModules')}
              </button>
            </div>
          </div>

          {modulesView === 'progress' ? (
            <ProgressionDashboard
              onModuleSelect={handleModuleClick}
              searchQuery={query}
              onClearSearch={() => {
                setQuery('');
                setIsSearchExpanded(false);
                setIsFilterOpen(false);
              }}
            />
          ) : (
            // All Modules flat grid
            <>
              {query && results.length === 0 ? (
                <div className="main-menu__no-results" role="status" aria-live="polite">
                  <SearchIcon className="main-menu__no-results-icon" aria-hidden="true" />
                  <p className="main-menu__no-results-text">
                    {t('mainMenu.noModulesFound', undefined, { query })}
                  </p>
                  <p className="main-menu__no-results-hint">{t('mainMenu.searchHint')}</p>
                </div>
              ) : (
                <div className="main-menu__grid" ref={gridRef}>
                  <div
                    className="main-menu__grid-container"
                    role="grid"
                    aria-label={t('mainMenu.modulesAvailable', undefined, {
                      count: (query ? results : modules).length,
                    })}
                  >
                    {(query ? results : modules).map((module, index) => (
                      <ModuleCard
                        key={module.id}
                        module={module}
                        onClick={() => handleModuleClick(module)}
                        tabIndex={0}
                        role="gridcell"
                        aria-posinset={index + 1}
                        aria-setsize={(query ? results : modules).length}
                        isNextRecommended={highlightedModuleId === module.id}
                        isCurrentModule={currentModuleId === module.id}
                        moduleStatus={moduleStatusMap.get(module.id)?.status ?? 'locked'}
                        missingPrerequisitesCount={
                          moduleStatusMap.get(module.id)?.missingCount ?? 0
                        }
                        hiddenDependencies={hiddenDepsMap?.get(module.id)}
                        progressPercentage={moduleStatusMap.get(module.id)?.progressPct ?? 0}
                        language={language}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};
