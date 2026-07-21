import React from 'react';
import { useProgression } from '../../hooks/useProgression';
import { useProgressStore } from '../../stores/progressStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../utils/i18n';
import { CheckCircle, Lock, Play, ChevronDown, ChevronRight, X as XIcon } from 'lucide-react';
import type { LearningModule } from '../../types';
import Fuse from 'fuse.js';
import { MODE_I18N_KEYS, getLevelColor } from '../../utils/progressionDisplay';
import '../../styles/components/progression-dashboard.css';

function getModuleGridColumns(): number {
  if (typeof window === 'undefined') return 4;
  if (window.matchMedia('(min-width: 1024px)').matches) return 4;
  if (window.matchMedia('(min-width: 768px)').matches) return 3;
  return 1;
}

function useModuleGridColumns(): number {
  const [columns, setColumns] = React.useState(getModuleGridColumns);
  React.useEffect(() => {
    const mqs = [window.matchMedia('(min-width: 1024px)'), window.matchMedia('(min-width: 768px)')];
    const update = () => setColumns(getModuleGridColumns());
    mqs.forEach(mq => mq.addEventListener('change', update));
    return () => mqs.forEach(mq => mq.removeEventListener('change', update));
  }, []);
  return columns;
}

function useMobileAccordion(breakpoint = 767): boolean {
  const [isMobile, setIsMobile] = React.useState(
    () => typeof window !== 'undefined' && window.innerWidth <= breakpoint
  );
  React.useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [breakpoint]);
  return isMobile;
}

interface ProgressionDashboardProps {
  onModuleSelect: (module: LearningModule) => void;
  searchQuery?: string;
  onClearSearch?: () => void;
}

export const ProgressionDashboard: React.FC<ProgressionDashboardProps> = ({
  onModuleSelect,
  searchQuery = '',
  onClearSearch,
}) => {
  const { isModuleCompleted } = useProgressStore();
  const progression = useProgression();
  const {
    language,
    categories,
    learningModes,
    level,
    setCategories,
    setLearningModes,
    setLevel,
    theme,
    developmentMode,
  } = useSettingsStore();
  const { t } = useTranslation(language);
  const [expandedUnits, setExpandedUnits] = React.useState<Set<number>>(new Set());
  const [expandedCompletedUnits, setExpandedCompletedUnits] = React.useState<Set<number>>(
    new Set()
  );
  const moduleGridColumns = useModuleGridColumns();
  const isMobileAccordion = useMobileAccordion();

  const nextRecommended = progression.getNextRecommendedModule();

  // Enter key activates the next recommended module
  React.useEffect(() => {
    if (!nextRecommended) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in a search input or other editable field
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable)
        return;
      if (e.key === 'Enter') {
        e.preventDefault();
        onModuleSelect(nextRecommended);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextRecommended, onModuleSelect]);

  // Get completed modules from store
  const { completedModules } = useProgressStore();
  const completedModulesCount = Object.keys(completedModules || {}).length;
  const prevCompletedCountRef = React.useRef(completedModulesCount);

  // Force refresh progression when completed modules change
  React.useEffect(() => {
    if (completedModulesCount !== prevCompletedCountRef.current) {
      prevCompletedCountRef.current = completedModulesCount;
      // Force progression refresh to recalculate next-module
      progression.refresh();
    }
  }, [completedModulesCount, progression]);

  // Scroll the .progression-dashboard__units container so the --next module
  // appears near the top, with roughly one row of completed modules visible above.
  const scrollToNextModule = React.useCallback((behavior: ScrollBehavior = 'smooth') => {
    const nextEl = document.querySelector('.progression-dashboard__module--next');
    if (!nextEl) return;

    // Find the scrollable ancestor (.progression-dashboard__units)
    const container = nextEl.closest('.progression-dashboard__units');
    if (!container) {
      nextEl.scrollIntoView({ behavior, block: 'start' });
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const elRect = nextEl.getBoundingClientRect();

    // Position the next module with ~1 row height offset from the top.
    // A row is ~100px (card height + gap). This leaves context above.
    const ROW_OFFSET = 108;
    const elTopInContainer = container.scrollTop + (elRect.top - containerRect.top);
    const scrollTop = elTopInContainer - ROW_OFFSET;

    container.scrollTo({
      top: Math.max(0, scrollTop),
      behavior,
    });
  }, []);

  // Auto-expand unit with next recommended module and scroll to it
  React.useEffect(() => {
    if (!nextRecommended || searchQuery.trim()) return;

    // Expand the unit containing the next recommended module
    setExpandedUnits(prev => {
      if (prev.has(nextRecommended.unit)) return prev;
      if (isMobileAccordion) return new Set([nextRecommended.unit]);
      return new Set([...prev, nextRecommended.unit]);
    });
  }, [nextRecommended, searchQuery, completedModulesCount, isMobileAccordion]);

  // Helper: schedule scroll after the browser has completed layout
  const scheduleScroll = React.useCallback(() => {
    // Wait for the fadeIn animation (150ms) to finish so that
    // offsetTop values are stable before calculating scroll position.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollToNextModule('smooth'));
    });
  }, [scrollToNextModule]);

  // Scroll to the --next module once it appears in the DOM
  React.useEffect(() => {
    if (!nextRecommended) return;

    // Check if the element already exists
    const existing = document.querySelector('.progression-dashboard__module--next');
    if (existing) {
      scheduleScroll();
      return;
    }

    // Otherwise, observe for it to appear
    const container = document.querySelector('.progression-dashboard__units');
    if (!container) return;

    const observer = new MutationObserver(() => {
      const el = document.querySelector('.progression-dashboard__module--next');
      if (el) {
        observer.disconnect();
        scheduleScroll();
      }
    });

    observer.observe(container, { childList: true, subtree: true });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextRecommended?.id, scheduleScroll]);

  const toggleUnit = (unit: number) => {
    const isExpanding = !expandedUnits.has(unit);

    setExpandedUnits(prev => {
      if (prev.has(unit)) {
        const next = new Set(prev);
        next.delete(unit);
        return next;
      }
      if (isMobileAccordion) return new Set([unit]);
      return new Set([...prev, unit]);
    });

    // If expanding a unit with the next module, scroll to it
    if (isExpanding && nextRecommended && nextRecommended.unit === unit) {
      requestAnimationFrame(() => scrollToNextModule('smooth'));
    }
  };

  const handleModuleClick = (module: LearningModule) => {
    onModuleSelect(module);
  };

  const getUnitTitle = (unit: number): string => {
    const titles: Record<number, string> = {
      1: t('mainMenu.unitFoundation'),
      2: t('mainMenu.unitElementary'),
      3: t('mainMenu.unitIntermediate'),
      4: t('mainMenu.unitUpperIntermediate'),
      5: t('mainMenu.unitAdvanced'),
      6: t('mainMenu.unitMastery'),
    };
    return titles[unit] || t('mainMenu.unit', undefined, { unit });
  };

  // Memoize Fuse instance separately — avoids re-indexing on every filter/level change
  const allProgressionModules = React.useMemo(
    () => [...progression.unlockedModules, ...progression.lockedModules],
    [progression.unlockedModules, progression.lockedModules]
  );

  const fuse = React.useMemo(
    () =>
      new Fuse(allProgressionModules, {
        keys: ['name', 'description', 'category', 'tags'],
        threshold: 0.3,
        includeScore: true,
      }),
    [allProgressionModules]
  );

  // Group modules by unit, preserving prerequisite chain order (JSON definition order)
  const modulesByUnit = React.useMemo(() => {
    const units: Record<number, LearningModule[]> = {};
    const seen = new Set<string>();

    // Apply search filter if query exists
    let filteredModules = allProgressionModules;
    if (searchQuery.trim()) {
      filteredModules = fuse.search(searchQuery).map(result => result.item);
    }

    filteredModules.forEach(module => {
      if (seen.has(module.id)) return;
      // Apply category filter — empty array means no filter (show all)
      if (categories.length > 0 && module.category && !categories.includes(module.category)) return;
      // Apply learning mode filter — empty array means no filter (show all)
      if (
        learningModes?.length > 0 &&
        module.learningMode &&
        !learningModes.includes(module.learningMode)
      )
        return;
      // Apply level filter — always applied (even in dev mode)
      if (level !== 'all' && module.level) {
        const moduleLevels = Array.isArray(module.level) ? module.level : [module.level];
        if (!moduleLevels.includes(level as any)) return;
      }
      seen.add(module.id);
      if (!units[module.unit]) {
        units[module.unit] = [];
      }
      units[module.unit].push(module);
    });
    // Sort each unit's modules by their original definition order (prerequisite chain)
    // Modules with no prerequisites come first, then follow the chain
    Object.keys(units).forEach(unitKey => {
      const unitModules = units[Number(unitKey)];
      const idToModule = new Map(unitModules.map(m => [m.id, m]));
      const sorted: LearningModule[] = [];
      const visited = new Set<string>();

      const visit = (mod: LearningModule) => {
        if (visited.has(mod.id)) return;
        visited.add(mod.id);
        // Visit prerequisites first (that are in this unit)
        if (mod.prerequisites) {
          mod.prerequisites.forEach(prereqId => {
            const prereq = idToModule.get(prereqId);
            if (prereq) visit(prereq);
          });
        }
        sorted.push(mod);
      };

      unitModules.forEach(m => visit(m));
      units[Number(unitKey)] = sorted;
    });
    return units;
  }, [allProgressionModules, fuse, categories, learningModes, level, searchQuery]);

  // Auto-expand units with search results
  React.useEffect(() => {
    if (searchQuery.trim()) {
      const unitsWithResults = Object.keys(modulesByUnit).map(Number);
      setExpandedUnits(new Set(unitsWithResults));
    }
  }, [searchQuery, modulesByUnit]);

  return (
    <div
      className={`progression-dashboard ${theme === 'dark' ? 'progression-dashboard--dark-theme' : ''}`}
    >
      {/* Search/Filter Results Header */}
      {(searchQuery.trim() ||
        categories.length > 0 ||
        learningModes?.length > 0 ||
        level !== 'all') && (
        <div className="progression-dashboard__search-results">
          <p className="progression-dashboard__search-text">
            {t('mainMenu.showingResults', undefined, {
              count: Object.values(modulesByUnit).flat().length,
              total: [...progression.unlockedModules, ...progression.lockedModules].length,
            })}
          </p>
          <button
            className="progression-dashboard__clear-filters-btn"
            type="button"
            onClick={() => {
              setCategories([]);
              setLearningModes([]);
              setLevel('all');
              onClearSearch?.();
            }}
            aria-label={t('mainMenu.clearFilters')}
          >
            <XIcon size={14} aria-hidden="true" />
            {t('mainMenu.clearFilters')}
          </button>
        </div>
      )}

      {/* Units Progress */}
      <div className="progression-dashboard__units">
        {Object.keys(modulesByUnit).length === 0 && searchQuery.trim() ? (
          // No search results
          <div className="progression-dashboard__no-results">
            <p className="progression-dashboard__no-results-text">
              {t('mainMenu.noModulesFound', undefined, { query: searchQuery })}
            </p>
            <p className="progression-dashboard__no-results-hint">{t('mainMenu.searchHint')}</p>
          </div>
        ) : (
          Object.entries(modulesByUnit)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([unitStr, modules]) => {
              const unit = Number(unitStr);
              // Use filtered module count for display; completed count from filtered modules
              const filteredTotal = modules.length;
              const filteredCompleted = modules.filter(m => isModuleCompleted(m.id)).length;
              const filteredPercentage =
                filteredTotal > 0 ? Math.round((filteredCompleted / filteredTotal) * 100) : 0;

              const isExpanded = expandedUnits.has(unit);
              const hasNextModule = modules.some(m => nextRecommended?.id === m.id);

              return (
                <div key={unit} className="progression-dashboard__unit">
                  <div
                    className={`progression-dashboard__unit-header progression-dashboard__unit-header--clickable ${filteredPercentage === 100 ? 'progression-dashboard__unit-header--completed' : ''}`}
                    onClick={() => toggleUnit(unit)}
                  >
                    <div className="progression-dashboard__unit-info">
                      <div
                        className={`progression-dashboard__unit-expand ${filteredPercentage === 100 ? 'progression-dashboard__unit-expand--completed' : ''}`}
                      >
                        {filteredPercentage === 100 ? (
                          <CheckCircle className="progression-dashboard__expand-icon progression-dashboard__expand-icon--completed" />
                        ) : isExpanded ? (
                          <ChevronDown className="progression-dashboard__expand-icon" />
                        ) : (
                          <ChevronRight className="progression-dashboard__expand-icon" />
                        )}
                      </div>
                      {modules[0] && (
                        <span
                          className="progression-dashboard__level-badge"
                          style={
                            {
                              '--level-color': getLevelColor(
                                Array.isArray(modules[0].level)
                                  ? modules[0].level[0]
                                  : modules[0].level
                              ),
                            } as React.CSSProperties
                          }
                        >
                          {Array.isArray(modules[0].level)
                            ? modules[0].level[0].toUpperCase()
                            : modules[0].level.toUpperCase()}
                        </span>
                      )}
                      <h3 className="progression-dashboard__unit-title">{getUnitTitle(unit)}</h3>
                      {hasNextModule && !isExpanded && (
                        <div className="progression-dashboard__unit-next-indicator">
                          <span className="progression-dashboard__unit-next-label">
                            {t('learningPath.nextRecommended')}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="progression-dashboard__unit-progress">
                      <span className="progression-dashboard__unit-stats">
                        {filteredCompleted}/{filteredTotal}
                      </span>
                      <div className="progression-dashboard__progress-bar">
                        <div
                          className="progression-dashboard__progress-fill"
                          style={
                            { '--progress-width': `${filteredPercentage}%` } as React.CSSProperties
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {isExpanded &&
                    (() => {
                      const COLUMNS = moduleGridColumns;

                      // In progress view, only nextRecommended is shown as "unlocked".
                      // Other technically-unlocked modules display as locked to reinforce
                      // linear progression UX — skipped in development mode.
                      const effectiveStatus = (module: LearningModule) => {
                        const raw = progression.getModuleStatus(module.id);
                        if (
                          !developmentMode &&
                          raw === 'unlocked' &&
                          module.id !== nextRecommended?.id
                        ) {
                          return 'locked';
                        }
                        return raw;
                      };

                      const nextIndex = nextRecommended
                        ? modules.findIndex(m => m.id === nextRecommended.id)
                        : -1;

                      let prefix: LearningModule[] = [];
                      let suffixVisible: LearningModule[] = modules;
                      let lockedHidden = 0;
                      let showCompletedToggle = false;
                      let collapsibleCompleted = 0;
                      const isCompletedExpanded =
                        expandedCompletedUnits.has(unit) || !!searchQuery.trim();

                      if (!developmentMode) {
                        if (nextIndex > 0) {
                          const beforeNextCount = nextIndex;
                          if (beforeNextCount > COLUMNS) {
                            collapsibleCompleted = beforeNextCount - COLUMNS;
                          }
                        } else if (nextIndex === -1) {
                          const allCompleted =
                            modules.length > 0 &&
                            modules.every(m => progression.getModuleStatus(m.id) === 'completed');
                          if (allCompleted && modules.length > COLUMNS) {
                            collapsibleCompleted = modules.length - COLUMNS;
                          }
                        }

                        showCompletedToggle = collapsibleCompleted > 0 && !searchQuery.trim();

                        let suffix: LearningModule[] = modules;

                        if (nextIndex > 0) {
                          const beforeNext = modules.slice(0, nextIndex);
                          suffix = modules.slice(nextIndex);
                          if (isCompletedExpanded || beforeNext.length <= COLUMNS) {
                            prefix = beforeNext;
                          } else {
                            prefix = beforeNext.slice(-COLUMNS);
                          }
                        } else if (nextIndex === -1) {
                          const allCompleted =
                            modules.length > 0 &&
                            modules.every(m => progression.getModuleStatus(m.id) === 'completed');
                          if (allCompleted) {
                            suffix = [];
                            if (isCompletedExpanded || modules.length <= COLUMNS) {
                              prefix = modules;
                            } else {
                              prefix = modules.slice(-COLUMNS);
                            }
                          }
                        }

                        const unlockedCount = suffix.filter(
                          m => effectiveStatus(m) !== 'locked'
                        ).length;
                        const remainder = unlockedCount % COLUMNS;
                        const toFillRow = remainder === 0 ? 0 : COLUMNS - remainder;
                        const LOCKED_VISIBLE = toFillRow + COLUMNS;

                        let lockedShown = 0;
                        lockedHidden = 0;
                        suffixVisible = [];

                        for (const module of suffix) {
                          const status = effectiveStatus(module);
                          if (status === 'locked') {
                            if (lockedShown < LOCKED_VISIBLE) {
                              suffixVisible.push(module);
                              lockedShown++;
                            } else {
                              lockedHidden++;
                            }
                          } else {
                            suffixVisible.push(module);
                          }
                        }

                        const rowOverflow = suffixVisible.length % COLUMNS;
                        if (rowOverflow > 0) {
                          for (let i = 0; i < rowOverflow; i++) {
                            const removed = suffixVisible.pop();
                            if (removed && effectiveStatus(removed) === 'locked') {
                              lockedHidden++;
                            }
                          }
                        }
                      }

                      const toggleCompletedExpanded = (e: React.MouseEvent) => {
                        e.stopPropagation();
                        setExpandedCompletedUnits(prev => {
                          const next = new Set(prev);
                          if (next.has(unit)) next.delete(unit);
                          else next.add(unit);
                          return next;
                        });
                      };

                      const renderModuleCard = (module: LearningModule) => {
                        const status = effectiveStatus(module);
                        const isCompleted = isModuleCompleted(module.id);
                        const isNext = nextRecommended?.id === module.id;

                        return (
                          <div
                            key={module.id}
                            className={`progression-dashboard__module progression-dashboard__module--${status} module-card--${module.learningMode} ${isNext ? 'progression-dashboard__module--next' : ''}`}
                            onClick={
                              status !== 'locked' ? () => handleModuleClick(module) : undefined
                            }
                            aria-disabled={status === 'locked'}
                          >
                            <div className="progression-dashboard__module-icon">
                              {isCompleted ? (
                                <CheckCircle className="progression-dashboard__icon progression-dashboard__icon--completed" />
                              ) : status === 'locked' ? (
                                <Lock className="progression-dashboard__icon progression-dashboard__icon--locked" />
                              ) : (
                                <Play className="progression-dashboard__icon progression-dashboard__icon--available" />
                              )}
                            </div>

                            <div className="progression-dashboard__module-content">
                              <h4 className="progression-dashboard__module-name">{module.name}</h4>
                              <p className="progression-dashboard__module-desc">
                                {module.description}
                              </p>
                              <div className="progression-dashboard__module-meta">
                                <span className="progression-dashboard__module-type">
                                  {t(MODE_I18N_KEYS[module.learningMode] || 'common.exercise')}
                                </span>
                                <span className="progression-dashboard__module-time">
                                  {module.estimatedTime}min
                                </span>
                              </div>
                            </div>

                            {isNext && (
                              <div className="progression-dashboard__next-indicator">
                                <span className="progression-dashboard__next-label">
                                  {t('learningPath.nextRecommended')}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      };

                      return (
                        <div className="progression-dashboard__modules-stack">
                          {showCompletedToggle && !isCompletedExpanded && (
                            <button
                              type="button"
                              className="progression-dashboard__show-more"
                              onClick={toggleCompletedExpanded}
                              aria-expanded={false}
                            >
                              {`${t('common.showMore')} (+${collapsibleCompleted})`}
                              <ChevronDown
                                size={14}
                                className="progression-dashboard__show-more-icon"
                                aria-hidden="true"
                              />
                            </button>
                          )}
                          {prefix.length > 0 && (
                            <div className="progression-dashboard__modules progression-dashboard__modules--completed">
                              {prefix.map(renderModuleCard)}
                            </div>
                          )}
                          {showCompletedToggle && isCompletedExpanded && (
                            <button
                              type="button"
                              className="progression-dashboard__show-more progression-dashboard__show-more--after-completed"
                              onClick={toggleCompletedExpanded}
                              aria-expanded={true}
                            >
                              {t('common.showLess')}
                              <ChevronDown
                                size={14}
                                className="progression-dashboard__show-more-icon progression-dashboard__show-more-icon--expanded"
                                aria-hidden="true"
                              />
                            </button>
                          )}
                          {suffixVisible.length > 0 && (
                            <div
                              className={`progression-dashboard__modules${lockedHidden > 0 ? ' progression-dashboard__modules--truncated' : ''}`}
                            >
                              {suffixVisible.map(renderModuleCard)}
                            </div>
                          )}
                          {lockedHidden > 0 && (
                            <div className="progression-dashboard__locked-hidden">
                              <Lock size={14} aria-hidden="true" />
                              <span>
                                +{lockedHidden} {t('common.lockedModulesHidden')}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                </div>
              );
            })
        )}
      </div>
    </div>
  );
};
