import React, { useState } from 'react';
import {
  Layers,
  CreditCard,
  HelpCircle,
  PenTool,
  BarChart3,
  Link,
  BookOpen,
  X,
} from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../utils/i18n';
import type { LearningMode } from '../../types';
import '../../styles/components/mode-filter.css';

const ALL_MODES: LearningMode[] = [
  'flashcard',
  'quiz',
  'completion',
  'sorting',
  'matching',
  'reading',
];

const MODE_ICONS: Record<LearningMode, React.ReactElement> = {
  flashcard: <CreditCard size={13} strokeWidth={2} />,
  quiz: <HelpCircle size={13} strokeWidth={2} />,
  completion: <PenTool size={13} strokeWidth={2} />,
  sorting: <BarChart3 size={13} strokeWidth={2} />,
  matching: <Link size={13} strokeWidth={2} />,
  reading: <BookOpen size={13} strokeWidth={2} />,
};

const MODE_I18N_KEYS: Record<LearningMode, string> = {
  flashcard: 'learning.flashcardMode',
  quiz: 'learning.quizMode',
  completion: 'learning.completionMode',
  sorting: 'learning.sortingMode',
  matching: 'learning.matchingMode',
  reading: 'learning.readingMode',
};

interface ModeFilterProps {
  inline?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
}

export const ModeFilter: React.FC<ModeFilterProps> = ({
  inline = false,
  isExpanded: controlledExpanded,
  onToggle,
}) => {
  const { learningModes = ALL_MODES as string[], setLearningModes, language } = useSettingsStore();
  const { t } = useTranslation(language);
  const [internalExpanded, setInternalExpanded] = useState(false);

  const isExpanded = controlledExpanded ?? internalExpanded;
  const handleToggle = onToggle ?? (() => setInternalExpanded(prev => !prev));

  const isFiltered = learningModes.length > 0;

  const handleToggleMode = (mode: LearningMode) => {
    const isActive = learningModes.includes(mode);
    let next: string[];

    if (isActive) {
      next = learningModes.filter(m => m !== mode);
    } else {
      next = [...learningModes, mode];
    }

    // If all selected, clear to "no filter" state
    if (next.length === ALL_MODES.length) {
      next = [];
    }

    setLearningModes(next);
  };

  return (
    <div className={`mode-filter${inline ? ' mode-filter--inline' : ''}`}>
      <button
        className={`mode-filter__toggle-btn${isFiltered ? ' mode-filter__toggle-btn--filtered' : ''}`}
        onClick={handleToggle}
        aria-expanded={isExpanded}
        aria-label={isExpanded ? t('modeFilter.collapse') : t('modeFilter.expand')}
        type="button"
      >
        <Layers aria-hidden="true" />
        {isFiltered && <span className="mode-filter__badge">{learningModes.length}</span>}
      </button>

      <div
        className={`mode-filter__panel${isExpanded ? ' mode-filter__panel--open' : ''}`}
        role="group"
        aria-label={t('modeFilter.title')}
      >
        <button
          className="mode-filter__close"
          onClick={handleToggle}
          aria-label={t('modeFilter.collapse')}
          type="button"
        >
          <X size={14} />
        </button>
        <div className="mode-filter__chips">
          {ALL_MODES.map(mode => {
            const isActive = learningModes.includes(mode);
            return (
              <button
                key={mode}
                className={`mode-filter__chip${isActive ? ' mode-filter__chip--active' : ''}`}
                onClick={() => handleToggleMode(mode)}
                aria-pressed={isActive}
                type="button"
              >
                <span className="mode-filter__chip-icon" aria-hidden="true">
                  {MODE_ICONS[mode]}
                </span>
                <span className="mode-filter__chip-label">{t(MODE_I18N_KEYS[mode])}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
