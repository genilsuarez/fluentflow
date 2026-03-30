import React, { useState, useEffect, useRef } from 'react';
import {
  SlidersHorizontal,
  X,
  Tags,
  Layers,
  GraduationCap,
  CreditCard,
  HelpCircle,
  PenTool,
  BarChart3,
  Link,
  BookOpen,
} from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../utils/i18n';
import type { Category, LearningMode } from '../../types';
import '../../styles/components/unified-filter.css';

type FilterTab = 'category' | 'mode' | 'level';
type Level = 'a1' | 'a2' | 'b1' | 'b2' | 'c1' | 'c2';

const ALL_CATEGORIES: Category[] = [
  'Vocabulary', 'Grammar', 'PhrasalVerbs', 'Idioms', 'Reading', 'Review',
];
const CATEGORY_EMOJIS: Record<Category, string> = {
  Vocabulary: '📚', Grammar: '📝', PhrasalVerbs: '🔗', Idioms: '💭', Reading: '📖', Review: '🔄',
};
const CATEGORY_I18N_KEYS: Record<Category, string> = {
  Vocabulary: 'categories.vocabulary', Grammar: 'categories.grammar',
  PhrasalVerbs: 'categories.phrasalverbs', Idioms: 'categories.idioms',
  Reading: 'categories.reading', Review: 'categories.review',
};

const ALL_MODES: LearningMode[] = [
  'flashcard', 'quiz', 'completion', 'sorting', 'matching', 'reading',
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
  flashcard: 'learning.flashcardMode', quiz: 'learning.quizMode',
  completion: 'learning.completionMode', sorting: 'learning.sortingMode',
  matching: 'learning.matchingMode', reading: 'learning.readingMode',
};

const ALL_LEVELS: Level[] = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'];
const LEVEL_COLORS: Record<Level, string> = {
  a1: '#22c55e', a2: '#eab308', b1: '#f97316', b2: '#ef4444', c1: '#a855f7', c2: '#374151',
};
const LEVEL_EMOJIS: Record<Level, string> = {
  a1: '🟢', a2: '🟡', b1: '🟠', b2: '🔴', c1: '🟣', c2: '⚫',
};

interface UnifiedFilterProps {
  isOpen?: boolean;
  onToggle?: () => void;
}

export const UnifiedFilter: React.FC<UnifiedFilterProps> = ({
  isOpen: controlledOpen,
  onToggle,
}) => {
  const {
    categories, setCategories,
    learningModes = [] as string[], setLearningModes,
    level, setLevel, language,
  } = useSettingsStore();
  const { t } = useTranslation(language);
  const [internalOpen, setInternalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('category');
  const panelRef = useRef<HTMLDivElement>(null);

  const isOpen = controlledOpen ?? internalOpen;
  const handleToggle = onToggle ?? (() => setInternalOpen(prev => !prev));

  const activeFilterCount =
    categories.length + learningModes.length + (level !== 'all' ? 1 : 0);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        const btn = (e.target as Element).closest('.unified-filter__toggle-btn');
        if (!btn) handleToggle();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, handleToggle]);

  const handleToggleCategory = (category: Category) => {
    const isActive = categories.includes(category);
    let next = isActive ? categories.filter(c => c !== category) : [...categories, category];
    if (next.length === ALL_CATEGORIES.length) next = [];
    setCategories(next);
  };

  const handleToggleMode = (mode: LearningMode) => {
    const isActive = learningModes.includes(mode);
    let next = isActive ? learningModes.filter(m => m !== mode) : [...learningModes, mode];
    if (next.length === ALL_MODES.length) next = [];
    setLearningModes(next);
  };

  const handleSelectLevel = (selected: Level) => {
    setLevel(level === selected ? 'all' : selected);
  };

  const tabs: { key: FilterTab; icon: React.ReactElement; label: string; count: number }[] = [
    { key: 'category', icon: <Tags size={14} />, label: t('categoryFilter.title'), count: categories.length },
    { key: 'mode', icon: <Layers size={14} />, label: t('modeFilter.title'), count: learningModes.length },
    { key: 'level', icon: <GraduationCap size={14} />, label: t('levelFilter.title'), count: level !== 'all' ? 1 : 0 },
  ];

  return (
    <div className="unified-filter">
      <button
        className={`unified-filter__toggle-btn${activeFilterCount > 0 ? ' unified-filter__toggle-btn--active' : ''}`}
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-label={isOpen ? t('levelFilter.collapse') : t('categoryFilter.expand')}
        type="button"
      >
        <SlidersHorizontal aria-hidden="true" />
        {activeFilterCount > 0 && (
          <span className="unified-filter__badge">{activeFilterCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="unified-filter__panel" ref={panelRef} role="dialog" aria-label="Filters">
          <div className="unified-filter__header">
            <div className="unified-filter__tabs" role="tablist">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  className={`unified-filter__tab${activeTab === tab.key ? ' unified-filter__tab--active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  type="button"
                >
                  {tab.icon}
                  <span className="unified-filter__tab-label">{tab.label}</span>
                  {tab.count > 0 && (
                    <span className="unified-filter__tab-count">{tab.count}</span>
                  )}
                </button>
              ))}
            </div>
            <button
              className="unified-filter__close"
              onClick={handleToggle}
              aria-label="Close filters"
              type="button"
            >
              <X size={16} />
            </button>
          </div>

          <div className="unified-filter__content" role="tabpanel">
            {activeTab === 'category' && (
              <div className="unified-filter__chips">
                {ALL_CATEGORIES.map(category => {
                  const isActive = categories.includes(category);
                  return (
                    <button
                      key={category}
                      className={`unified-filter__chip${isActive ? ' unified-filter__chip--active' : ''}`}
                      onClick={() => handleToggleCategory(category)}
                      aria-pressed={isActive}
                      type="button"
                    >
                      <span className="unified-filter__chip-emoji" aria-hidden="true">
                        {CATEGORY_EMOJIS[category]}
                      </span>
                      <span className="unified-filter__chip-label">
                        {t(CATEGORY_I18N_KEYS[category])}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {activeTab === 'mode' && (
              <div className="unified-filter__chips">
                {ALL_MODES.map(mode => {
                  const isActive = learningModes.includes(mode);
                  return (
                    <button
                      key={mode}
                      className={`unified-filter__chip${isActive ? ' unified-filter__chip--active' : ''}`}
                      onClick={() => handleToggleMode(mode)}
                      aria-pressed={isActive}
                      type="button"
                    >
                      <span className="unified-filter__chip-icon" aria-hidden="true">
                        {MODE_ICONS[mode]}
                      </span>
                      <span className="unified-filter__chip-label">{t(MODE_I18N_KEYS[mode])}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {activeTab === 'level' && (
              <div className="unified-filter__chips">
                {ALL_LEVELS.map(lvl => {
                  const isActive = level === lvl;
                  return (
                    <button
                      key={lvl}
                      className={`unified-filter__chip unified-filter__chip--level${isActive ? ' unified-filter__chip--active' : ''}`}
                      onClick={() => handleSelectLevel(lvl)}
                      aria-pressed={isActive}
                      type="button"
                      style={isActive ? ({ '--level-color': LEVEL_COLORS[lvl] } as React.CSSProperties) : undefined}
                    >
                      <span className="unified-filter__chip-emoji" aria-hidden="true">
                        {LEVEL_EMOJIS[lvl]}
                      </span>
                      <span className="unified-filter__chip-label">{lvl.toUpperCase()}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
