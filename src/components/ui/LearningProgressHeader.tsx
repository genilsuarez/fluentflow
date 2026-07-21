import React, { useEffect } from 'react';
import '../../styles/components/learning-progress-header.css';
import { useLearningHeaderStore } from '../../stores/learningHeaderStore';
import type { LearningMode } from '../../types';

interface LearningProgressHeaderProps {
  title: string;
  currentIndex: number;
  totalItems: number;
  mode: LearningMode;
  helpText?: string;
}

/** Syncs lesson title to app header; renders progress bar + counter inside the game shell. */
const LearningProgressHeader: React.FC<LearningProgressHeaderProps> = ({
  title,
  currentIndex,
  totalItems,
  mode,
  helpText,
}) => {
  const setProgress = useLearningHeaderStore(state => state.setProgress);
  const clearProgress = useLearningHeaderStore(state => state.clearProgress);
  const progressPercentage = totalItems > 0 ? ((currentIndex + 1) / totalItems) * 100 : 0;
  const counterLabel = totalItems > 0 ? `${currentIndex + 1}/${totalItems}` : '...';

  useEffect(() => {
    setProgress({ title, currentIndex, totalItems, mode });
    return () => clearProgress();
  }, [title, currentIndex, totalItems, mode, setProgress, clearProgress]);

  return (
    <div className="learning-progress-header">
      <div className="learning-progress-header__row">
        <div className="learning-progress-header__progress-container">
          <div
            className={`learning-progress-header__progress-fill learning-progress-header__progress-fill--${mode}`}
            style={{ '--progress-width': `${progressPercentage}%` } as React.CSSProperties}
          />
        </div>
        <span className="learning-progress-header__counter">{counterLabel}</span>
      </div>
      {helpText ? <p className="learning-progress-header__help-text">{helpText}</p> : null}
    </div>
  );
};

export default LearningProgressHeader;
