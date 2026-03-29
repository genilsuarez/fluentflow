import React, { useState } from 'react';
import {
  X,
  Trophy,
  Target,
  Clock,
  TrendingUp,
  BarChart3,
  CheckCircle,
  Star,
  MapPin,
} from 'lucide-react';
import { useProgressStore } from '../../stores/progressStore';
import { useUserStore } from '../../stores/userStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../utils/i18n';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useProgression } from '../../hooks/useProgression';
import '../../styles/components/compact-my-progress.css';
import '../../styles/components/modal-buttons.css';

interface CompactMyProgressProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'dashboard' | 'path';
}

export const CompactMyProgress: React.FC<CompactMyProgressProps> = ({
  isOpen,
  onClose,
  initialTab = 'dashboard',
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'path'>(initialTab);
  const { getProgressData, getWeeklyAverage } = useProgressStore();
  const { userScores, getTotalScore } = useUserStore();
  const { language } = useSettingsStore();
  const { t } = useTranslation(language);
  const progression = useProgression();

  useEscapeKey(isOpen, onClose);

  if (!isOpen) return null;

  // Dashboard data
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

  // Learning path data
  const { stats } = progression;
  const nextRecommended = progression.getNextRecommendedModule();

  const unitInfo = {
    1: { name: 'Foundation', shortName: 'Found', code: 'A1', color: 'emerald' },
    2: { name: 'Elementary', shortName: 'Elem', code: 'A2', color: 'blue' },
    3: { name: 'Intermediate', shortName: 'Inter', code: 'B1', color: 'purple' },
    4: { name: 'Upper-Intermediate', shortName: 'Upper', code: 'B2', color: 'orange' },
    5: { name: 'Advanced', shortName: 'Adv', code: 'C1', color: 'red' },
    6: { name: 'Mastery', shortName: 'Mast', code: 'C2', color: 'indigo' },
  };

  return (
    <div className="my-progress">
      <div className="my-progress__container">
        <div className="my-progress__header">
          <div className="my-progress__title-section">
            <BarChart3 className="my-progress__icon" />
            <h2 className="my-progress__title">{t('modals.myProgress', 'Mi Progreso')}</h2>
          </div>
          <button onClick={onClose} className="modal__close-btn" aria-label={t('common.close')}>
            <X className="modal__close-icon" />
          </button>
        </div>

        {/* Tabs */}
        <div className="my-progress__tabs" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'dashboard'}
            className={`my-progress__tab${activeTab === 'dashboard' ? ' my-progress__tab--active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <BarChart3 className="my-progress__tab-icon" />
            <span>{t('modals.progressDashboard', 'Dashboard')}</span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'path'}
            className={`my-progress__tab${activeTab === 'path' ? ' my-progress__tab--active' : ''}`}
            onClick={() => setActiveTab('path')}
          >
            <MapPin className="my-progress__tab-icon" />
            <span>{t('modals.learningPath', 'Learning Path')}</span>
          </button>
        </div>

        <div className="my-progress__content" role="tabpanel">
          {activeTab === 'dashboard' ? (
            <DashboardTab
              totalScore={totalScore}
              avgScore={avgScore}
              totalSessions={totalSessions}
              totalTimeSpent={totalTimeSpent}
              progressData={progressData}
              language={language}
              t={t}
            />
          ) : (
            <PathTab stats={stats} nextRecommended={nextRecommended} unitInfo={unitInfo} t={t} />
          )}

          <div className="modal__actions modal__actions--single">
            <button onClick={onClose} className="modal__btn modal__btn--primary">
              {t('common.continue', 'Continuar Aprendiendo')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Dashboard Tab ── */
interface DashboardTabProps {
  totalScore: number;
  avgScore: number;
  totalSessions: number;
  totalTimeSpent: number;
  progressData: { date: string; sessionsCount: number; timeSpent: number; averageScore: number }[];
  language: string;
  t: (key: string, fallback?: string) => string;
}

const DashboardTab: React.FC<DashboardTabProps> = ({
  totalScore,
  avgScore,
  totalSessions,
  totalTimeSpent,
  progressData,
  language,
  t,
}) => (
  <>
    <div className="my-progress__stats">
      <div className="my-progress__stat my-progress__stat--points">
        <Trophy className="my-progress__stat-icon" />
        <div className="my-progress__stat-content">
          <span className="my-progress__stat-value">{totalScore.toLocaleString()}</span>
          <span className="my-progress__stat-label">
            {t('dashboard.totalScore', 'Points earned')}
          </span>
        </div>
      </div>
      <div className="my-progress__stat my-progress__stat--accuracy">
        <Target className="my-progress__stat-icon" />
        <div className="my-progress__stat-content">
          <span className="my-progress__stat-value">{avgScore}%</span>
          <span className="my-progress__stat-label">
            {t('dashboard.learningAccuracy', 'Accuracy')}
          </span>
        </div>
      </div>
      <div className="my-progress__stat my-progress__stat--sessions">
        <Clock className="my-progress__stat-icon" />
        <div className="my-progress__stat-content">
          <span className="my-progress__stat-value">{totalSessions}</span>
          <span className="my-progress__stat-label">
            {t('dashboard.studySessions', 'Sessions')}
          </span>
        </div>
      </div>
      <div className="my-progress__stat my-progress__stat--time">
        <TrendingUp className="my-progress__stat-icon" />
        <div className="my-progress__stat-content">
          <span className="my-progress__stat-value">{Math.round(totalTimeSpent / 60)}</span>
          <span className="my-progress__stat-label">
            {t('dashboard.timeSpent', 'Time practiced')}
          </span>
        </div>
      </div>
    </div>

    <div className="my-progress__weekly">
      <h3 className="my-progress__section-title">
        {t('dashboard.weeklyProgress', 'Progreso Semanal')}
      </h3>
      <div className="my-progress__weekly-content">
        {progressData.length === 0 ? (
          <div className="my-progress__no-data">
            <TrendingUp className="my-progress__no-data-icon" />
            <p className="my-progress__no-data-text">{t('dashboard.completeModulesMessage')}</p>
          </div>
        ) : (
          <div className="my-progress__weekly-bars">
            {progressData.slice(-5).map((day, index) => {
              const date = new Date(day.date);
              const dayName = date.toLocaleDateString(language, { weekday: 'short' });
              return (
                <div key={index} className="my-progress__weekly-day">
                  <div className="my-progress__weekly-bar">
                    <div
                      className="my-progress__weekly-fill"
                      style={
                        {
                          '--bar-h': `${Math.max(day.averageScore || 0, 5)}%`,
                        } as React.CSSProperties
                      }
                    />
                  </div>
                  <span className="my-progress__weekly-day-label">{dayName}</span>
                  <span className="my-progress__weekly-day-value">{day.averageScore || 0}%</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  </>
);

/* ── Path Tab ── */
interface PathTabProps {
  stats: {
    completionPercentage: number;
    completedModules: number;
    totalModules: number;
    unitStats: { unit: number; completed: number; total: number; percentage: number }[];
  };
  nextRecommended: { unit: number; learningMode: string; name: string } | null;
  unitInfo: Record<number, { name: string; shortName: string; code: string; color: string }>;
  t: (key: string, fallback?: string) => string;
}

const PathTab: React.FC<PathTabProps> = ({ stats, nextRecommended, unitInfo, t }) => (
  <>
    {/* Overview */}
    <div className="my-progress__overview">
      <div className="my-progress__overview-stat">
        <span className="my-progress__overview-emoji">📊</span>
        <span className="my-progress__overview-value">{stats.completionPercentage}%</span>
        <span className="my-progress__overview-label">
          {t('learningPath.complete', 'Complete')}
        </span>
      </div>
      <div className="my-progress__overview-stat">
        <CheckCircle className="my-progress__overview-icon my-progress__overview-icon--completed" />
        <span className="my-progress__overview-value">
          {stats.completedModules} / {stats.totalModules}
        </span>
        <span className="my-progress__overview-label">
          {t('learningPath.completed', 'Completed')}
        </span>
      </div>
    </div>

    {/* Next Recommended */}
    {nextRecommended && (
      <div className="my-progress__next">
        <Star className="my-progress__next-star" />
        <span className="my-progress__next-label">{t('learningPath.nextRecommended', 'Next')}</span>
        <span
          className={`my-progress__next-level my-progress__next-level--${unitInfo[nextRecommended.unit as keyof typeof unitInfo]?.color}`}
        >
          {unitInfo[nextRecommended.unit as keyof typeof unitInfo]?.code}
        </span>
        <span className="my-progress__next-type">{nextRecommended.learningMode}</span>
        <span className="my-progress__next-name">{nextRecommended.name}</span>
      </div>
    )}

    {/* Unit Progress Circles */}
    <div className="my-progress__units">
      <h3 className="my-progress__section-title">
        {t('learningPath.unitProgress', 'Progreso por Nivel')}
      </h3>
      <div className="my-progress__unit-grid">
        {stats.unitStats.map(unitStat => {
          const info = unitInfo[unitStat.unit as keyof typeof unitInfo];
          return (
            <div key={unitStat.unit} className="my-progress__unit-item">
              <div className="my-progress__unit-circle">
                <svg className="my-progress__unit-svg" viewBox="0 0 36 36">
                  <path
                    className="my-progress__unit-bg"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={`my-progress__unit-fill my-progress__unit-fill--${info?.color}`}
                    strokeDasharray={`${unitStat.percentage}, 100`}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="my-progress__unit-center">
                  <span className={`my-progress__unit-code my-progress__unit-code--${info?.color}`}>
                    {info?.code}
                  </span>
                  <span className="my-progress__unit-pct">{unitStat.percentage}%</span>
                </div>
              </div>
              <div className="my-progress__unit-label">
                <span className="my-progress__unit-name" title={info?.name}>
                  {info?.shortName}
                </span>
                <span className="my-progress__unit-count">
                  {unitStat.completed}/{unitStat.total}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </>
);
