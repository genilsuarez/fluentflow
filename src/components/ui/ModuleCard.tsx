import React from 'react';
import {
  CreditCard,
  HelpCircle,
  PenTool,
  BarChart3,
  Link,
  BookOpen,
  Lock,
  LockOpen,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { useProgressStore } from '../../stores/progressStore';
import { useTranslation } from '../../utils/i18n';
import { useSettingsStore } from '../../stores/settingsStore';
import type { LearningModule } from '../../types';

export interface ModuleCardProps {
  module: LearningModule;
  onClick: (module: LearningModule) => void;
  tabIndex?: number;
  role?: string;
  'aria-posinset'?: number;
  'aria-setsize'?: number;
  isNextRecommended?: boolean;
  isCurrentModule?: boolean;
  hiddenDependencies?: string[];
  /** Pre-computed module status — avoids per-card useProgression() call */
  moduleStatus?: 'completed' | 'unlocked' | 'locked';
  /** Pre-computed missing prerequisites count */
  missingPrerequisitesCount?: number;
}

const getIcon = (learningMode: string) => {
  const iconProps = { size: 20, strokeWidth: 2 };

  const icons: Record<string, React.ReactElement> = {
    flashcard: <CreditCard {...iconProps} />,
    quiz: <HelpCircle {...iconProps} />,
    completion: <PenTool {...iconProps} />,
    sorting: <BarChart3 {...iconProps} />,
    matching: <Link {...iconProps} />,
    reading: <BookOpen {...iconProps} />,
  };
  return icons[learningMode] || <CreditCard {...iconProps} />;
};

const getLearningModeLabel = (learningMode: string, t: (key: string) => string): string => {
  const labels: Record<string, string> = {
    flashcard: t('learning.flashcardMode'),
    quiz: t('learning.quizMode'),
    completion: t('learning.completionMode'),
    sorting: t('learning.sortingMode'),
    matching: t('learning.matchingMode'),
    reading: t('learning.readingMode'),
  };
  return labels[learningMode] || t('common.exercise');
};

export const ModuleCard: React.FC<ModuleCardProps> = React.memo(({
  module,
  onClick,
  tabIndex,
  role,
  'aria-posinset': ariaPosinset,
  'aria-setsize': ariaSetsize,
  isNextRecommended = false,
  isCurrentModule = false,
  hiddenDependencies,
  moduleStatus = 'locked',
  missingPrerequisitesCount = 0,
}) => {
  const { getModuleCompletion } = useProgressStore();
  const { language } = useSettingsStore();
  const { t } = useTranslation(language);

  // Use pre-computed status from parent instead of per-card hook
  const status = moduleStatus;
  const canAccess = status !== 'locked';

  // Get progress data for this module
  const moduleCompletion = getModuleCompletion(module.id);
  const progressPercentage = moduleCompletion?.bestScore || 0;

  const difficultyLevel =
    module.level && Array.isArray(module.level) && module.level.length > 0
      ? module.level.map((l: string) => l.toUpperCase()).join('/')
      : 'B1';

  const learningModeLabel = getLearningModeLabel(module.learningMode, t);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (canAccess) {
        onClick(module);
      }
    }
  };

  const handleClick = () => {
    if (canAccess) {
      onClick(module);
    }
  };

  // Get status-specific styling and content
  const getStatusInfo = () => {
    switch (status) {
      case 'completed':
        return {
          className: 'module-card--completed',
          statusIcon: <CheckCircle size={12} className="text-white" />,
          statusText: t('common.completed'),
          disabled: false,
        };
      case 'unlocked':
        return {
          className: 'module-card--unlocked',
          statusIcon: <LockOpen size={12} className="text-white" />,
          statusText: t('common.available'),
          disabled: false,
        };
      case 'locked':
        return {
          className: 'module-card--locked',
          statusIcon: <Lock size={12} className="text-white" />,
          statusText: t('learning.requiresPrerequisites', undefined, {
            count: missingPrerequisitesCount,
            plural: missingPrerequisitesCount !== 1 ? 's' : '',
          }),
          disabled: true,
        };
      default:
        return {
          className: 'module-card--locked',
          statusIcon: <Lock size={16} className="module-card__status-icon" />,
          statusText: t('common.locked'),
          disabled: true,
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <button
      data-module-id={module.id}
      className={`module-card module-card--${module.learningMode} ${statusInfo.className} ${isNextRecommended ? 'module-card--next-recommended' : ''} ${isCurrentModule ? 'module-card--current' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={statusInfo.disabled ? -1 : tabIndex}
      role={role}
      aria-posinset={ariaPosinset}
      aria-setsize={ariaSetsize}
      aria-label={`${module.name} - ${learningModeLabel} - Difficulty level ${difficultyLevel} - ${statusInfo.statusText}`}
      title={
        statusInfo.disabled
          ? t('learning.exerciseIsLocked', undefined, {
              name: module.name,
              status: statusInfo.statusText,
            })
          : t('learning.startExercise', undefined, {
              mode: learningModeLabel.toLowerCase(),
              name: module.name,
              level: difficultyLevel,
            })
      }
      disabled={statusInfo.disabled}
      aria-disabled={statusInfo.disabled}
    >
      <div className="module-card__content">
        <div className="module-card__header">
          <div className="module-card__icon" aria-hidden="true">
            {getIcon(module.learningMode)}
          </div>
        </div>
        <h3 className="module-card__title">{module.name}</h3>
        <div className="module-card__type" aria-label={`Exercise type: ${learningModeLabel}`}>
          {learningModeLabel}
        </div>
        <div className="module-card__level" aria-label={`Difficulty level: ${difficultyLevel}`}>
          {difficultyLevel}
        </div>
        <div
          className="module-card__time"
          aria-label={`Estimated time: ${module.estimatedTime || 5} minutes`}
        >
          {module.estimatedTime || 5}min
        </div>

        {/* Status indicators - Consistent positioning for all states */}
        {statusInfo.statusIcon && (
          <div
            className={`module-card__status-indicator module-card__status-indicator--${status}`}
            aria-hidden="true"
          >
            {statusInfo.statusIcon}
          </div>
        )}

        {/* Dependency warning for hidden prerequisites */}
        {hiddenDependencies && hiddenDependencies.length > 0 && (
          <div
            className="module-card__dependency-warning"
            title={t('categoryFilter.dependencyWarning', undefined, {
              categories: hiddenDependencies.join(', '),
            })}
            aria-label={t('categoryFilter.dependencyWarning', undefined, {
              categories: hiddenDependencies.join(', '),
            })}
          >
            <AlertTriangle size={14} />
          </div>
        )}

        {/* Progress indicator for unlocked/completed modules */}
        {(status === 'unlocked' || status === 'completed') &&
          progressPercentage > 0 && (
            <div className="module-card__progress" aria-hidden="true">
              <div
                className="module-card__progress-bar"
                style={{ '--progress-width': `${progressPercentage}%` } as React.CSSProperties}
              />
            </div>
          )}
      </div>
    </button>
  );
});
