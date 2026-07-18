import React, { useEffect, useCallback } from 'react';
import { Play, Trophy, Target, Clock, TrendingUp, ChevronRight } from 'lucide-react';
import { useProgressStore } from '../../stores/progressStore';
import { useUserStore } from '../../stores/userStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../utils/i18n';
import { useProgression } from '../../hooks/useProgression';
import { useModuleNavigation } from '../../hooks/useModuleNavigation';
import { MODE_I18N_KEYS, getLevelColor } from '../../utils/progressionDisplay';
import '../../styles/components/home-dashboard.css';

interface HomeDashboardProps {
  onViewModules?: () => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({ onViewModules }) => {
  const { getProgressData, getWeeklyAverage } = useProgressStore();
  const { userScores, getTotalScore } = useUserStore();
  const { language } = useSettingsStore();
  const { t } = useTranslation(language);
  const progression = useProgression();
  const { navigateToModule } = useModuleNavigation('progression');

  const nextRecommended = progression.getNextRecommendedModule();

  // Stats data
  const progressData = getProgressData(7);
  const weeklyAverage = getWeeklyAverage();
  const totalSessions = progressData.reduce((sum, day) => sum + day.sessionsCount, 0);
  const totalTimeSpent = progressData.reduce((sum, day) => sum + day.timeSpent, 0);
  const totalScore = getTotalScore();
  const moduleData = Object.values(userScores);
  const avgScore =
    moduleData.length > 0
      ? Math.round(moduleData.reduce((sum, m) => sum + m.bestScore, 0) / moduleData.length)
      : weeklyAverage || 0;

  // Progression data
  const { stats } = progression;

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
  }, [nextRecommended, navigateToModule]);

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
    <div className="home-dash">
      {/* Hero Section — compact: ring + title + CTA in one row */}
      <div className="home-dash__hero">
        <div className="home-dash__hero-ring">
          <svg viewBox="0 0 36 36" className="home-dash__ring-svg">
            <path
              className="home-dash__ring-bg"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className="home-dash__ring-fill"
              strokeDasharray={`${stats.completionPercentage}, 100`}
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <div className="home-dash__ring-center">
            <strong>{stats.completionPercentage}%</strong>
          </div>
        </div>
        <div className="home-dash__hero-body">
          <span className="home-dash__hero-kicker">
            {t('dashboard.yourProgress', 'Your progress')}
          </span>
          <h2 className="home-dash__hero-title">
            {stats.completedModules} {t('common.of', 'of')} {stats.totalModules}{' '}
            {t('common.modules', 'exercises')}
          </h2>
        </div>
        {nextRecommended && (
          <button className="home-dash__hero-cta" onClick={handleContinue} type="button">
            <span className="home-dash__cta-module">
              <span
                className="home-dash__cta-level"
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
              <span className="home-dash__cta-info">
                <span className="home-dash__cta-name">{nextRecommended.name}</span>
                <span className="home-dash__cta-type">
                  {t(MODE_I18N_KEYS[nextRecommended.learningMode] || 'common.exercise')}
                </span>
              </span>
            </span>
            <span className="home-dash__cta-play">
              <Play size={14} />
              {t('common.continue', 'Continue')}
            </span>
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="home-dash__stats">
        <div className="home-dash__stat home-dash__stat--points">
          <Trophy className="home-dash__stat-icon" />
          <div className="home-dash__stat-content">
            <span className="home-dash__stat-value">{totalScore.toLocaleString()}</span>
            <span className="home-dash__stat-label">{t('dashboard.totalScore', 'Points')}</span>
          </div>
        </div>
        <div className="home-dash__stat home-dash__stat--accuracy">
          <Target className="home-dash__stat-icon" />
          <div className="home-dash__stat-content">
            <span className="home-dash__stat-value">{avgScore}%</span>
            <span className="home-dash__stat-label">
              {t('dashboard.learningAccuracy', 'Accuracy')}
            </span>
          </div>
        </div>
        <div className="home-dash__stat home-dash__stat--sessions">
          <Clock className="home-dash__stat-icon" />
          <div className="home-dash__stat-content">
            <span className="home-dash__stat-value">{totalSessions}</span>
            <span className="home-dash__stat-label">
              {t('dashboard.studySessions', 'Sessions')}
            </span>
          </div>
        </div>
        <div className="home-dash__stat home-dash__stat--time">
          <TrendingUp className="home-dash__stat-icon" />
          <div className="home-dash__stat-content">
            <span className="home-dash__stat-value">{Math.round(totalTimeSpent / 60)}m</span>
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
                {stats.totalModules} {t('dashboard.depthModules', 'modules')}
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

      {/* Weekly Progress */}
      <div className="home-dash__weekly">
        <h3 className="home-dash__section-title">
          {t('dashboard.weeklyProgress', 'Weekly Progress')}
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
              {progressData.slice(-7).map((day, i) => {
                const date = new Date(day.date);
                const dayName = date.toLocaleDateString(language, { weekday: 'short' });
                return (
                  <div key={i} className="home-dash__bar-col">
                    <div className="home-dash__bar">
                      <div
                        className="home-dash__bar-fill"
                        style={
                          {
                            '--bar-h': `${Math.max(day.averageScore || 0, 4)}%`,
                          } as React.CSSProperties
                        }
                      />
                    </div>
                    <span className="home-dash__bar-label">{dayName}</span>
                    <span className="home-dash__bar-value">{day.averageScore || 0}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Level Progress */}
      <div className="home-dash__levels">
        <h3 className="home-dash__section-title">
          {t('learningPath.unitProgress', 'Level Progress')}
        </h3>
        <div className="home-dash__level-grid">
          {stats.unitStats.map(unitStat => {
            const info = unitInfo[unitStat.unit as keyof typeof unitInfo];
            if (!info) return null;
            return (
              <div key={unitStat.unit} className="home-dash__level-item">
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
                  <span className={`home-dash__level-code home-dash__level-code--${info.color}`}>
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
          })}
        </div>
      </div>
    </div>
  );
};
