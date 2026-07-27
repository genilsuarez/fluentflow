import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  ListOrdered,
  RefreshCw,
  Puzzle,
  AlertTriangle,
  Headphones,
  Mic,
  Volume2,
} from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../utils/i18n';
import { getLevelColor } from '../../utils/progressionDisplay';
import type { Category, LearningMode } from '../../types';

type FilterTab = 'category' | 'mode' | 'level';
type Level = 'a1' | 'a2' | 'b1' | 'b2' | 'c1' | 'c2';

const ALL_CATEGORIES: Category[] = [
  'Vocabulary',
  'Grammar',
  'PhrasalVerbs',
  'Idioms',
  'Reading',
  'Review',
];
const CATEGORY_EMOJIS: Record<Category, string> = {
  Vocabulary: '📚',
  Grammar: '📝',
  PhrasalVerbs: '🔗',
  Idioms: '💭',
  Reading: '📖',
  Review: '🔄',
};
const CATEGORY_I18N_KEYS: Record<Category, string> = {
  Vocabulary: 'categories.vocabulary',
  Grammar: 'categories.grammar',
  PhrasalVerbs: 'categories.phrasalverbs',
  Idioms: 'categories.idioms',
  Reading: 'categories.reading',
  Review: 'categories.review',
};

const ALL_MODES: LearningMode[] = [
  'flashcard',
  'quiz',
  'completion',
  'sorting',
  'matching',
  'reading',
  'reordering',
  'transformation',
  'word-formation',
  'error-correction',
  'listening-quiz',
  'dictation',
  'listen-complete',
];
const MODE_ICONS: Record<LearningMode, React.ReactElement> = {
  flashcard: <CreditCard size={13} strokeWidth={2} />,
  quiz: <HelpCircle size={13} strokeWidth={2} />,
  completion: <PenTool size={13} strokeWidth={2} />,
  sorting: <BarChart3 size={13} strokeWidth={2} />,
  matching: <Link size={13} strokeWidth={2} />,
  reading: <BookOpen size={13} strokeWidth={2} />,
  reordering: <ListOrdered size={13} strokeWidth={2} />,
  transformation: <RefreshCw size={13} strokeWidth={2} />,
  'word-formation': <Puzzle size={13} strokeWidth={2} />,
  'error-correction': <AlertTriangle size={13} strokeWidth={2} />,
  'listening-quiz': <Headphones size={13} strokeWidth={2} />,
  dictation: <Mic size={13} strokeWidth={2} />,
  'listen-complete': <Volume2 size={13} strokeWidth={2} />,
};
const MODE_I18N_KEYS: Record<LearningMode, string> = {
  flashcard: 'learning.flashcardMode',
  quiz: 'learning.quizMode',
  completion: 'learning.completionMode',
  sorting: 'learning.sortingMode',
  matching: 'learning.matchingMode',
  reading: 'learning.readingMode',
  reordering: 'learning.reorderingMode',
  transformation: 'learning.transformationMode',
  'word-formation': 'learning.wordFormationMode',
  'error-correction': 'learning.errorCorrectionMode',
  'listening-quiz': 'learning.listeningQuizMode',
  dictation: 'learning.dictationMode',
  'listen-complete': 'learning.listenCompleteMode',
};

const ALL_LEVELS: Level[] = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'];

interface UnifiedFilterProps {
  isOpen?: boolean;
  onToggle?: () => void;
}

export const UnifiedFilter: React.FC<UnifiedFilterProps> = ({
  isOpen: controlledOpen,
  onToggle,
}) => {
  const {
    categories,
    setCategories,
    learningModes = [] as string[],
    setLearningModes,
    level,
    setLevel,
    language,
  } = useSettingsStore();
  const { t } = useTranslation(language);
  const [internalOpen, setInternalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('category');
  const [isMobileSheet, setIsMobileSheet] = useState(false);
  const [desktopAnchor, setDesktopAnchor] = useState<{ top: number; right: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const isOpen = controlledOpen ?? internalOpen;
  const handleToggle = React.useCallback(() => {
    if (onToggle) {
      onToggle();
    } else {
      setInternalOpen(prev => !prev);
    }
  }, [onToggle]);

  const activeFilterCount = categories.length + learningModes.length + (level !== 'all' ? 1 : 0);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const update = () => setIsMobileSheet(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const updateDesktopAnchor = React.useCallback(() => {
    const btn = toggleRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setDesktopAnchor({
      top: rect.bottom + 6,
      right: Math.max(12, window.innerWidth - rect.right),
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    document.body.classList.add('lp-filter-open');
    return () => document.body.classList.remove('lp-filter-open');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !isMobileSheet) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, isMobileSheet]);

  useEffect(() => {
    if (!isOpen || isMobileSheet) {
      setDesktopAnchor(null);
      return;
    }
    updateDesktopAnchor();
    window.addEventListener('resize', updateDesktopAnchor);
    window.addEventListener('scroll', updateDesktopAnchor, true);
    return () => {
      window.removeEventListener('resize', updateDesktopAnchor);
      window.removeEventListener('scroll', updateDesktopAnchor, true);
    };
  }, [isOpen, isMobileSheet, updateDesktopAnchor]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleToggle();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, handleToggle]);

  // Close on outside click (desktop dropdown only — mobile uses backdrop)
  useEffect(() => {
    if (!isOpen || isMobileSheet) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        const btn = (e.target as Element).closest('.unified-filter__toggle-btn');
        if (!btn) handleToggle();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, isMobileSheet, handleToggle]);

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
    {
      key: 'category',
      icon: <Tags size={14} />,
      label: isMobileSheet ? t('categoryFilter.titleShort') : t('categoryFilter.title'),
      count: categories.length,
    },
    {
      key: 'mode',
      icon: <Layers size={14} />,
      label: isMobileSheet ? t('modeFilter.titleShort') : t('modeFilter.title'),
      count: learningModes.length,
    },
    {
      key: 'level',
      icon: <GraduationCap size={14} />,
      label: isMobileSheet ? t('levelFilter.titleShort') : t('levelFilter.title'),
      count: level !== 'all' ? 1 : 0,
    },
  ];

  const panel = (
    <div
      className={`unified-filter__panel${isMobileSheet ? ' unified-filter__panel--sheet' : ' unified-filter__panel--anchored'}`}
      ref={panelRef}
      role="dialog"
      aria-label="Filters"
      style={
        !isMobileSheet && desktopAnchor
          ? ({
              '--filter-anchor-top': `${desktopAnchor.top}px`,
              '--filter-anchor-right': `${desktopAnchor.right}px`,
            } as React.CSSProperties)
          : undefined
      }
    >
      {isMobileSheet && <div className="unified-filter__handle" aria-hidden="true" />}
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
              {tab.count > 0 && <span className="unified-filter__tab-count">{tab.count}</span>}
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
          <div className="unified-filter__chips unified-filter__chips--balanced">
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
          <div className="unified-filter__chips unified-filter__chips--modes">
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
          <div className="unified-filter__chips unified-filter__chips--balanced">
            {ALL_LEVELS.map(lvl => {
              const isActive = level === lvl;
              return (
                <button
                  key={lvl}
                  className={`unified-filter__chip unified-filter__chip--level${isActive ? ' unified-filter__chip--active' : ''}`}
                  onClick={() => handleSelectLevel(lvl)}
                  aria-pressed={isActive}
                  type="button"
                  style={{ '--level-color': getLevelColor(lvl) } as React.CSSProperties}
                >
                  <span className="unified-filter__chip-dot" aria-hidden="true" />
                  <span className="unified-filter__chip-label">{lvl.toUpperCase()}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="unified-filter">
      <button
        ref={toggleRef}
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

      {isOpen &&
        createPortal(
          <div className="unified-filter__overlay-root">
            {isMobileSheet && (
              <button
                type="button"
                className="unified-filter__backdrop"
                onClick={handleToggle}
                aria-label={t('levelFilter.collapse')}
              />
            )}
            {panel}
          </div>,
          document.body
        )}
    </div>
  );
};
