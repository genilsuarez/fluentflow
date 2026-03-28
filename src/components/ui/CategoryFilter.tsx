import React, { useState } from 'react';
import { Tags, X } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../utils/i18n';
import type { Category } from '../../types';
import '../../styles/components/category-filter.css';

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

interface CategoryFilterProps {
  inline?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  inline = false,
  isExpanded: controlledExpanded,
  onToggle,
}) => {
  const { categories, setCategories, language } = useSettingsStore();
  const { t } = useTranslation(language);
  const [internalExpanded, setInternalExpanded] = useState(false);

  const isExpanded = controlledExpanded ?? internalExpanded;
  const handleToggle = onToggle ?? (() => setInternalExpanded(prev => !prev));

  const isFiltered = categories.length > 0;

  const handleToggleCategory = (category: Category) => {
    const isActive = categories.includes(category);
    let next: string[];

    if (isActive) {
      next = categories.filter(c => c !== category);
    } else {
      next = [...categories, category];
    }

    // If all selected, clear to "no filter" state
    if (next.length === ALL_CATEGORIES.length) {
      next = [];
    }

    setCategories(next);
  };

  return (
    <div className={`category-filter${inline ? ' category-filter--inline' : ''}`}>
      <button
        className={`category-filter__toggle-btn${isFiltered ? ' category-filter__toggle-btn--filtered' : ''}`}
        onClick={handleToggle}
        aria-expanded={isExpanded}
        aria-label={isExpanded ? t('categoryFilter.collapse') : t('categoryFilter.expand')}
        type="button"
      >
        <Tags aria-hidden="true" />
        {isFiltered && <span className="category-filter__badge">{categories.length}</span>}
      </button>

      <div
        className={`category-filter__panel${isExpanded ? ' category-filter__panel--open' : ''}`}
        role="group"
        aria-label={t('categoryFilter.title')}
      >
        <button
          className="category-filter__close"
          onClick={handleToggle}
          aria-label={t('categoryFilter.collapse')}
          type="button"
        >
          <X size={14} />
        </button>
        <div className="category-filter__chips">
          {ALL_CATEGORIES.map(category => {
            const isActive = categories.includes(category);
            return (
              <button
                key={category}
                className={`category-filter__chip${isActive ? ' category-filter__chip--active' : ''}`}
                onClick={() => handleToggleCategory(category)}
                aria-pressed={isActive}
                type="button"
              >
                <span className="category-filter__chip-emoji" aria-hidden="true">
                  {CATEGORY_EMOJIS[category]}
                </span>
                <span className="category-filter__chip-label">
                  {t(CATEGORY_I18N_KEYS[category])}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
