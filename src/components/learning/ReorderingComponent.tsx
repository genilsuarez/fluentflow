import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Check, ArrowRight, Home, RotateCcw, Eye } from 'lucide-react';
import { useLearningSession } from '../../hooks/useLearningSession';
import { prepareWords, validateReordering, moveWord } from './reorderingUtils';
import LearningProgressHeader from '../ui/LearningProgressHeader';
import type { LearningModule, ReorderingData } from '../../types';

import '../../styles/components/reordering-component.css';

interface ReorderingComponentProps {
  module: LearningModule;
}

const ReorderingComponent: React.FC<ReorderingComponentProps> = ({ module }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [availableWords, setAvailableWords] = useState<string[]>([]);
  const [answerWords, setAnswerWords] = useState<string[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [incorrectPositions, setIncorrectPositions] = useState<number[]>([]);
  const [showHint, setShowHint] = useState(false);

  // Keyboard navigation state
  const [focusedZone, setFocusedZone] = useState<'available' | 'answer'>('available');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [keyboardSelected, setKeyboardSelected] = useState(false);

  const {
    t,
    randomizeItems,
    markCorrect,
    markIncorrect,
    finishExercise,
    handleReturnToMenu,
  } = useLearningSession({
    moduleId: module.id,
    moduleName: module.name,
    learningMode: 'reordering',
  });

  // Compute exercises once on mount to avoid re-shuffling on score updates
  const processedExercisesRef = useRef<ReorderingData[] | null>(null);
  if (processedExercisesRef.current === null) {
    processedExercisesRef.current = module?.data
      ? (module.data as ReorderingData[])
      : [];
  }
  const exercises = processedExercisesRef.current;
  const currentExercise = exercises[currentIndex];

  // Initialize words for current exercise
  useEffect(() => {
    if (!currentExercise) return;
    const words = prepareWords(
      currentExercise.words,
      currentExercise.distractors,
      randomizeItems
    );
    setAvailableWords(words);
    setAnswerWords([]);
    setShowResult(false);
    setIsCorrect(false);
    setIncorrectPositions([]);
    setShowHint(false);
    setFocusedZone('available');
    setFocusedIndex(0);
    setKeyboardSelected(false);
  }, [currentIndex, currentExercise, randomizeItems]);

  // Tap word in word bank -> move to end of answer zone
  const handleTapAvailable = useCallback((index: number) => {
    if (showResult) return;
    const result = moveWord(availableWords, answerWords, index);
    setAvailableWords(result.from);
    setAnswerWords(result.to);
    setKeyboardSelected(false);
  }, [showResult, availableWords, answerWords]);

  // Tap word in answer zone -> return to word bank
  const handleTapAnswer = useCallback((index: number) => {
    if (showResult) return;
    const result = moveWord(answerWords, availableWords, index);
    setAnswerWords(result.from);
    setAvailableWords(result.to);
    setKeyboardSelected(false);
  }, [showResult, answerWords, availableWords]);

  const handleCheck = useCallback(() => {
    if (answerWords.length === 0 || showResult) return;
    if (!currentExercise) return;
    const validation = validateReordering(answerWords, currentExercise.words);
    setIsCorrect(validation.isCorrect);
    setIncorrectPositions(validation.incorrectPositions);
    setShowResult(true);
    if (validation.isCorrect) {
      markCorrect();
    } else {
      markIncorrect();
    }
  }, [answerWords, showResult, currentExercise, markCorrect, markIncorrect]);

  const handleReset = useCallback(() => {
    if (!currentExercise) return;
    const words = prepareWords(
      currentExercise.words,
      currentExercise.distractors,
      randomizeItems
    );
    setAvailableWords(words);
    setAnswerWords([]);
    setShowResult(false);
    setIsCorrect(false);
    setIncorrectPositions([]);
    setFocusedZone('available');
    setFocusedIndex(0);
    setKeyboardSelected(false);
  }, [currentExercise, randomizeItems]);

  const handleNext = useCallback(() => {
    if (currentIndex < exercises.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      finishExercise();
    }
  }, [currentIndex, exercises.length, finishExercise]);

  // Comprehensive keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape -> return to menu
      if (e.key === 'Escape') {
        e.preventDefault();
        handleReturnToMenu();
        return;
      }

      // When showing results, Enter advances to next
      if (showResult) {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleNext();
        }
        return;
      }

      // Ctrl+Enter -> check answer (when at least one word is placed)
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (answerWords.length > 0) {
          handleCheck();
        }
        return;
      }

      const currentWords = focusedZone === 'available' ? availableWords : answerWords;

      switch (e.key) {
        case 'Tab': {
          e.preventDefault();
          if (e.shiftKey) {
            if (focusedIndex > 0) {
              setFocusedIndex(focusedIndex - 1);
            } else {
              const otherZone = focusedZone === 'available' ? 'answer' : 'available';
              const otherWords = otherZone === 'available' ? availableWords : answerWords;
              if (otherWords.length > 0) {
                setFocusedZone(otherZone);
                setFocusedIndex(otherWords.length - 1);
                setKeyboardSelected(false);
              }
            }
          } else {
            if (focusedIndex < currentWords.length - 1) {
              setFocusedIndex(focusedIndex + 1);
            } else {
              const otherZone = focusedZone === 'available' ? 'answer' : 'available';
              const otherWords = otherZone === 'available' ? availableWords : answerWords;
              if (otherWords.length > 0) {
                setFocusedZone(otherZone);
                setFocusedIndex(0);
                setKeyboardSelected(false);
              }
            }
          }
          break;
        }

        case 'Enter':
        case ' ': {
          e.preventDefault();
          if (currentWords.length === 0) break;

          if (focusedZone === 'available') {
            const result = moveWord(availableWords, answerWords, focusedIndex);
            setAvailableWords(result.from);
            setAnswerWords(result.to);
            setKeyboardSelected(false);
            if (focusedIndex >= result.from.length && result.from.length > 0) {
              setFocusedIndex(result.from.length - 1);
            } else if (result.from.length === 0) {
              setFocusedZone('answer');
              setFocusedIndex(result.to.length - 1);
            }
          } else {
            if (keyboardSelected) {
              const result = moveWord(answerWords, availableWords, focusedIndex);
              setAnswerWords(result.from);
              setAvailableWords(result.to);
              setKeyboardSelected(false);
              if (focusedIndex >= result.from.length && result.from.length > 0) {
                setFocusedIndex(result.from.length - 1);
              } else if (result.from.length === 0) {
                setFocusedZone('available');
                setFocusedIndex(0);
              }
            } else {
              setKeyboardSelected(true);
            }
          }
          break;
        }

        case 'ArrowLeft': {
          e.preventDefault();
          if (focusedZone === 'answer' && keyboardSelected && focusedIndex > 0) {
            // Reorder: swap selected word left
            const newAnswer = [...answerWords];
            [newAnswer[focusedIndex - 1], newAnswer[focusedIndex]] =
              [newAnswer[focusedIndex], newAnswer[focusedIndex - 1]];
            setAnswerWords(newAnswer);
            setFocusedIndex(focusedIndex - 1);
          } else if (!keyboardSelected && focusedIndex > 0) {
            // Navigate: move focus left
            setFocusedIndex(focusedIndex - 1);
          }
          break;
        }

        case 'ArrowRight': {
          e.preventDefault();
          if (focusedZone === 'answer' && keyboardSelected && focusedIndex < answerWords.length - 1) {
            // Reorder: swap selected word right
            const newAnswer = [...answerWords];
            [newAnswer[focusedIndex], newAnswer[focusedIndex + 1]] =
              [newAnswer[focusedIndex + 1], newAnswer[focusedIndex]];
            setAnswerWords(newAnswer);
            setFocusedIndex(focusedIndex + 1);
          } else if (!keyboardSelected && focusedIndex < currentWords.length - 1) {
            // Navigate: move focus right
            setFocusedIndex(focusedIndex + 1);
          }
          break;
        }

        case 'ArrowUp':
        case 'ArrowDown': {
          e.preventDefault();
          // Switch between zones
          const otherZone = focusedZone === 'available' ? 'answer' : 'available';
          const otherWords = otherZone === 'available' ? availableWords : answerWords;
          if (otherWords.length > 0) {
            setFocusedZone(otherZone);
            setFocusedIndex(Math.min(focusedIndex, otherWords.length - 1));
            setKeyboardSelected(false);
          }
          break;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showResult, focusedZone, focusedIndex, keyboardSelected, availableWords, answerWords, handleCheck, handleNext, handleReturnToMenu]);

  // Early return if no data
  if (!exercises.length || !currentExercise) {
    return (
      <div className="reordering">
        <div className="reordering__empty">
          <p>{t('learning.noReorderingExercisesAvailable')}</p>
          <button onClick={handleReturnToMenu} className="reordering__menu-btn">
            {t('navigation.mainMenu')}
          </button>
        </div>
      </div>
    );
  }

  const getWordClass = (index: number, zone: 'available' | 'answer') => {
    let cls = 'reordering__word';
    if (zone === 'answer' && showResult) {
      if (incorrectPositions.includes(index)) {
        cls += ' reordering__word--incorrect';
      } else {
        cls += ' reordering__word--correct';
      }
    }
    // Keyboard focus indicator
    if (!showResult && zone === focusedZone && index === focusedIndex) {
      cls += ' reordering__word--focused';
      if (keyboardSelected && zone === 'answer') {
        cls += ' reordering__word--selected';
      }
    }
    return cls;
  };

  return (
    <div className="reordering">
      <LearningProgressHeader
        title={module.name}
        currentIndex={currentIndex}
        totalItems={exercises.length}
        mode="reordering"
        helpText={showResult ? t('learning.pressEnterNext') : t('learning.tapToPlace')}
      />

      {/* Instruction */}
      <div className="reordering__instruction">
        <p>{t('learning.reorderingInstruction')}</p>
      </div>

      {/* Hint toggle */}
      {currentExercise.hint && (
        <div className="reordering__hint-section">
          <button
            className="reordering__hint-toggle"
            onClick={() => setShowHint(!showHint)}
          >
            <Eye className="reordering__hint-icon" />
            <span>{t('learning.showHint')}</span>
          </button>
          {showHint && (
            <div className="reordering__hint">
              <p>{currentExercise.hint}</p>
            </div>
          )}
        </div>
      )}

      {/* Answer Zone */}
      <div className="reordering__zone reordering__zone--answer">
        <label className="reordering__zone-label">{t('learning.yourAnswer')}</label>
        <div
          className="reordering__zone-content"
          role="listbox"
          aria-label={t('learning.yourAnswer')}
          aria-dropeffect={!showResult ? 'move' : 'none'}
        >
          {answerWords.length === 0 && !showResult && (
            <p className="reordering__placeholder">{t('learning.tapToPlace')}</p>
          )}
          {answerWords.map((word, index) => (
            <button
              key={`answer-${index}-${word}`}
              className={getWordClass(index, 'answer')}
              onClick={() => handleTapAnswer(index)}
              disabled={showResult}
              type="button"
              role="option"
              aria-selected={focusedZone === 'answer' && focusedIndex === index}
              aria-grabbed={focusedZone === 'answer' && focusedIndex === index && keyboardSelected}
              tabIndex={focusedZone === 'answer' && focusedIndex === index ? 0 : -1}
            >
              {word}
            </button>
          ))}
        </div>
      </div>

      {/* Word Bank */}
      <div className="reordering__zone reordering__zone--words">
        <label className="reordering__zone-label">{t('learning.wordBank')}</label>
        <div
          className="reordering__zone-content"
          role="listbox"
          aria-label={t('learning.wordBank')}
          aria-dropeffect={!showResult ? 'move' : 'none'}
        >
          {availableWords.map((word, index) => (
            <button
              key={`available-${index}-${word}`}
              className={getWordClass(index, 'available')}
              onClick={() => handleTapAvailable(index)}
              disabled={showResult}
              type="button"
              role="option"
              aria-selected={focusedZone === 'available' && focusedIndex === index}
              aria-grabbed={false}
              tabIndex={focusedZone === 'available' && focusedIndex === index ? 0 : -1}
            >
              {word}
            </button>
          ))}
          {availableWords.length === 0 && !showResult && (
            <p className="reordering__placeholder">{t('learning.tapToRemove')}</p>
          )}
        </div>
      </div>

      {/* Result feedback */}
      {showResult && (
        <div className={`reordering__feedback ${isCorrect ? 'reordering__feedback--correct' : 'reordering__feedback--incorrect'}`}>
          <p className="reordering__feedback-text">
            {isCorrect ? t('common.correct') : t('common.incorrect')}
          </p>
          {!isCorrect && (
            <div className="reordering__sentence">
              <span className="reordering__sentence-label">{t('learning.correctSentence')}: </span>
              <span className="reordering__sentence-text">{currentExercise.sentence}</span>
            </div>
          )}
          {!isCorrect && currentExercise.explanation && (
            <div className="reordering__explanation">
              <p>{currentExercise.explanation}</p>
            </div>
          )}
        </div>
      )}

      {/* Control Bar */}
      <div className="game-controls">
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
              onClick={handleReset}
              className="game-controls__icon-btn"
              title={t('learning.resetExercise')}
            >
              <RotateCcw className="game-controls__action-icon" />
            </button>

            <button
              onClick={handleCheck}
              disabled={answerWords.length === 0}
              className="game-controls__primary-btn game-controls__primary-btn--purple"
            >
              <Check className="game-controls__primary-icon" />
              <span>{t('learning.checkOrder')}</span>
            </button>
          </>
        ) : (
          <button
            onClick={handleNext}
            className="game-controls__primary-btn game-controls__primary-btn--green"
          >
            <span>
              {currentIndex === exercises.length - 1
                ? t('learning.finishExercise')
                : t('learning.nextExercise')}
            </span>
            <ArrowRight className="game-controls__primary-icon" />
          </button>
        )}
      </div>
    </div>
  );
};

export default ReorderingComponent;
