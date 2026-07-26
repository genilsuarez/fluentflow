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
import type { LearningModule, Category } from '../../types';
import { toast } from '../../stores/toastStore';
import {
  BarChart3,
  List,
  Search as SearchIcon,
  X as XIcon,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { UnifiedFilter } from './UnifiedFilter';
import { useMobileCategoryGridCapacity } from '../../hooks/useMobileCategoryGridCapacity';
import '../../styles/components/main-menu.css';

const LEVEL_ORDER_EX = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'] as const;
const CATEGORY_ORDER: Category[] = [
  'Grammar',
  'Vocabulary',
  'PhrasalVerbs',
  'Idioms',
  'Reading',
  'Review',
];
const LEVEL_ORDER = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'] as const;
const LEVEL_LABELS: Record<string, string> = {
  a1: 'A1',
  a2: 'A2',
  b1: 'B1',
  b2: 'B2',
  c1: 'C1',
  c2: 'C2',
};

export const MainMenu: React.FC = () => {
  const { data: modules = [], isLoading, error } = useAllModules();
  const progression = useProgression();
  const { query, setQuery, results } = useSearch(modules);
  const { setPreviousMenuContext, previousMenuContext } = useAppStore();
  const {
    language,
    categories,
    learningModes,
    level: _level,
    developmentMode,
  } = useSettingsStore();
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
  const [expandedCategories, setExpandedCategories] = useState<Set<Category>>(() => new Set());
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(() => new Set());
  const gridRef = useRef<HTMLDivElement>(null);
  const categoryLayoutKey = `${modulesView}-${query}-${[...expandedCategories].sort().join(',')}`;
  const cardsPerLevel = useMobileCategoryGridCapacity(
    gridRef,
    viewMode === 'list' && modulesView === 'all' && !query,
    categoryLayoutKey
  );

  // Access raw (unfiltered) modules from the query cache for dependency calculations
  const allModulesRaw = React.useMemo(
    () => queryClient.getQueryData<LearningModule[]>(['modules']) ?? [],
    // Re-derive when visible modules change (proxy for query cache update)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [modules]
  );

  // Pre-compute module statuses for exercises view + progression-based statuses
  const { getModuleCompletion, isModuleCompleted } = useProgressStore();

  const exerciseStatusMap = React.useMemo(() => {
    // Determine the user's active level: first CEFR level that is NOT 100% completed.
    const modulesPerLevel = new Map<string, LearningModule[]>();
    for (const m of allModulesRaw) {
      const lvl = Array.isArray(m.level) ? m.level[0] : m.level;
      if (!lvl) continue;
      if (!modulesPerLevel.has(lvl)) modulesPerLevel.set(lvl, []);
      modulesPerLevel.get(lvl)!.push(m);
    }

    let activeLevel: string | null = null;
    const completedLevels = new Set<string>();
    for (const lvl of LEVEL_ORDER_EX) {
      const lvlModules = modulesPerLevel.get(lvl);
      if (!lvlModules || lvlModules.length === 0) continue;
      const allDone = lvlModules.every(m => isModuleCompleted(m.id));
      if (allDone) {
        completedLevels.add(lvl);
      } else if (!activeLevel) {
        activeLevel = lvl;
      }
    }

    const map = new Map<
      string,
      { status: 'completed' | 'unlocked' | 'locked'; missingCount: number; progressPct: number }
    >();
    for (const m of modules) {
      const completion = getModuleCompletion(m.id);
      const mLevel = Array.isArray(m.level) ? m.level[0] : m.level;

      let status: 'completed' | 'unlocked' | 'locked';
      if (isModuleCompleted(m.id)) {
        status = 'completed';
      } else if (developmentMode) {
        // Dev mode: all modules are unlocked regardless of prerequisites/level gates
        status = 'unlocked';
      } else if (mLevel && (completedLevels.has(mLevel) || mLevel === activeLevel)) {
        // Active level or below: unlock without prerequisite chain
        status = 'unlocked';
      } else {
        status = progression.getModuleStatus(m.id);
      }

      map.set(m.id, {
        status,
        missingCount: status === 'locked' ? progression.getMissingPrerequisites(m.id).length : 0,
        progressPct: completion?.bestScore || 0,
      });
    }
    return map;
  }, [
    modules,
    allModulesRaw,
    getModuleCompletion,
    isModuleCompleted,
    progression,
    developmentMode,
  ]);

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

  // Category-grouped view: category → level → toposort within level

  const groupedByCategory = React.useMemo(() => {
    if (modules.length === 0) return [];

    const groups: Array<{
      category: Category;
      levels: Array<{ level: string; label: string; modules: LearningModule[] }>;
      total: number;
      completed: number;
    }> = [];

    for (const category of CATEGORY_ORDER) {
      const catModules = modules.filter(m => m.category === category);
      if (catModules.length === 0) continue;

      const levels: Array<{ level: string; label: string; modules: LearningModule[] }> = [];

      for (const level of LEVEL_ORDER) {
        const levelModules = catModules.filter(m => {
          const mLevels = Array.isArray(m.level) ? m.level : [m.level];
          return mLevels.includes(level);
        });
        if (levelModules.length === 0) continue;

        // Toposort within level
        const idToModule = new Map(levelModules.map(m => [m.id, m]));
        const visited = new Set<string>();
        const sorted: LearningModule[] = [];
        const visit = (mod: LearningModule) => {
          if (visited.has(mod.id)) return;
          visited.add(mod.id);
          if (mod.prerequisites) {
            for (const prereqId of mod.prerequisites) {
              const prereq = idToModule.get(prereqId);
              if (prereq) visit(prereq);
            }
          }
          sorted.push(mod);
        };
        for (const m of levelModules) visit(m);
        levels.push({ level, label: LEVEL_LABELS[level], modules: sorted });
      }

      const completed = catModules.filter(m => isModuleCompleted(m.id)).length;
      groups.push({ category, levels, total: catModules.length, completed });
    }

    return groups;
  }, [modules, isModuleCompleted]);

  const pendingCategoryScrollRef = useRef<Category | null>(null);

  const scrollToFirstCategoryLesson = React.useCallback(
    (category: Category, behavior: ScrollBehavior = 'smooth') => {
      const container = gridRef.current;
      if (!container) return;

      const section = document.getElementById(`cat-${category}`)?.closest('.category-section');
      const firstCard = section?.querySelector('[data-module-id]');
      if (!firstCard) return;

      const containerRect = container.getBoundingClientRect();
      const cardRect = firstCard.getBoundingClientRect();
      const scrollTop = container.scrollTop + (cardRect.top - containerRect.top) - 8;

      container.scrollTo({
        top: Math.max(0, scrollTop),
        behavior,
      });
    },
    []
  );

  const toggleCategory = React.useCallback((category: Category) => {
    setExpandedCategories(prev => {
      const isExpanding = !prev.has(category);
      if (isExpanding) {
        pendingCategoryScrollRef.current = category;
      }
      // Accordion: only one open at a time
      return isExpanding ? new Set([category]) : new Set<Category>();
    });
    // Reset level expansions when toggling categories
    setExpandedLevels(new Set());
  }, []);

  useEffect(() => {
    const category = pendingCategoryScrollRef.current;
    if (!category || !expandedCategories.has(category)) return;
    pendingCategoryScrollRef.current = null;

    const timer = setTimeout(() => {
      scrollToFirstCategoryLesson(category);
    }, 100);

    return () => clearTimeout(timer);
  }, [expandedCategories, scrollToFirstCategoryLesson]);

  const toggleLevelExpanded = React.useCallback((category: string, level: string) => {
    const key = `${category}:${level}`;
    setExpandedLevels(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

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

  // Auto-expand the category with the next recommended module (once)
  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (hasInitializedRef.current) return;
    if (modulesView !== 'all' || !currentModuleId || modules.length === 0) return;

    const mod = modules.find(m => m.id === currentModuleId);
    if (!mod) return;

    hasInitializedRef.current = true;
    setExpandedCategories(new Set([mod.category]));
  }, [modulesView, currentModuleId, modules]);

  // Sync view mode with stored context when component mounts
  useEffect(() => {
    setViewMode(previousMenuContext);
  }, [previousMenuContext, setViewMode]);

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

          const cardOffsetInGrid = gridRef.current.scrollTop + (cardRect.top - gridRect.top);

          // Position the card near the top with ~1 row of context above.
          // Card height + gap ≈ 140px in exercises view.
          const ROW_OFFSET = 148;
          const scrollTop = cardOffsetInGrid - ROW_OFFSET;

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

    // In exercises view, modules unlocked by level can bypass prerequisite check.
    // Development mode always bypasses restrictions.
    const skipPrereqs =
      developmentMode ||
      (modulesView === 'all' && exerciseStatusMap.get(module.id)?.status !== 'locked');
    navigateToModule(module, { skipPrerequisiteCheck: skipPrereqs });
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
        <HomeDashboard onViewModules={() => setViewMode('list')} />
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
            // Category-grouped modules view
            <>
              {query && results.length === 0 ? (
                <div className="main-menu__no-results" role="status" aria-live="polite">
                  <SearchIcon className="main-menu__no-results-icon" aria-hidden="true" />
                  <p className="main-menu__no-results-text">
                    {t('mainMenu.noModulesFound', undefined, { query })}
                  </p>
                  <p className="main-menu__no-results-hint">{t('mainMenu.searchHint')}</p>
                </div>
              ) : query ? (
                // Search results: flat grid (same as before)
                <div className="main-menu__grid" ref={gridRef}>
                  <div
                    className="main-menu__grid-container"
                    role="grid"
                    aria-label={t('mainMenu.modulesAvailable', undefined, {
                      count: results.length,
                    })}
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
                        isNextRecommended={highlightedModuleId === module.id}
                        isCurrentModule={currentModuleId === module.id}
                        moduleStatus={exerciseStatusMap.get(module.id)?.status ?? 'locked'}
                        missingPrerequisitesCount={
                          exerciseStatusMap.get(module.id)?.missingCount ?? 0
                        }
                        hiddenDependencies={hiddenDepsMap?.get(module.id)}
                        progressPercentage={exerciseStatusMap.get(module.id)?.progressPct ?? 0}
                        language={language}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                // Category-grouped view
                <div className="main-menu__categories" ref={gridRef}>
                  {groupedByCategory.map(({ category, levels, total, completed }) => {
                    const isExpanded = expandedCategories.has(category);
                    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

                    return (
                      <section
                        key={category}
                        className="category-section"
                        aria-labelledby={`cat-${category}`}
                      >
                        <button
                          className={`category-section__header ${isExpanded ? 'category-section__header--expanded' : ''}`}
                          onClick={() => toggleCategory(category)}
                          aria-expanded={isExpanded}
                          type="button"
                          id={`cat-${category}`}
                        >
                          <span className="category-section__expand" aria-hidden="true">
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </span>
                          <span className="category-section__name">
                            {t(`categories.${category.toLowerCase()}`)}
                          </span>
                          <span className="category-section__count">{total}</span>
                          <span className="category-section__progress">
                            <span
                              className="category-section__progress-bar"
                              style={{ '--cat-progress': `${pct}%` } as React.CSSProperties}
                            />
                          </span>
                          <span className="category-section__pct">{pct}%</span>
                        </button>

                        {isExpanded && (
                          <div className="category-section__body">
                            {(() => {
                              // Nested expand: each level only reveals the next when expanded.
                              // Past levels (completed) and the active level always show.
                              // The first locked level only appears when the previous level is expanded.
                              // Subsequent locked levels remain hidden behind a summary message.
                              const visibleLevels: typeof levels = [];
                              let hiddenCount = 0;
                              let firstHiddenLabel = '';

                              for (let i = 0; i < levels.length; i++) {
                                const levelData = levels[i];
                                const allLocked = levelData.modules.every(
                                  m => exerciseStatusMap.get(m.id)?.status === 'locked'
                                );

                                if (!allLocked) {
                                  // Completed or active level — always visible
                                  visibleLevels.push(levelData);
                                } else {
                                  // Locked level: only show if previous level is expanded
                                  const prevLevel = levels[i - 1];
                                  const prevKey = prevLevel ? `${category}:${prevLevel.level}` : '';
                                  const prevExpanded = prevKey ? expandedLevels.has(prevKey) : true;

                                  if (prevExpanded && hiddenCount === 0) {
                                    // Show only the first locked level (when prev is expanded)
                                    visibleLevels.push(levelData);
                                  } else {
                                    hiddenCount++;
                                    if (!firstHiddenLabel) firstHiddenLabel = levelData.label;
                                  }
                                }
                              }

                              return (
                                <>
                                  {visibleLevels.map(({ level, label, modules: levelModules }) => {
                                    const levelKey = `${category}:${level}`;
                                    const isLevelExpanded = expandedLevels.has(levelKey);

                                    // Past levels (all modules completed) collapse entirely
                                    // behind "Ver más" — no visual value in highlighting them.
                                    const isLevelPast = levelModules.every(
                                      m => exerciseStatusMap.get(m.id)?.status === 'completed'
                                    );
                                    const defaultVisible = isLevelPast ? 0 : cardsPerLevel;

                                    const visibleModules = isLevelExpanded
                                      ? levelModules
                                      : levelModules.slice(0, defaultVisible);
                                    const hasMore = levelModules.length > defaultVisible;
                                    const remaining = levelModules.length - defaultVisible;

                                    return (
                                      <div
                                        key={level}
                                        className={`category-section__level${isLevelPast && !isLevelExpanded ? ' category-section__level--collapsed' : ''}`}
                                      >
                                        <div
                                          className="category-section__level-tag"
                                          aria-label={`Nivel ${label}`}
                                        >
                                          {label}
                                        </div>
                                        {/* Inline show-more for collapsed past levels */}
                                        {isLevelPast && !isLevelExpanded && hasMore && (
                                          <button
                                            className="category-section__show-more category-section__show-more--inline"
                                            onClick={() => toggleLevelExpanded(category, level)}
                                            type="button"
                                            aria-expanded={false}
                                          >
                                            {`${t('common.showMore')} (+${remaining})`}
                                            <ChevronDown
                                              size={14}
                                              className="category-section__show-more-icon"
                                            />
                                          </button>
                                        )}
                                        {visibleModules.length > 0 && (
                                          <div className="category-section__grid">
                                            {visibleModules.map((module, index) => (
                                              <ModuleCard
                                                key={module.id}
                                                module={module}
                                                onClick={() => handleModuleClick(module)}
                                                tabIndex={0}
                                                role="gridcell"
                                                aria-posinset={index + 1}
                                                aria-setsize={levelModules.length}
                                                isNextRecommended={
                                                  highlightedModuleId === module.id
                                                }
                                                isCurrentModule={currentModuleId === module.id}
                                                moduleStatus={
                                                  exerciseStatusMap.get(module.id)?.status ??
                                                  'locked'
                                                }
                                                missingPrerequisitesCount={
                                                  exerciseStatusMap.get(module.id)?.missingCount ??
                                                  0
                                                }
                                                hiddenDependencies={hiddenDepsMap?.get(module.id)}
                                                progressPercentage={
                                                  exerciseStatusMap.get(module.id)?.progressPct ?? 0
                                                }
                                                language={language}
                                              />
                                            ))}
                                          </div>
                                        )}
                                        {hasMore && !(isLevelPast && !isLevelExpanded) && (
                                          <button
                                            className="category-section__show-more"
                                            onClick={() => toggleLevelExpanded(category, level)}
                                            type="button"
                                            aria-expanded={isLevelExpanded}
                                          >
                                            {isLevelExpanded
                                              ? t('common.showLess')
                                              : `${t('common.showMore')} (+${remaining})`}
                                            <ChevronDown
                                              size={14}
                                              className={`category-section__show-more-icon${isLevelExpanded ? ' category-section__show-more-icon--expanded' : ''}`}
                                            />
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                                  {hiddenCount > 0 && (
                                    <div className="category-section__levels-hidden">
                                      <span className="category-section__levels-hidden-text">
                                        {t('common.levelsHidden', undefined, {
                                          count: hiddenCount,
                                          level: firstHiddenLabel,
                                        })}
                                      </span>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};
