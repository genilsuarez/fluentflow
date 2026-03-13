import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Check, X, ArrowRight, Home } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useUserStore } from '../../stores/userStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useMenuNavigation } from '../../hooks/useMenuNavigation';
import { useProgressStore } from '../../stores/progressStore';
import { useTranslation } from '../../utils/i18n';
import { useToast } from '../../hooks/useToast';
import { useLearningCleanup } from '../../hooks/useLearningCleanup';
import { conditionalShuffle } from '../../utils/randomUtils';
import '../../styles/components/completion-component.css';
import '../../styles/components/editable-input.css';
import { ContentAdapter } from '../../utils/contentAdapter';
import ContentRenderer from '../ui/ContentRenderer';
import LearningProgressHeader from '../ui/LearningProgressHeader';
import { EditableInput } from '../ui/EditableInput';
import type { EditableInputHandle } from '../ui/EditableInput';

import type { LearningModule } from '../../types';

interface CompletionData {
  sentence: string;
  correct: string;
  explanation?: string;
  tip?: string;
}

interface CompletionComponentProps {
  module: LearningModule;
}

const CompletionComponent: React.FC<CompletionComponentProps> = ({ module }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [startTime] = useState(Date.now());
  const inputRef = useRef<EditableInputHandle>(null);

  const { updateSessionScore } = useAppStore();
  const { updateUserScore } = useUserStore();
  const { language, randomizeItems } = useSettingsStore();
  const { returnToMenu } = useMenuNavigation();
  const { addProgressEntry } = useProgressStore();
  const { t } = useTranslation(language);
  const { showCorrectAnswer, showIncorrectAnswer, showModuleCompleted } = useToast();
  useLearningCleanup();

  const handleReturnToMenu = () => returnToMenu();

  // Process exercises with optional randomization based on settings
  const processedExercises = useMemo(() => {
    if (!module?.data) return [];
    return conditionalShuffle(module.data as CompletionData[], randomizeItems);
  }, [module?.data, randomizeItems]);

  const currentExercise = processedExercises[currentIndex];

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const checkAnswer = useCallback(() => {
    if (showResult) return;

    const userAnswer = answer.toLowerCase().trim();
    const correctAnswer = currentExercise?.correct?.toLowerCase().trim() || '';
    const isCorrect = userAnswer === correctAnswer;

    updateSessionScore(isCorrect ? { correct: 1 } : { incorrect: 1 });
    setShowResult(true);

    // Show toast feedback
    if (isCorrect) {
      showCorrectAnswer();
    } else {
      showIncorrectAnswer();
    }
  }, [
    showResult,
    answer,
    currentExercise?.correct,
    updateSessionScore,
    showCorrectAnswer,
    showIncorrectAnswer,
  ]);

  const handleNext = useCallback(() => {
    if (currentIndex < processedExercises.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setAnswer('');
      setShowResult(false);
      // Focus after React re-renders the new exercise
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      const timeSpent = Math.floor((Date.now() - startTime) / 1000);
      const { sessionScore } = useAppStore.getState();
      const finalScore = Math.round((sessionScore.correct / sessionScore.total) * 100);

      // Register progress
      addProgressEntry({
        score: finalScore,
        totalQuestions: sessionScore.total,
        correctAnswers: sessionScore.correct,
        moduleId: module.id,
        learningMode: 'completion',
        timeSpent: timeSpent,
      });

      const accuracy = sessionScore.accuracy;
      showModuleCompleted(module.name, finalScore, accuracy);
      updateUserScore(module.id, finalScore, timeSpent);
      returnToMenu({ autoScrollToNext: true });
    }
  }, [
    currentIndex,
    processedExercises.length,
    startTime,
    addProgressEntry,
    module.id,
    module.name,
    showModuleCompleted,
    updateUserScore,
    returnToMenu,
  ]);

  useEffect(() => {
    if (processedExercises.length === 0) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !showResult) {
        if (answer.trim()) {
          checkAnswer();
        }
      } else if (e.key === 'Enter' && showResult) {
        handleNext();
      } else if (e.key === 'Escape') {
        returnToMenu();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [answer, showResult, processedExercises.length, checkAnswer, handleNext, returnToMenu]);

  // Early return if no data
  if (!processedExercises.length) {
    return (
      <div className="completion-component__no-data">
        <p className="completion-component__no-data-text">
          {t('learning.noCompletionExercisesAvailable')}
        </p>
        <button onClick={handleReturnToMenu} className="completion-component__no-data-btn">
          {t('navigation.mainMenu')}
        </button>
      </div>
    );
  }

  const renderSentence = () => {
    if (!currentExercise?.sentence) return null;

    // Split sentence by blank marker (______)
    const parts = currentExercise.sentence.split('______');
    const elements: React.ReactElement[] = [];

    parts.forEach((part, index) => {
      // Add text part with structured content rendering
      if (part) {
        elements.push(
          <span key={`text-${index}`} className="completion-component__text">
            <ContentRenderer content={ContentAdapter.ensureStructured(part, 'quiz')} />
          </span>
        );
      }

      // Add input after each part except the last
      if (index < parts.length - 1) {
        const isCorrect =
          showResult &&
          answer.toLowerCase().trim() === currentExercise.correct?.toLowerCase().trim();
        const isIncorrect = showResult && answer && !isCorrect;

        let inputClass = 'completion-component__input';
        if (showResult) {
          if (isCorrect) {
            inputClass += ' completion-component__input--correct';
          } else if (isIncorrect) {
            inputClass += ' completion-component__input--incorrect';
          } else {
            inputClass += ' completion-component__input--disabled';
          }
        } else {
          inputClass += ' completion-component__input--neutral';
        }

        // Generate hint with first letter
        const firstLetter = currentExercise.correct?.charAt(0) || '';
        const placeholderHint = firstLetter ? `${firstLetter}...` : '...';

        elements.push(
          <EditableInput
            key={`input-${index}`}
            ref={inputRef}
            value={answer}
            onChange={value => setAnswer(value.toLowerCase())}
            disabled={showResult}
            placeholder={placeholderHint}
            className={`editable-input ${inputClass.replace('completion-component__input', 'editable-input')}`}
            style={
              {
                '--dynamic-width': `${Math.max(120, (answer?.length || 3) * 12 + 60)}px`,
                textTransform: 'lowercase',
              } as React.CSSProperties
            }
            autoFocus={!showResult}
          />
        );
      }
    });

    return <>{elements}</>;
  };

  const hasAnswer = answer.trim().length > 0;

  return (
    <div className="completion-component__container">
      {/* Unified progress header */}
      <LearningProgressHeader
        title={module.name}
        currentIndex={currentIndex}
        totalItems={processedExercises.length}
        mode="completion"
        helpText={showResult ? t('learning.pressEnterNext') : t('learning.fillBlank')}
      />

      {/* Exercise */}
      <div className="completion-component__exercise-card">
        <h3 className="completion-component__instruction">{t('learning.completeSentence')}</h3>

        {currentExercise?.tip && (
          <div className="completion-component__tip">
            <p className="completion-component__tip-text">
              💡 <strong>Tip:</strong> {currentExercise.tip}
            </p>
          </div>
        )}

        <div className="completion-component__sentence-container">
          <div className="completion-component__sentence">{renderSentence()}</div>
        </div>

        {/* Result and Explanation - Compact unified section */}
        <div
          className={`completion-component__result-container ${
            showResult
              ? 'completion-component__result-container--visible'
              : 'completion-component__result-container--hidden'
          }`}
        >
          <div className="completion-component__result">
            {/* Ultra-compact result feedback */}
            <div className="completion-component__feedback-row">
              {answer.toLowerCase().trim() === currentExercise?.correct?.toLowerCase().trim() ? (
                <Check className="completion-component__feedback-icon completion-component__feedback-icon--correct" />
              ) : (
                <X className="completion-component__feedback-icon completion-component__feedback-icon--incorrect" />
              )}
              <span className="completion-component__feedback">
                {answer.toLowerCase().trim() === currentExercise?.correct?.toLowerCase().trim()
                  ? t('common.correct')
                  : t('common.incorrect')}
              </span>

              {/* Correct answer flows naturally after incorrect */}
              {answer.toLowerCase().trim() !== currentExercise?.correct?.toLowerCase().trim() && (
                <span className="completion-component__correct-answer">
                  - Answer: <strong>{currentExercise?.correct}</strong>
                </span>
              )}
            </div>

            {/* Compact explanation */}
            {currentExercise?.explanation && (
              <div className="completion-component__explanation">
                <div className="completion-component__explanation-text">
                  <span className="completion-component__explanation-label">Explanation:</span>{' '}
                  <ContentRenderer
                    content={ContentAdapter.ensureStructured(
                      currentExercise.explanation,
                      'explanation'
                    )}
                  />
                </div>
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

        {!showResult ? (
          <button
            onClick={checkAnswer}
            disabled={!hasAnswer}
            className="game-controls__primary-btn game-controls__primary-btn--purple"
          >
            <Check className="game-controls__primary-icon" />
            <span>{t('learning.checkAnswer')}</span>
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="game-controls__primary-btn game-controls__primary-btn--green"
          >
            <span>
              {currentIndex === processedExercises.length - 1
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

export default CompletionComponent;
