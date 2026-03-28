import React from 'react';
import { useProgression } from '../../hooks/useProgression';
import { useAppStore } from '../../stores/appStore';
import { useProgressStore } from '../../stores/progressStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../utils/i18n';
import { toast } from '../../stores/toastStore';
import { CheckCircle, Lock, Play, ChevronDown, ChevronRight, X as XIcon } from 'lucide-react';
import type { LearningModule } from '../../types';
import Fuse from 'fuse.js';
import '../../styles/components/progression-dashboard.css';
import '../../styles/components/progression-dashboard-dark-theme.css';

interface ProgressionDashboardProps {
  onModuleSelect: (module: LearningModule) => void;
  searchQuery?: string;
}

export const ProgressionDashboard: React.FC<ProgressionDashboardProps> = ({
  onModuleSelect: _onModuleSelect,
  searchQuery = '',
}) => {
  const { setPreviousMenuContext } = useAppStore();
  const { isModuleCompleted } = useProgressStore();
  const progression = useProgression();
  const { language, categories, learningModes, setCategories, setLearningModes } = useSettingsStore();
  const { t } = useTranslation(language);
  const [expandedUnits, setExpandedUnits] = React.useState<Set<number>>(new Set());
  const [isDarkMode, setIsDarkMode] = React.useState(false);

  // Detect dark mode changes dynamically
  React.useEffect(() => {
    const checkDarkMode = () => {
      const darkMode =
        document.documentElement.classList.contains('dark') ||
        document.body.classList.contains('dark');
      setIsDarkMode(darkMode);
    };

    // Initial check
    checkDarkMode();

    // Watch for theme changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  // Emergency function to force white text (only if CSS fails)
  const forceWhiteTextIfNeeded = React.useCallback(() => {
    if (isDarkMode) {
      // Only run this as last resort if CSS isn't working
      const dashboardElement = document.querySelector('.progression-dashboard');
      if (dashboardElement) {
        const textElements = dashboardElement.querySelectorAll('*');
        textElements.forEach(element => {
          // Skip elements inside locked modules — they should stay dimmed
          if ((element as HTMLElement).closest?.('.progression-dashboard__module--locked')) {
            return;
          }
          const computedStyle = window.getComputedStyle(element);
          const textColor = computedStyle.color;

          // If text is still dark in dark mode, force it to white
          if (textColor.includes('rgb(55, 65, 81)') || textColor.includes('rgb(107, 114, 128)')) {
            (element as HTMLElement).style.color = '#ffffff';
          }
        });
      }
    }
  }, [isDarkMode]);

  // Run emergency fix after component mounts (only if needed)
  React.useEffect(() => {
    // Small delay to let CSS apply first
    const timer = setTimeout(forceWhiteTextIfNeeded, 100);
    return () => clearTimeout(timer);
  }, [isDarkMode, forceWhiteTextIfNeeded]);

  const nextRecommended = progression.getNextRecommendedModule();

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

  // Auto-expand unit with next recommended module on initial load only
  const hasAutoExpanded = React.useRef(false);
  React.useEffect(() => {
    if (nextRecommended && !hasAutoExpanded.current && !searchQuery.trim()) {
      hasAutoExpanded.current = true;
      setExpandedUnits(prev => new Set([...prev, nextRecommended.unit]));
    }
  }, [nextRecommended, searchQuery]);

  // Scroll to next module after initial auto-expand
  React.useEffect(() => {
    if (nextRecommended && hasAutoExpanded.current) {
      const timer = setTimeout(() => {
        const nextModuleElement = document.querySelector('.progression-dashboard__module--next');
        if (nextModuleElement) {
          nextModuleElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [nextRecommended]);

  const toggleUnit = (unit: number) => {
    const newExpanded = new Set(expandedUnits);
    const isExpanding = !newExpanded.has(unit);

    if (newExpanded.has(unit)) {
      newExpanded.delete(unit);
    } else {
      newExpanded.add(unit);
    }
    setExpandedUnits(newExpanded);

    // If expanding a unit with the next module, scroll to it
    if (isExpanding && nextRecommended && nextRecommended.unit === unit) {
      setTimeout(() => {
        const nextModuleElement = document.querySelector('.progression-dashboard__module--next');
        if (nextModuleElement) {
          nextModuleElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
      }, 300);
    }
  };

  const handleContinueLearning = () => {
    if (nextRecommended) {
      const modeLabels: Record<string, string> = {
        flashcard: t('mainMenu.modeFlashcard'),
        quiz: t('mainMenu.modeQuiz'),
        completion: t('mainMenu.modeCompletion'),
        sorting: t('mainMenu.modeSorting'),
        matching: t('mainMenu.modeMatching'),
      };

      toast.info(
        t('mainMenu.startingModule'),
        `${nextRecommended.name} - ${modeLabels[nextRecommended.learningMode] || t('mainMenu.modeDefault')}`,
        { duration: 1500 }
      );

      // Save that user came from progression dashboard
      setPreviousMenuContext('progression');

      // Update URL hash FIRST - let App.tsx useEffect handle Zustand updates
      window.location.hash = `#/learn/${nextRecommended.id}`;
    }
  };

  const handleModuleClick = (module: LearningModule) => {
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

    const modeLabels: Record<string, string> = {
      flashcard: t('mainMenu.modeFlashcard'),
      quiz: t('mainMenu.modeQuiz'),
      completion: t('mainMenu.modeCompletion'),
      sorting: t('mainMenu.modeSorting'),
      matching: t('mainMenu.modeMatching'),
    };

    toast.info(
      t('mainMenu.startingModule'),
      `${module.name} - ${modeLabels[module.learningMode] || t('mainMenu.modeDefault')}`,
      { duration: 1500 }
    );

    // Save that user came from progression dashboard
    setPreviousMenuContext('progression');

    // Update URL hash FIRST - let App.tsx useEffect handle Zustand updates
    window.location.hash = `#/learn/${module.id}`;
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

  const getLevelColor = (level: string): string => {
    const colors = {
      a1: '#10b981', // green
      a2: '#3b82f6', // blue
      b1: '#f59e0b', // amber
      b2: '#ef4444', // red
      c1: '#8b5cf6', // violet
      c2: '#ec4899', // pink
    };
    return colors[level as keyof typeof colors] || '#6b7280';
  };

  // Group modules by unit, preserving prerequisite chain order (JSON definition order)
  const modulesByUnit = React.useMemo(() => {
    const units: Record<number, LearningModule[]> = {};
    // Combine all modules and deduplicate by id
    const allModules = [...progression.unlockedModules, ...progression.lockedModules];
    const seen = new Set<string>();

    // Apply search filter if query exists
    let filteredModules = allModules;
    if (searchQuery.trim()) {
      const fuse = new Fuse(allModules, {
        keys: ['name', 'description', 'category', 'tags'],
        threshold: 0.3,
        includeScore: true,
      });
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
  }, [
    progression.unlockedModules,
    progression.lockedModules,
    categories,
    learningModes,
    searchQuery,
  ]);

  // Auto-expand units with search results
  React.useEffect(() => {
    if (searchQuery.trim()) {
      const unitsWithResults = Object.keys(modulesByUnit).map(Number);
      setExpandedUnits(new Set(unitsWithResults));
    }
  }, [searchQuery, modulesByUnit]);

  return (
    <div
      className={`progression-dashboard ${isDarkMode ? 'progression-dashboard--dark-theme' : ''}`}
    >
      {/* Search/Filter Results Header */}
      {(searchQuery.trim() || categories.length > 0 || learningModes?.length > 0) && (
        <div className="progression-dashboard__search-results">
          <p className="progression-dashboard__search-text">
            {t('mainMenu.showingResults', undefined, {
              count: Object.values(modulesByUnit).flat().length,
              total: [...progression.unlockedModules, ...progression.lockedModules].length,
            })}
          </p>
          {(categories.length > 0 || (learningModes?.length ?? 0) > 0) && (
            <button
              className="progression-dashboard__clear-filters-btn"
              type="button"
              onClick={() => {
                setCategories([]);
                setLearningModes([]);
              }}
              aria-label={t('mainMenu.clearFilters')}
            >
              <XIcon size={14} aria-hidden="true" />
              {t('mainMenu.clearFilters')}
            </button>
          )}
        </div>
      )}

      {/* Continue Learning Section */}
      {nextRecommended && !searchQuery.trim() && (
        <div className="progression-dashboard__hero">
          <div className="progression-dashboard__continue">
            <div className="progression-dashboard__next-module">
              <div className="progression-dashboard__next-info">
                <h3 className="progression-dashboard__next-name">{nextRecommended.name}</h3>
                <p className="progression-dashboard__next-desc">{nextRecommended.description}</p>
                <div className="progression-dashboard__next-meta">
                  <span
                    className="progression-dashboard__level-badge"
                    style={
                      {
                        '--level-color': getLevelColor(
                          Array.isArray(nextRecommended.level)
                            ? nextRecommended.level[0]
                            : nextRecommended.level
                        ),
                      } as React.CSSProperties
                    }
                  >
                    {Array.isArray(nextRecommended.level)
                      ? nextRecommended.level[0].toUpperCase()
                      : nextRecommended.level.toUpperCase()}
                  </span>
                  <span className="progression-dashboard__module-type progression-dashboard__module-type--hero">
                    {nextRecommended.learningMode}
                  </span>
                  <span className="progression-dashboard__time">
                    {nextRecommended.estimatedTime}min
                  </span>
                </div>
              </div>
              <button
                className="progression-dashboard__continue-btn"
                onClick={handleContinueLearning}
              >
                <Play className="progression-dashboard__continue-icon" />
                {t('common.continue')}
              </button>
            </div>
          </div>
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

                  {isExpanded && (
                    <div className="progression-dashboard__modules">
                      {modules.map(module => {
                        const status = progression.getModuleStatus(module.id);
                        const isCompleted = isModuleCompleted(module.id);
                        const isNext = nextRecommended?.id === module.id;

                        return (
                          <div
                            key={module.id}
                            className={`progression-dashboard__module progression-dashboard__module--${status} ${isNext ? 'progression-dashboard__module--next' : ''}`}
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
                                <span
                                  className="progression-dashboard__level-badge"
                                  style={
                                    {
                                      '--level-color': getLevelColor(
                                        Array.isArray(module.level) ? module.level[0] : module.level
                                      ),
                                    } as React.CSSProperties
                                  }
                                >
                                  {Array.isArray(module.level)
                                    ? module.level[0].toUpperCase()
                                    : module.level.toUpperCase()}
                                </span>
                                <span className="progression-dashboard__module-type">
                                  {module.learningMode}
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
                      })}
                    </div>
                  )}
                </div>
              );
            })
        )}
      </div>
    </div>
  );
};
