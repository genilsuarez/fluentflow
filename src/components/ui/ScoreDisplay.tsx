import React from 'react';
import { Trophy } from 'lucide-react';
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
      className={`score-display-compact ${isInGame ? 'score-display-compact--learning' : 'score-display-compact--menu'}`}
      role="status"
      aria-live="polite"
      aria-label={
        isInGame
          ? `Session score: ${sessionScore.correct} correct, ${sessionScore.incorrect} incorrect, ${sessionScore.accuracy.toFixed(0)}% accuracy`
          : `Total score: ${totalScore} points. Progress: ${completedModules} of ${totalModules} modules completed`
      }
    >
      <div
        className={`score-display-compact__container ${isInGame ? 'score-display-compact__container--in-game' : 'score-display-compact__container--full'}`}
      >
        {isInGame ? (
          <div className="score-display-compact__session">
            <div
              className="score-display-compact__icon"
              role="img"
              aria-label={t('scores.sessionScore')}
            >
              🎯
            </div>
            <div className="score-display-compact__values">
              <span
                className="score-display-compact__correct"
                aria-label={`${sessionScore.correct} correct answers`}
              >
                {sessionScore.correct}
              </span>
              <span className="score-display-compact__separator" aria-hidden="true">
                /
              </span>
              <span
                className="score-display-compact__incorrect"
                aria-label={`${sessionScore.incorrect} incorrect answers`}
              >
                {sessionScore.incorrect}
              </span>
            </div>
            <div
              className="score-display-compact__accuracy min-width-sm"
              aria-label={`${sessionScore.accuracy.toFixed(0)} percent accuracy`}
            >
              {sessionScore.total > 0 ? `${sessionScore.accuracy.toFixed(0)}%` : '0%'}
            </div>
          </div>
        ) : (
          <div className="score-display-compact__global">
            <div className="score-display-compact__main">
              <div
                className="score-display-compact__icon score-display-compact__icon--trophy"
                role="img"
                aria-label={t('scores.globalScore')}
              >
                <Trophy size={16} aria-hidden="true" />
              </div>
              <span
                className="score-display-compact__total-score"
                aria-label={`${totalScore} total score points`}
              >
                {totalScore}
              </span>
            </div>

            {/* Module completion progress */}
            <div className="score-display-compact__divider" aria-hidden="true" />
            <div className="score-display-compact__progress">
              <span className="score-display-compact__progress-label">
                {completedModules}/{totalModules}
              </span>
              <div
                className="score-display-compact__progress-bar"
                role="progressbar"
                aria-valuenow={completionPercentage}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${completionPercentage}% modules completed, ${completedModules} of ${totalModules}`}
              >
                <div
                  className="score-display-compact__progress-fill"
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
