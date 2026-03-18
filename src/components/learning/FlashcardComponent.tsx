import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, Home } from 'lucide-react';
import { useUserStore } from '../../stores/userStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useMenuNavigation } from '../../hooks/useMenuNavigation';
import { useProgressStore } from '../../stores/progressStore';
import { useTranslation } from '../../utils/i18n';
import { useLearningCleanup } from '../../hooks/useLearningCleanup';
import { conditionalShuffle } from '../../utils/randomUtils';
import { ContentAdapter } from '../../utils/contentAdapter';
import ContentRenderer from '../ui/ContentRenderer';
import LearningProgressHeader from '../ui/LearningProgressHeader';

import '../../styles/components/flashcard-component.css';
import type { FlashcardData, LearningModule } from '../../types';

interface FlashcardComponentProps {
  module: LearningModule;
}

const FlashcardComponent: React.FC<FlashcardComponentProps> = ({ module }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [startTime] = useState(Date.now());

  const { updateUserScore } = useUserStore();
  const { language, randomizeItems } = useSettingsStore();
  const { returnToMenu } = useMenuNavigation();
  const { addProgressEntry } = useProgressStore();
  const { t } = useTranslation(language);
  useLearningCleanup();

  const handleReturnToMenu = () => returnToMenu();

  // Generate set with optional randomization based on settings
  const processedFlashcards = useMemo(() => {
    if (!module?.data) return [];
    const allFlashcards = module.data as FlashcardData[];
    return conditionalShuffle(allFlashcards, randomizeItems);
  }, [module?.data, randomizeItems]);

  const currentCard = processedFlashcards[currentIndex];

  const handleNext = useCallback(() => {
    if (currentIndex < processedFlashcards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    } else {
      // End of flashcards
      const timeSpent = Math.floor((Date.now() - startTime) / 1000);

      // Register progress (assuming all flashcards were "correct" for completion)
      addProgressEntry({
        score: 100, // Flashcards are completion-based, so 100% for finishing
        totalQuestions: processedFlashcards.length,
        correctAnswers: processedFlashcards.length,
        moduleId: module.id,
        learningMode: 'flashcard',
        timeSpent: timeSpent,
      });

      updateUserScore(module.id, 100, timeSpent); // 100% completion for finishing all flashcards
      returnToMenu({ autoScrollToNext: true });
    }
  }, [
    currentIndex,
    processedFlashcards.length,
    startTime,
    addProgressEntry,
    module.id,
    updateUserScore,
    returnToMenu,
  ]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsFlipped(false);
    }
  }, [currentIndex]);

  const handleFlip = useCallback(() => {
    setIsFlipped(!isFlipped);
  }, [isFlipped]);

  // Reveal-then-advance: flip first, then advance on second action
  const handleRevealOrNext = useCallback(() => {
    if (isFlipped) {
      handleNext();
    } else {
      handleFlip();
    }
  }, [isFlipped, handleNext, handleFlip]);

  // Keyboard navigation
  useEffect(() => {
    if (processedFlashcards.length === 0) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'Enter':
        case ' ':
          e.preventDefault();
          handleRevealOrNext();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handlePrev();
          break;
        case 'Escape':
          returnToMenu();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [processedFlashcards.length, handleRevealOrNext, handlePrev, returnToMenu]);

  // Early return if no data
  if (!processedFlashcards.length) {
    return (
      <div className="flashcard-component__no-data">
        <p className="flashcard-component__no-data-text">{t('learning.noFlashcardsAvailable')}</p>
        <button onClick={handleReturnToMenu} className="flashcard-component__no-data-btn">
          {t('navigation.mainMenu')}
        </button>
      </div>
    );
  }

  return (
    <div className="flashcard-component__container">
      {/* Unified progress header */}
      <LearningProgressHeader
        title={module.name}
        currentIndex={currentIndex}
        totalItems={processedFlashcards.length}
        mode="flashcard"
        helpText={isFlipped ? t('learning.helpTextFlipped') : t('learning.helpTextNotFlipped')}
      />

      {/* Flashcard */}
      <div
        className={`flashcard-component__card ${
          isFlipped ? 'flashcard-component__card--flipped' : ''
        }`}
        onClick={handleFlip}
      >
        <div className="flashcard-component__card-inner">
          {/* Front */}
          <div className="flashcard-component__card-front">
            <div className="flashcard-component__front-text">
              <ContentRenderer
                content={ContentAdapter.ensureStructured(
                  currentCard?.front || t('common.loading'),
                  'flashcard'
                )}
              />
            </div>
            {currentCard?.ipa && <p className="flashcard-component__ipa">{currentCard.ipa}</p>}
            {currentCard?.hint && <p className="flashcard-component__hint">{currentCard.hint}</p>}
            {currentCard?.example && (
              <div className="flashcard-component__example">
                "
                <ContentRenderer
                  content={ContentAdapter.ensureStructured(currentCard.example, 'flashcard')}
                />
                "
              </div>
            )}
          </div>

          {/* Back */}
          <div className="flashcard-component__card-back">
            <div className="flashcard-component__back-text">
              <ContentRenderer
                content={ContentAdapter.ensureStructured(
                  currentCard?.front || t('common.loading'),
                  'flashcard'
                )}
              />
            </div>
            {currentCard?.ipa && (
              <p className="flashcard-component__ipa flashcard-component__ipa--back">
                {currentCard.ipa}
              </p>
            )}
            <div className="flashcard-component__back-answer">
              <ContentRenderer
                content={ContentAdapter.ensureStructured(
                  currentCard?.back || t('common.loading'),
                  'flashcard'
                )}
              />
            </div>
            {currentCard?.example && (
              <div className="flashcard-component__back-examples">
                <div className="flashcard-component__back-example">
                  "
                  <ContentRenderer
                    content={ContentAdapter.ensureStructured(currentCard.example, 'flashcard')}
                  />
                  "
                </div>
                {currentCard.example_es && (
                  <div className="flashcard-component__back-example flashcard-component__back-example--spanish">
                    "
                    <ContentRenderer
                      content={ContentAdapter.ensureStructured(currentCard.example_es, 'flashcard')}
                    />
                    "
                  </div>
                )}
              </div>
            )}
          </div>
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

        <button
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="game-controls__nav-btn"
          title={t('learning.previousCard')}
        >
          <ChevronLeft className="game-controls__nav-icon" />
        </button>

        <button
          onClick={handleFlip}
          className="game-controls__primary-btn game-controls__primary-btn--blue"
        >
          <RotateCcw className="game-controls__primary-icon" />
          <span>{isFlipped ? t('learning.flipBack') : t('learning.flip')}</span>
        </button>

        <button
          onClick={handleRevealOrNext}
          className="game-controls__nav-btn"
          title={
            !isFlipped
              ? t('learning.flip')
              : currentIndex === processedFlashcards.length - 1
                ? t('learning.finishFlashcards')
                : t('learning.nextCard')
          }
        >
          <ChevronRight className="game-controls__nav-icon" />
        </button>
      </div>
    </div>
  );
};

export default FlashcardComponent;
