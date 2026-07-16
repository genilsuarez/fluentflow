import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Check, X, ArrowRight } from 'lucide-react';
import { useLearningSession } from '../../hooks/useLearningSession';
import { conditionalShuffle } from '../../utils/randomUtils';
import { isTenseError, isParticleError } from '../../utils/answerUtils';
import '../../styles/components/completion-component.css';
import '../../styles/components/editable-input.css';
// BEM classes applied dynamically via .replace(): 'editable-input--correct' 'editable-input--incorrect' 'editable-input--neutral' 'editable-input--disabled'
import { ContentAdapter } from '../../utils/contentAdapter';
import ContentRenderer from '../ui/ContentRenderer';
import LearningProgressHeader from '../ui/LearningProgressHeader';
import ExerciseResultScreen from '../ui/ExerciseResultScreen';
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
  const inputRef = useRef<EditableInputHandle>(null);
  // Flag to ignore Enter key briefly after advancing to next question
  const ignoreEnterRef = useRef(false);

  const {
    t,
    randomizeItems,
    markCorrect,
    markIncorrect,
    finishExercise,
    handleReturnToMenu,
    exerciseResult,
    setExerciseResult,
    handleResultContinue,
    resetSession,
  } = useLearningSession({
    moduleId: module.id,
    moduleName: module.name,
    learningMode: 'completion',
  });

  // Compute exercises once on mount — ref prevents re-shuffling on score updates
  const processedExercisesRef = useRef<CompletionData[] | null>(null);
  if (processedExercisesRef.current === null) {
    processedExercisesRef.current = module?.data
      ? conditionalShuffle(module.data as CompletionData[], randomizeItems)
      : [];
  }
  const processedExercises = processedExercisesRef.current;

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

    if (isCorrect) {
      markCorrect();
    } else {
      markIncorrect();
    }
    setShowResult(true);
  }, [showResult, answer, currentExercise?.correct, markCorrect, markIncorrect]);

  const handleNext = useCallback(() => {
    if (currentIndex < processedExercises.length - 1) {
      // Imperatively clear the contentEditable div BEFORE state updates
      // so the old text doesn't carry over (isFocused guard in useEffect would skip it)
      inputRef.current?.clear();
      setCurrentIndex(currentIndex + 1);
      setAnswer('');
      setShowResult(false);
      // Block Enter for a short window so the keyup of the same Enter
      // doesn't immediately trigger checkAnswer on the new question
      ignoreEnterRef.current = true;
      setTimeout(() => {
        ignoreEnterRef.current = false;
        requestAnimationFrame(() => inputRef.current?.focus());
      }, 150);
    } else {
      finishExercise();
    }
  }, [currentIndex, processedExercises.length, finishExercise]);

  useEffect(() => {
    if (processedExercises.length === 0) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (ignoreEnterRef.current) return;
      if (e.key === 'Enter' && !showResult) {
        if (answer.trim()) {
          checkAnswer();
        }
      } else if (e.key === 'Enter' && showResult) {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [answer, showResult, processedExercises.length, checkAnswer, handleNext]);

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

  if (exerciseResult) {
    return (
      <ExerciseResultScreen
        result={exerciseResult}
        onRetry={() => {
          setExerciseResult(null);
          resetSession();
          setCurrentIndex(0);
          setAnswer('');
          setShowResult(false);
          processedExercisesRef.current = module?.data
            ? conditionalShuffle(module.data as CompletionData[], randomizeItems)
            : [];
        }}
        onContinue={handleResultContinue}
        t={t}
      />
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
            className={`editable-input ${inputClass.replace(/completion-component__input/g, 'editable-input')}`}
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
              💡 <strong>{t('learning.tip')}</strong>{' '}
              <ContentRenderer
                content={ContentAdapter.ensureStructured(currentExercise.tip, 'explanation')}
              />
            </p>
          </div>
        )}

        <div
          className={`completion-component__sentence-container${
            showResult
              ? answer.toLowerCase().trim() === currentExercise?.correct?.toLowerCase().trim()
                ? ' completion-component__sentence-container--correct'
                : ' completion-component__sentence-container--incorrect'
              : ''
          }`}
        >
          <div className="completion-component__sentence">{renderSentence()}</div>
        </div>

        {/* Result and Explanation - Compact unified section */}
        <div
          className={`completion-component__result-container ${
            showResult
              ? 'completion-component__result-container--visible'
              : 'completion-component__result-container--hidden'
          }`}
          aria-hidden={!showResult}
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
                  - {t('learning.answer')} <strong>{currentExercise?.correct}</strong>
                </span>
              )}
            </div>

            {/* Compact explanation */}
            {showResult &&
              answer.toLowerCase().trim() !== currentExercise?.correct?.toLowerCase().trim() &&
              isTenseError(answer, currentExercise?.correct || '') && (
                <div className="completion-component__tense-hint">
                  <p className="completion-component__tense-hint-text">{t('learning.tenseHint')}</p>
                </div>
              )}
            {showResult &&
              answer.toLowerCase().trim() !== currentExercise?.correct?.toLowerCase().trim() &&
              !isTenseError(answer, currentExercise?.correct || '') &&
              isParticleError(answer, currentExercise?.correct || '') && (
                <div className="completion-component__tense-hint">
                  <p className="completion-component__tense-hint-text">
                    {t('learning.particleHint')}
                  </p>
                </div>
              )}
            {currentExercise?.explanation && (
              <div className="completion-component__explanation">
                <div className="completion-component__explanation-text">
                  <span className="completion-component__explanation-label">
                    {t('learning.explanation')}
                  </span>{' '}
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
          <span className="game-controls__home-icon" aria-hidden="true">
            🏠
          </span>
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
