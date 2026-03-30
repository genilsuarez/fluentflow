import React, { useState } from 'react';
import { GraduationCap, X } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../utils/i18n';
import '../../styles/components/level-filter.css';

type Level = 'a1' | 'a2' | 'b1' | 'b2' | 'c1' | 'c2';

const ALL_LEVELS: Level[] = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'];

const LEVEL_COLORS: Record<Level, string> = {
  a1: '#22c55e',
  a2: '#eab308',
  b1: '#f97316',
  b2: '#ef4444',
  c1: '#a855f7',
  c2: '#374151',
};

const LEVEL_EMOJIS: Record<Level, string> = {
  a1: '🟢',
  a2: '🟡',
  b1: '🟠',
  b2: '🔴',
  c1: '🟣',
  c2: '⚫',
};

interface LevelFilterProps {
  inline?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
}

export const LevelFilter: React.FC<LevelFilterProps> = ({
  inline = false,
  isExpanded: controlledExpanded,
  onToggle,
}) => {
  const { level, setLevel, language } = useSettingsStore();
  const { t } = useTranslation(language);
  const [internalExpanded, setInternalExpanded] = useState(false);

  const isExpanded = controlledExpanded ?? internalExpanded;
  const handleToggle = onToggle ?? (() => setInternalExpanded(prev => !prev));

  const isFiltered = level !== 'all';

  const handleSelectLevel = (selected: Level) => {
    if (level === selected) {
      setLevel('all');
    } else {
      setLevel(selected);
    }
  };

  return (
    <div className={`level-filter${inline ? ' level-filter--inline' : ''}`}>
      <button
        className={`level-filter__toggle-btn${isFiltered ? ' level-filter__toggle-btn--filtered' : ''}`}
        onClick={handleToggle}
        aria-expanded={isExpanded}
        aria-label={isExpanded ? t('levelFilter.collapse') : t('levelFilter.expand')}
        type="button"
      >
        <GraduationCap aria-hidden="true" />
        {isFiltered && (
          <span className="level-filter__badge">{level.toUpperCase()}</span>
        )}
      </button>

      <div
        className={`level-filter__panel${isExpanded ? ' level-filter__panel--open' : ''}`}
        role="group"
        aria-label={t('levelFilter.title')}
      >
        <button
          className="level-filter__close"
          onClick={handleToggle}
          aria-label={t('levelFilter.collapse')}
          type="button"
        >
          <X size={14} />
        </button>
        <div className="level-filter__chips">
          {ALL_LEVELS.map(lvl => {
            const isActive = level === lvl;
            return (
              <button
                key={lvl}
                className={`level-filter__chip${isActive ? ' level-filter__chip--active' : ''}`}
                onClick={() => handleSelectLevel(lvl)}
                aria-pressed={isActive}
                type="button"
                style={isActive ? { '--level-color': LEVEL_COLORS[lvl] } as React.CSSProperties : undefined}
              >
                <span className="level-filter__chip-emoji" aria-hidden="true">
                  {LEVEL_EMOJIS[lvl]}
                </span>
                <span className="level-filter__chip-label">{lvl.toUpperCase()}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
