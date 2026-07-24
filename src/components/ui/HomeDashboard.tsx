import React, { useEffect, useCallback, useMemo } from 'react';
import { Trophy, Target, Clock, TrendingUp, ChevronRight } from 'lucide-react';
import { useProgressStore } from '../../stores/progressStore';
import { useUserStore } from '../../stores/userStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../utils/i18n';
import { useProgression } from '../../hooks/useProgression';
import { useStatsReady } from '../../hooks/useStatsReady';
import { useStatsRevealAnimation } from '../../hooks/useStatsRevealAnimation';
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber';
import { useModuleNavigation } from '../../hooks/useModuleNavigation';
import { MODE_I18N_KEYS, splitModuleDisplayName } from '../../utils/progressionDisplay';
import '../../styles/components/home-dashboard.css';

interface HomeDashboardProps {
  onViewModules?: () => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({ onViewModules }) => {
  const { getProgressData, getWeeklyAverage } = useProgressStore();
  const { userScores, getTotalScore } = useUserStore();
  const { language } = useSettingsStore();
  const { t } = useTranslation(language);
  const statsReady = useStatsReady();
  const revealAnimation = useStatsRevealAnimation();
  const shouldAnimate = statsReady && revealAnimation;
  const progression = useProgression();
  const { navigateToModule } = useModuleNavigation('progression');

  const nextRecommended = statsReady ? progression.getNextRecommendedModule() : null;

  // Stats data
  const progressData = statsReady ? getProgressData(7) : [];
  const weeklyAverage = statsReady ? getWeeklyAverage() : 0;
  const totalSessions = progressData.reduce((sum, day) => sum + day.sessionsCount, 0);
  const totalTimeSpent = progressData.reduce((sum, day) => sum + day.timeSpent, 0);
  const totalScore = statsReady ? getTotalScore() : 0;
  const moduleData = statsReady ? Object.values(userScores) : [];
  const avgScore =
    moduleData.length > 0
      ? Math.round(moduleData.reduce((sum, m) => sum + m.bestScore, 0) / moduleData.length)
      : weeklyAverage || 0;

  // Progression data
  const { stats } = progression;
  const displayStats = statsReady
    ? stats
    : {
        ...stats,
        completionPercentage: 0,
        completedModules: 0,
        totalModules: stats.totalModules,
        unitStats: stats.unitStats.map(unit => ({ ...unit, completed: 0, percentage: 0 })),
      };

  const animatedPct = useAnimatedNumber(displayStats.completionPercentage, shouldAnimate);
  const animatedCompleted = useAnimatedNumber(displayStats.completedModules, shouldAnimate);
  const animatedScore = useAnimatedNumber(totalScore, shouldAnimate);
  const animatedAvg = useAnimatedNumber(avgScore, shouldAnimate);
  const animatedSessions = useAnimatedNumber(totalSessions, shouldAnimate);
  const animatedMinutes = useAnimatedNumber(Math.round(totalTimeSpent / 60), shouldAnimate);

  const unitInfo: Record<number, { name: string; shortName: string; code: string; color: string }> =
    {
      1: { name: 'Foundation', shortName: 'Found', code: 'A1', color: 'emerald' },
      2: { name: 'Elementary', shortName: 'Elem', code: 'A2', color: 'blue' },
      3: { name: 'Intermediate', shortName: 'Inter', code: 'B1', color: 'purple' },
      4: { name: 'Upper-Intermediate', shortName: 'Upper', code: 'B2', color: 'orange' },
      5: { name: 'Advanced', shortName: 'Adv', code: 'C1', color: 'red' },
      6: { name: 'Mastery', shortName: 'Mast', code: 'C2', color: 'indigo' },
    };

  const handleContinue = useCallback(() => {
    if (nextRecommended) navigateToModule(nextRecommended);
    else if (onViewModules) onViewModules();
  }, [nextRecommended, navigateToModule, onViewModules]);

  const nextLevel = nextRecommended
    ? (Array.isArray(nextRecommended.level)
        ? nextRecommended.level[0]
        : nextRecommended.level
      ).toUpperCase()
    : '';

  const nextModeLabel = nextRecommended
    ? t(MODE_I18N_KEYS[nextRecommended.learningMode] || 'common.exercise')
    : '';

  const currentUnitIdx = displayStats.unitStats.findIndex(u => u.percentage < 100);
  const currentUnitStat =
    displayStats.unitStats[
      currentUnitIdx === -1 ? Math.max(0, displayStats.unitStats.length - 1) : currentUnitIdx
    ];
  const currentUnitInfo = currentUnitStat
    ? unitInfo[currentUnitStat.unit as keyof typeof unitInfo]
    : null;

  const nextModuleDisplay = useMemo(() => {
    if (!nextRecommended) return null;
    const { title, typeLabel } = splitModuleDisplayName(nextRecommended.name);
    const mode = typeLabel || nextModeLabel;
    const meta = [nextLevel, mode].filter(Boolean).join(' · ');
    return { title, meta };
  }, [nextRecommended, nextLevel, nextModeLabel]);

  const progressSummary = useMemo(
    () =>
      `${animatedCompleted} ${t('common.of', 'of')} ${displayStats.totalModules} ${t('common.modules', 'exercises')}`,
    [animatedCompleted, displayStats.totalModules, t]
  );

  // Enter key → navigate to current lesson
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.repeat) {
        // Don't trigger if user is typing in an input/textarea
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        handleContinue();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleContinue]);

  return (
    <div className="home-dash" data-lp-home>
      {/* Hero — LearnFlow resumen layout: continue banner + context cards */}
      <div className="home-dash__hero">
        <section className="home-dash__continue-banner" aria-labelledby="home-dash-continue-title">
          <div className="home-dash__continue-copy">
            <span className="home-dash__kicker">{t('dashboard.nextStep', 'Next step')}</span>
            <h2 id="home-dash-continue-title" className="home-dash__continue-title">
              {nextModuleDisplay
                ? nextModuleDisplay.title
                : t('dashboard.startLearning', 'Start learning')}
            </h2>
            <p className="home-dash__continue-meta">
              {nextModuleDisplay
                ? nextModuleDisplay.meta
                : t('dashboard.pickModule', 'Pick a module and begin your first session.')}
            </p>
          </div>
          <button type="button" className="home-dash__continue-btn" onClick={handleContinue}>
            {t('common.continue', 'Continue')} <span aria-hidden="true">→</span>
          </button>
        </section>

        <section
          className="home-dash__context-card home-dash__context-card--summary"
          aria-label={t('dashboard.yourProgress', 'Your progress')}
        >
          <div
            className="home-dash__context-visual"
            style={{ '--progress': animatedPct } as React.CSSProperties}
            role="img"
            aria-hidden="true"
          >
            <div>
              <strong>{animatedPct}%</strong>
            </div>
          </div>
          <p className="home-dash__context-line home-dash__context-line--primary">
            <span className="home-dash__context-title">
              {t('dashboard.yourProgress', 'Your progress')}
            </span>
            <span className="home-dash__context-sep" aria-hidden="true">
              ·
            </span>
            <span className="home-dash__context-stat">{progressSummary}</span>
          </p>
          {currentUnitInfo && currentUnitStat && (
            <p className="home-dash__context-line home-dash__context-line--meta">
              <span className="home-dash__level-mark">{currentUnitInfo.code}</span>
              <span className="home-dash__context-sep" aria-hidden="true">
                ·
              </span>
              <span>{currentUnitInfo.name}</span>
              <span className="home-dash__context-sep" aria-hidden="true">
                ·
              </span>
              <span className="home-dash__context-stat">
                {currentUnitStat.completed}/{currentUnitStat.total}
              </span>
            </p>
          )}
        </section>
      </div>

      {/* Stats Cards */}
      <div className="home-dash__stats">
        <div className="home-dash__stat home-dash__stat--points">
          <Trophy className="home-dash__stat-icon" />
          <div className="home-dash__stat-content">
            <span className="home-dash__stat-value">{animatedScore.toLocaleString()}</span>
            <span className="home-dash__stat-label">{t('dashboard.totalScore', 'Points')}</span>
          </div>
        </div>
        <div className="home-dash__stat home-dash__stat--accuracy">
          <Target className="home-dash__stat-icon" />
          <div className="home-dash__stat-content">
            <span className="home-dash__stat-value">{animatedAvg}%</span>
            <span className="home-dash__stat-label">
              {t('dashboard.learningAccuracy', 'Accuracy')}
            </span>
          </div>
        </div>
        <div className="home-dash__stat home-dash__stat--sessions">
          <Clock className="home-dash__stat-icon" />
          <div className="home-dash__stat-content">
            <span className="home-dash__stat-value">{animatedSessions}</span>
            <span className="home-dash__stat-label">
              {t('dashboard.studySessions', 'Sessions')}
            </span>
          </div>
        </div>
        <div className="home-dash__stat home-dash__stat--time">
          <TrendingUp className="home-dash__stat-icon" />
          <div className="home-dash__stat-content">
            <span className="home-dash__stat-value">{animatedMinutes}m</span>
            <span className="home-dash__stat-label">{t('dashboard.timeSpent', 'Practiced')}</span>
          </div>
        </div>
        {onViewModules && (
          <button
            className="home-dash__stat home-dash__stat--depth"
            onClick={onViewModules}
            type="button"
          >
            <div className="home-dash__stat-content">
              <span className="home-dash__depth-line">
                {displayStats.totalModules} {t('dashboard.depthModules', 'modules')}
              </span>
              <span className="home-dash__depth-line">
                6,700+ {t('dashboard.depthExercises', 'exercises')}
              </span>
              <span className="home-dash__depth-cta">
                {t('dashboard.viewAll', 'View all')} <ChevronRight size={11} />
              </span>
            </div>
          </button>
        )}
      </div>

      {/* Weekly + Levels side by side */}
      <div className="home-dash__progress-row">
        {/* Weekly Progress */}
        <div className="home-dash__weekly">
          <h3 className="home-dash__section-title">
            {t('dashboard.recentActivity', 'Últimos días')}
          </h3>
          <div className="home-dash__weekly-chart">
            {progressData.length === 0 ? (
              <div className="home-dash__empty">
                <TrendingUp className="home-dash__empty-icon" />
                <p>
                  {t('dashboard.completeModulesMessage', 'Complete modules to see your progress')}
                </p>
              </div>
            ) : (
              <div className="home-dash__bars">
                {(() => {
                  // Always show today + 2 previous days with activity
                  const today = progressData[progressData.length - 1];
                  const previous = progressData
                    .slice(0, -1)
                    .filter(d => d.totalScore > 0)
                    .slice(-2);
                  const recent = [...previous, today];
                  const maxPts = Math.max(...recent.map(d => d.totalScore || 0), 1);
                  return recent.map((day, i) => {
                    // Parse YYYY-MM-DD as local date (avoid UTC offset bug)
                    const [y, m, d] = day.date.split('-').map(Number);
                    const date = new Date(y, m - 1, d);
                    const dayName = date.toLocaleDateString(language, { weekday: 'short' });
                    const pts = day.totalScore || 0;
                    const pct = Math.max((pts / maxPts) * 100, pts > 0 ? 8 : 0);
                    const isToday = i === recent.length - 1;
                    return (
                      <div
                        key={i}
                        className={`home-dash__bar-col${isToday ? ' home-dash__bar-col--today' : ''}`}
                      >
                        <div className="home-dash__bar">
                          <div
                            className="home-dash__bar-fill"
                            style={
                              {
                                '--bar-h': `${pct}%`,
                              } as React.CSSProperties
                            }
                          />
                        </div>
                        <span className="home-dash__bar-label">{dayName}</span>
                        <span className="home-dash__bar-value">{pts}</span>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Level Progress — contextual: max 3 (previous, current, next) */}
        <div className="home-dash__levels">
          <h3 className="home-dash__section-title">
            {t('learningPath.unitProgress', 'Level Progress')}
          </h3>
          <div className="home-dash__level-grid">
            {(() => {
              const activeIdx = displayStats.unitStats.findIndex(u => u.percentage < 100);
              const currentIdx = activeIdx === -1 ? displayStats.unitStats.length - 1 : activeIdx;

              let startIdx: number;
              if (currentIdx === 0) {
                startIdx = 0;
              } else if (currentIdx >= stats.unitStats.length - 1) {
                startIdx = Math.max(0, stats.unitStats.length - 3);
              } else {
                startIdx = currentIdx - 1;
              }
              const visibleUnits = displayStats.unitStats.slice(startIdx, startIdx + 3);

              return visibleUnits.map(unitStat => {
                const info = unitInfo[unitStat.unit as keyof typeof unitInfo];
                if (!info) return null;
                const isCurrent = unitStat.unit === displayStats.unitStats[currentIdx]?.unit;
                return (
                  <div
                    key={unitStat.unit}
                    className={`home-dash__level-item${isCurrent ? ' home-dash__level-item--active' : ''}`}
                  >
                    <div className="home-dash__level-circle">
                      <svg viewBox="0 0 36 36" className="home-dash__level-svg">
                        <path
                          className="home-dash__level-ring-bg"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                          className={`home-dash__level-ring-fill home-dash__level-ring-fill--${info.color}`}
                          strokeDasharray={`${unitStat.percentage}, 100`}
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                      </svg>
                      <span
                        className={`home-dash__level-code home-dash__level-code--${info.color}`}
                      >
                        {info.code}
                      </span>
                    </div>
                    <div className="home-dash__level-info">
                      <span className="home-dash__level-name">{info.shortName}</span>
                      <span className="home-dash__level-count">
                        {unitStat.completed}/{unitStat.total}
                      </span>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};
