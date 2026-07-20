import React from 'react';
import { Trophy, Target } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useUserStore } from '../../stores/userStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useProgression } from '../../hooks/useProgression';
import { useTranslation } from '../../utils/i18n';
import '../../styles/components/score-display.css';

export const ScoreDisplay: React.FC = () => {
  const sessionScore = useAppStore(state => state.sessionScore);
  const currentView = useAppStore(state => state.currentView);
  const { getTotalScore } = useUserStore();
  const { language } = useSettingsStore();
  const { t } = useTranslation(language);
  const { stats } = useProgression();

  const isInGame = currentView !== 'menu';
  const { completedModules, totalModules, completionPercentage } = stats;
  const progressWidth = totalModules > 0 ? (completedModules / totalModules) * 100 : 0;
  const totalScore = getTotalScore();

  return (
    <div
      className={`lp-header-stats ${isInGame ? 'lp-header-stats--learning' : 'lp-header-stats--menu'}`}
      role="status"
      aria-live="polite"
      aria-label={
        isInGame
          ? `Session score: ${sessionScore.correct} correct, ${sessionScore.incorrect} incorrect, ${sessionScore.accuracy.toFixed(0)}% accuracy`
          : `Total score: ${totalScore} points. Progress: ${completedModules} of ${totalModules} exercises completed`
      }
    >
      <div
        className={`lp-header-stats__container ${isInGame ? 'lp-header-stats__container--in-game' : 'lp-header-stats__container--full'}`}
      >
        {isInGame ? (
          <div className="lp-header-stats__session">
            <div
              className="lp-header-stats__icon lp-header-stats__icon--target"
              role="img"
              aria-label={t('scores.sessionScore')}
            >
              <Target size={16} aria-hidden="true" />
            </div>
            <div className="lp-header-stats__values">
              <span
                className="lp-header-stats__correct"
                aria-label={`${sessionScore.correct} correct answers`}
              >
                {sessionScore.correct}
              </span>
              <span className="lp-header-stats__separator" aria-hidden="true">
                /
              </span>
              <span
                className="lp-header-stats__incorrect"
                aria-label={`${sessionScore.incorrect} incorrect answers`}
              >
                {sessionScore.incorrect}
              </span>
            </div>
            <div
              className="lp-header-stats__accuracy min-width-sm"
              aria-label={`${sessionScore.accuracy.toFixed(0)} percent accuracy`}
            >
              {sessionScore.total > 0 ? `${sessionScore.accuracy.toFixed(0)}%` : '0%'}
            </div>
          </div>
        ) : (
          <div className="lp-header-stats__global">
            <div className="lp-header-stats__main">
              <div
                className="lp-header-stats__icon lp-header-stats__icon--trophy"
                role="img"
                aria-label={t('scores.globalScore')}
              >
                <Trophy size={16} aria-hidden="true" />
              </div>
              <span
                className="lp-header-stats__total-score"
                aria-label={`${totalScore} total score points`}
              >
                {totalScore}
              </span>
            </div>

            {/* Module completion progress */}
            <div className="lp-header-stats__divider" aria-hidden="true" />
            <div className="lp-header-stats__progress">
              <span className="lp-header-stats__progress-label">
                {completedModules}/{totalModules}
              </span>
              <div
                className="lp-header-stats__progress-bar"
                role="progressbar"
                aria-valuenow={completionPercentage}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${completionPercentage}% exercises completed, ${completedModules} of ${totalModules}`}
              >
                <div
                  className="lp-header-stats__progress-fill"
                  style={{ '--progress-width': `${progressWidth}%` } as React.CSSProperties}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
