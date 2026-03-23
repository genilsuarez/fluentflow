import React, { useState, useEffect } from 'react';
import { RotateCcw, Check, Info, X, Home } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useUserStore } from '../../stores/userStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useMenuNavigation } from '../../hooks/useMenuNavigation';
import { useProgressStore } from '../../stores/progressStore';
import { conditionalShuffle } from '../../utils/randomUtils';
import { useTranslation } from '../../utils/i18n';
import { useToast } from '../../hooks/useToast';
import { useLearningCleanup } from '../../hooks/useLearningCleanup';
import { ContentAdapter } from '../../utils/contentAdapter';
import ContentRenderer from '../ui/ContentRenderer';
import LearningProgressHeader from '../ui/LearningProgressHeader';

import '../../styles/components/sorting-modal.css';
import '../../styles/components/sorting-component.css';
import type { LearningModule } from '../../types';

interface SortingData {
  id: string;
  words: string[];
  categories: { name: string; items: string[] }[];
}

interface SortingComponentProps {
  module: LearningModule;
}

const SortingComponent: React.FC<SortingComponentProps> = ({ module }) => {
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [sortedItems, setSortedItems] = useState<Record<string, string[]>>({});
  const [availableWords, setAvailableWords] = useState<string[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [startTime] = useState(Date.now());
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState<any>(null);

  // Mobile touch support
  const [touchStartPos, setTouchStartPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPreview, setDragPreview] = useState<{ word: string; x: number; y: number } | null>(
    null
  );

  const updateSessionScore = useAppStore(state => state.updateSessionScore);
  const { updateUserScore } = useUserStore();
  const { language, randomizeItems } = useSettingsStore();
  const { returnToMenu } = useMenuNavigation();
  const { addProgressEntry } = useProgressStore();
  const { t } = useTranslation(language);
  const { showCorrectAnswer, showIncorrectAnswer, showModuleCompleted } = useToast();
  useLearningCleanup();

  const handleReturnToMenu = () => returnToMenu();

  const [exercise, setExercise] = useState<SortingData>({ id: '', words: [], categories: [] });

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (showExplanation) {
        if (e.key === 'Enter' || e.key === 'Escape') {
          setShowExplanation(false);
        }
      } else if (e.key === 'Escape') {
        returnToMenu();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showExplanation, returnToMenu]);

  useEffect(() => {
    let newExercise: SortingData = { id: '', words: [], categories: [] };

    if (module?.data && Array.isArray(module.data)) {
      const firstItem = module.data[0];
      if (firstItem && 'category' in firstItem && 'word' in firstItem) {
        const uniqueCategories = [...new Set(module.data.map((item: any) => item.category))];

        // Validation: Ensure we have at least 2 categories for sorting to make sense
        if (uniqueCategories.length < 2) {
          console.warn(
            `Module "${module.name}" has only ${uniqueCategories.length} category. Sorting requires at least 2 categories.`
          );
          console.warn(`Available categories:`, uniqueCategories);
          setExercise({ id: 'sorting-exercise', words: [], categories: [] });
          return;
        }

        const processedCategories = conditionalShuffle([...uniqueCategories], randomizeItems);
        const { gameSettings } = useSettingsStore.getState();
        const totalWords = gameSettings.sortingMode.wordCount;

        // Use all available categories (no artificial limit)
        const selectedCategories = processedCategories;

        // Collect all available words first
        const allAvailableWords = (module.data || []).map((item: any) => ({
          word: item.word,
          category: item.category,
        }));

        // Group words by category first
        const wordsByCategory: Record<string, string[]> = {};
        allAvailableWords.forEach(({ word, category }) => {
          if (!wordsByCategory[category]) {
            wordsByCategory[category] = [];
          }
          wordsByCategory[category].push(word);
        });

        // Ensure we select words from at least 2 categories
        const categoriesWithWords = Object.keys(wordsByCategory);
        const minWordsPerCategory = Math.max(
          1,
          Math.floor(totalWords / categoriesWithWords.length)
        );

        let selectedWords: { word: string; category: string }[] = [];

        // First, ensure each category gets at least one word
        categoriesWithWords.forEach(category => {
          const categoryWords = conditionalShuffle([...wordsByCategory[category]], randomizeItems);
          const wordsToTake = Math.min(minWordsPerCategory, categoryWords.length);
          for (let i = 0; i < wordsToTake && selectedWords.length < totalWords; i++) {
            selectedWords.push({ word: categoryWords[i], category });
          }
        });

        // If we still need more words, randomly select from remaining words
        if (selectedWords.length < totalWords) {
          const usedWords = new Set(selectedWords.map(w => w.word));
          const remainingWords = allAvailableWords.filter(w => !usedWords.has(w.word));
          const processedRemaining = conditionalShuffle([...remainingWords], randomizeItems);

          for (let i = 0; i < processedRemaining.length && selectedWords.length < totalWords; i++) {
            selectedWords.push(processedRemaining[i]);
          }
        }

        // Rebuild wordsByCategory with selected words only
        const finalWordsByCategory: Record<string, string[]> = {};
        selectedWords.forEach(({ word, category }) => {
          if (!finalWordsByCategory[category]) {
            finalWordsByCategory[category] = [];
          }
          finalWordsByCategory[category].push(word);
        });

        // Create categories array with actual selected words
        const categories = selectedCategories
          .filter((categoryId: string) => finalWordsByCategory[categoryId]) // Only include categories that have words
          .map((categoryId: string) => ({
            name: categoryId, // Use the category name directly since it's already the display name
            items: finalWordsByCategory[categoryId],
          }));

        const finalWords = selectedWords.map(item => item.word);

        // Categories already have the correct words, no need to filter again
        const updatedCategories = categories;

        newExercise = {
          id: 'sorting-exercise',
          words: finalWords,
          categories: updatedCategories,
        };
      }
    }

    setExercise(newExercise);

    if (newExercise.words?.length > 0) {
      const processed = conditionalShuffle([...newExercise.words], randomizeItems);
      setAvailableWords(processed);

      const initialSorted: Record<string, string[]> = {};
      (newExercise.categories || []).forEach(cat => {
        initialSorted[cat.name] = [];
      });
      setSortedItems(initialSorted);
    }
  }, [module, randomizeItems]);

  // Desktop drag handlers
  const handleDragStart = (e: React.DragEvent, word: string) => {
    setDraggedItem(word);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, categoryName: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCategory(categoryName);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverCategory(null);
  };

  const handleDrop = (e: React.DragEvent, categoryName: string) => {
    e.preventDefault();
    if (!draggedItem) return;

    moveWordToCategory(draggedItem, categoryName);
  };

  // Mobile touch handlers
  const handleTouchStart = (e: React.TouchEvent, word: string) => {
    if (showResult) return;

    const touch = e.touches[0];
    setTouchStartPos({ x: touch.clientX, y: touch.clientY });
    setDraggedItem(word);

    // Prevent scrolling while dragging
    e.preventDefault();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!draggedItem || !touchStartPos) return;

    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPos.x);
    const deltaY = Math.abs(touch.clientY - touchStartPos.y);

    // Start dragging if moved enough
    if (!isDragging && (deltaX > 10 || deltaY > 10)) {
      setIsDragging(true);
      setDragPreview({
        word: draggedItem,
        x: touch.clientX,
        y: touch.clientY,
      });
    }

    if (isDragging) {
      setDragPreview(prev =>
        prev
          ? {
              ...prev,
              x: touch.clientX,
              y: touch.clientY,
            }
          : null
      );

      // Find category under touch
      const element = document.elementFromPoint(touch.clientX, touch.clientY);
      const categoryElement = element?.closest('[data-category]');
      const categoryName = categoryElement?.getAttribute('data-category');

      setDragOverCategory(categoryName || null);
    }

    e.preventDefault();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!draggedItem) return;

    if (isDragging && dragOverCategory) {
      moveWordToCategory(draggedItem, dragOverCategory);
    }

    // Reset touch state
    setTouchStartPos(null);
    setIsDragging(false);
    setDragPreview(null);
    setDraggedItem(null);
    setDragOverCategory(null);

    e.preventDefault();
  };

  // Haptic feedback helper
  const vibrate = (pattern: number | number[]) => {
    if (navigator.vibrate) navigator.vibrate(pattern);
  };

  // Unified move function for both desktop and mobile
  const moveWordToCategory = (word: string, categoryName: string) => {
    vibrate(30); // short tap feedback on drop

    // Remove from available words
    setAvailableWords(prev => prev.filter(w => w !== word));

    // Add to category
    setSortedItems(prev => ({
      ...prev,
      [categoryName]: [...(prev[categoryName] || []), word],
    }));

    setDraggedItem(null);
    setDragOverCategory(null);
  };

  const handleRemoveFromCategory = (word: string, categoryName: string) => {
    if (showResult) return;

    // Remove from category
    setSortedItems(prev => ({
      ...prev,
      [categoryName]: (prev[categoryName] || []).filter(w => w !== word),
    }));

    // Add back to available words
    setAvailableWords(prev => [...prev, word]);
  };

  // Mobile-friendly tap to remove
  const handleItemTap = (word: string, categoryName: string) => {
    if (showResult) return;
    handleRemoveFromCategory(word, categoryName);
  };

  const checkAnswers = () => {
    let correctCategories = 0;

    (exercise.categories || []).forEach(category => {
      const userItems = sortedItems[category.name] || [];
      const correctItems = category.items;

      // Check if all correct items are in user's category and no extra items
      const isCorrect =
        userItems.length === correctItems.length &&
        userItems.every(item => correctItems.includes(item));

      if (isCorrect) {
        correctCategories++;
      }
    });

    const isAllCorrect = correctCategories === (exercise.categories?.length || 0);
    updateSessionScore(isAllCorrect ? { correct: 1 } : { incorrect: 1 });

    // Show toast notification
    if (isAllCorrect) {
      showCorrectAnswer();
    } else {
      showIncorrectAnswer();
    }

    setShowResult(true);
  };

  const resetExercise = () => {
    const processed = conditionalShuffle([...exercise.words], randomizeItems);
    setAvailableWords(processed);

    const initialSorted: Record<string, string[]> = {};
    (exercise.categories || []).forEach(cat => {
      initialSorted[cat.name] = [];
    });
    setSortedItems(initialSorted);
    setShowResult(false);
  };

  const finishExercise = () => {
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);
    const { sessionScore } = useAppStore.getState();
    const finalScore = sessionScore.correct > 0 ? 100 : 0;
    const accuracy = sessionScore.accuracy;

    // Register progress
    addProgressEntry({
      score: finalScore,
      totalQuestions: sessionScore.total,
      correctAnswers: sessionScore.correct,
      moduleId: module.id,
      learningMode: 'sorting',
      timeSpent: timeSpent,
    });

    showModuleCompleted(module.name, finalScore, accuracy);
    updateUserScore(module.id, finalScore, timeSpent);
    returnToMenu({ autoScrollToNext: true });
  };

  const showSummaryModal = () => {
    setShowExplanation(false);
    setSelectedTerm(null);

    // Create a summary object with all words and their explanations
    const summaryData = {
      categories: exercise.categories,
      sortedItems: sortedItems,
      results: (exercise.categories || []).flatMap(category =>
        category.items.map(word => {
          const userCategory = Object.keys(sortedItems).find(catName =>
            (sortedItems[catName] || []).includes(word)
          );
          const isCorrect = userCategory === category.name;
          const wordData = (module.data as any[])?.find((item: any) => item.word === word);

          return {
            word,
            correctCategory: category.name,
            userCategory: userCategory || t('learning.notSorted'),
            isCorrect,
            explanation:
              wordData?.explanation ||
              t('learning.belongsToCategory', undefined, { category: category.name }),
          };
        })
      ),
    };

    setSelectedTerm(summaryData);
    setShowExplanation(true);
  };

  const allWordsSorted = availableWords.length === 0;

  if (!module?.data || exercise.words.length === 0) {
    return (
      <div className="sorting-component">
        <div className="sorting-component__loading">
          <p className="sorting-component__loading-text">{t('learning.loadingSorting')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sorting-component">
      {/* Unified progress header */}
      <LearningProgressHeader
        title={module.name}
        currentIndex={exercise.words.length - availableWords.length - 1}
        totalItems={exercise.words.length}
        mode="sorting"
        helpText={allWordsSorted ? t('learning.allSorted') : t('learning.dragDropWords')}
      />

      {/* Workspace */}
      <div className="sorting-component__workspace">
        {/* Available Words */}
        <div className="sorting-component__available-section">
          <h3 className="sorting-component__section-header">{t('learning.availableWords')}</h3>
          <div className="sorting-component__available-area">
            <div className="sorting-component__words-container">
              {availableWords.map((word, index) => (
                <div
                  key={`available-${index}-${word}`}
                  draggable={!showResult}
                  onDragStart={e => handleDragStart(e, word)}
                  onTouchStart={e => handleTouchStart(e, word)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  className={`sorting-component__word-chip ${
                    draggedItem === word ? 'sorting-component__word-chip--dragging' : ''
                  }`}
                >
                  <ContentRenderer content={ContentAdapter.ensureStructured(word, 'quiz')} />
                </div>
              ))}
            </div>
            {availableWords.length === 0 && (
              <p className="sorting-component__empty-message">{t('learning.allWordsSorted')}</p>
            )}
          </div>
        </div>

        {/* Categories */}
        <div className="sorting-component__categories">
          {(exercise.categories || []).map(category => {
            const userItems = sortedItems[category.name] || [];
            const isCorrect =
              showResult &&
              userItems.length === category.items.length &&
              userItems.every(item => category.items.includes(item));
            const hasErrors = showResult && !isCorrect;

            const isDragOver = dragOverCategory === category.name;

            let dropZoneClass = 'sorting-component__drop-zone ';

            if (showResult) {
              if (isCorrect) {
                dropZoneClass += 'sorting-component__drop-zone--correct';
              } else if (hasErrors) {
                dropZoneClass += 'sorting-component__drop-zone--error';
              } else {
                dropZoneClass += 'sorting-component__drop-zone--neutral';
              }
            } else {
              dropZoneClass += 'sorting-component__drop-zone--interactive';
              if (isDragOver) {
                dropZoneClass += ' sorting-component__drop-zone--drag-over';
              }
            }

            return (
              <div
                key={category.name}
                data-category={category.name}
                onDragOver={e => handleDragOver(e, category.name)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, category.name)}
                className={dropZoneClass}
              >
                <h4 className="sorting-component__category-header">
                  {category.name}
                  {showResult && (
                    <span
                      className={`sorting-component__category-status ${
                        isCorrect
                          ? 'sorting-component__category-status--correct'
                          : 'sorting-component__category-status--incorrect'
                      }`}
                    >
                      {isCorrect ? '✓' : '✗'}
                    </span>
                  )}
                </h4>

                <div className="sorting-component__sorted-items">
                  {userItems.map((word, index) => {
                    let itemClass = 'sorting-component__sorted-item ';

                    if (showResult) {
                      itemClass += category.items.includes(word)
                        ? 'sorting-component__sorted-item--correct'
                        : 'sorting-component__sorted-item--incorrect';
                    } else {
                      itemClass += 'sorting-component__sorted-item--default';
                    }

                    return (
                      <div
                        key={`${category.name}-${index}-${word}`}
                        onClick={() => handleItemTap(word, category.name)}
                        onTouchEnd={e => {
                          e.preventDefault();
                          handleItemTap(word, category.name);
                        }}
                        className={itemClass}
                      >
                        <ContentRenderer content={ContentAdapter.ensureStructured(word, 'quiz')} />
                      </div>
                    );
                  })}
                </div>

                {showResult && hasErrors && (
                  <div className="sorting-component__feedback sorting-component__feedback--error">
                    <span className="sorting-component__feedback-label">
                      {t('learning.correctItems')}
                    </span>{' '}
                    <span className="sorting-component__feedback-text">
                      {category.items.map((item, idx) => (
                        <span key={idx}>
                          <ContentRenderer
                            content={ContentAdapter.ensureStructured(item, 'quiz')}
                          />
                          {idx < category.items.length - 1 ? ', ' : ''}
                        </span>
                      ))}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Unified Control Bar */}
      <div className="game-controls">
        {/* Home Navigation */}
        <button
          onClick={handleReturnToMenu}
          className="game-controls__home-btn"
          title={t('learning.returnToMainMenu')}
        >
          <Home className="game-controls__home-icon" />
        </button>

        {!showResult ? (
          <>
            <button
              onClick={resetExercise}
              className="game-controls__icon-btn"
              title={t('learning.resetExercise')}
            >
              <RotateCcw className="game-controls__action-icon" />
            </button>

            <button
              onClick={checkAnswers}
              disabled={!allWordsSorted}
              className="game-controls__primary-btn game-controls__primary-btn--orange"
            >
              <Check className="game-controls__primary-icon" />
              <span>{t('learning.checkAnswers')}</span>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={showSummaryModal}
              className="game-controls__icon-btn"
              title={t('learning.viewSummary')}
            >
              <Info className="game-controls__action-icon" />
            </button>
            <button
              onClick={finishExercise}
              className="game-controls__primary-btn game-controls__primary-btn--green"
            >
              <Check className="game-controls__primary-icon" />
              <span>{t('learning.finishSorting')}</span>
            </button>
          </>
        )}
      </div>

      {/* Mobile Drag Preview */}
      {dragPreview && (
        <div
          className="sorting-component__drag-preview"
          style={{
            position: 'fixed',
            left: dragPreview.x - 50,
            top: dragPreview.y - 20,
            zIndex: 1000,
            pointerEvents: 'none',
            transform: 'rotate(5deg)',
          }}
        >
          <div className="sorting-component__word-chip sorting-component__word-chip--preview">
            <ContentRenderer content={ContentAdapter.ensureStructured(dragPreview.word, 'quiz')} />
          </div>
        </div>
      )}

      {/* Explanation/Summary Modal */}
      {showExplanation && selectedTerm && (
        <div className="sorting-modal">
          <div className="sorting-modal__container">
            <div className="sorting-modal__header">
              <h3 className="sorting-modal__title">{t('learning.exerciseSummary')}</h3>
              <button
                onClick={() => setShowExplanation(false)}
                className="sorting-modal__close-btn"
              >
                <X className="sorting-modal__close-icon" />
              </button>
            </div>

            <div className="sorting-modal__content">
              {/* Summary View */}
              <div className="sorting-modal__summary">
                <div className="sorting-modal__results-grid">
                  {selectedTerm.results.map((result: any, index: number) => (
                    <div
                      key={index}
                      className={`sorting-modal__result-card ${
                        result.isCorrect
                          ? 'sorting-modal__result-card--correct'
                          : 'sorting-modal__result-card--incorrect'
                      }`}
                    >
                      <span
                        className={`sorting-modal__card-status ${
                          result.isCorrect
                            ? 'sorting-modal__card-status--correct'
                            : 'sorting-modal__card-status--incorrect'
                        }`}
                      >
                        {result.isCorrect ? '✓' : '✗'}
                      </span>

                      <h4 className="sorting-modal__card-word"><ContentRenderer content={ContentAdapter.ensureStructured(result.word, 'quiz')} /></h4>

                      <p className="sorting-modal__card-value sorting-modal__card-value--correct">
                        {result.correctCategory}
                      </p>

                      {!result.isCorrect ? (
                        <p className="sorting-modal__card-value sorting-modal__card-value--incorrect">
                          {result.userCategory}
                        </p>
                      ) : (
                        <span className="sorting-modal__card-placeholder"></span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="sorting-modal__actions">
              <button
                onClick={() => setShowExplanation(false)}
                className="sorting-modal__close-button"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SortingComponent;
