import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Check, X, ArrowRight } from 'lucide-react';
import { useLearningSession } from '../../hooks/useLearningSession';
import { conditionalShuffle } from '../../utils/randomUtils';
import '../../styles/components/input-exercise-base.css';
import '../../styles/components/error-correction-component.css';
import '../../styles/components/editable-input.css';
// BEM classes applied dynamically via .replace(): 'editable-input--correct' 'editable-input--incorrect' 'editable-input--neutral' 'editable-input--disabled' 'editable-input--fullwidth'
import ContentRenderer from '../ui/ContentRenderer';
import LearningProgressHeader from '../ui/LearningProgressHeader';
import ExerciseResultScreen from '../ui/ExerciseResultScreen';
import { EditableInput } from '../ui/EditableInput';
import type { EditableInputHandle } from '../ui/EditableInput';
import { ContentAdapter } from '../../utils/contentAdapter';
import { matchesAnswer } from '../../utils/answerUtils';
import { advanceInputExerciseStep } from '../../utils/exerciseTransition';
import type { LearningModule, ErrorCorrectionData } from '../../types';
import { GameControlsExitButton } from '../ui/GameControlsExitButton';
import { GameControlsResetButton } from '../ui/GameControlsResetButton';

interface ErrorCorrectionComponentProps {
  module: LearningModule;
}

const ErrorCorrectionComponent: React.FC<ErrorCorrectionComponentProps> = ({ module }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [streak, setStreak] = useState(0);
  const inputRef = useRef<EditableInputHandle>(null);
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
    triggerRestart,
  } = useLearningSession({
    moduleId: module.id,
    moduleName: module.name,
    learningMode: 'error-correction',
  });

  const processedExercisesRef = useRef<ErrorCorrectionData[] | null>(null);
  if (processedExercisesRef.current === null) {
    processedExercisesRef.current = module?.data
      ? conditionalShuffle(module.data as ErrorCorrectionData[], randomizeItems)
      : [];
  }
  const processedExercises = processedExercisesRef.current;
  const currentExercise = processedExercises[currentIndex];

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const isCorrectAnswer = useCallback(
    (userAnswer: string): boolean => {
      if (!currentExercise?.correct) return false;
      return matchesAnswer(userAnswer, currentExercise.correct);
    },
    [currentExercise]
  );

  // Detect "trap" sentences: original sentence is already correct (no error to fix)
  const isTrapSentence = currentExercise
    ? matchesAnswer(currentExercise.sentence, currentExercise.correct)
    : false;

  const checkAnswer = useCallback(() => {
    if (showResult) return;
    if (isCorrectAnswer(answer)) {
      markCorrect();
      setStreak(s => s + 1);
    } else {
      markIncorrect();
      setStreak(0);
    }
    setShowResult(true);
  }, [showResult, answer, isCorrectAnswer, markCorrect, markIncorrect]);

  const handleNext = useCallback(() => {
    if (currentIndex < processedExercises.length - 1) {
      advanceInputExerciseStep({
        setCurrentIndex,
        setAnswer,
        setShowResult,
        ignoreEnterRef,
        focusInput: () => inputRef.current?.focus(),
      });
    } else {
      finishExercise();
    }
  }, [currentIndex, processedExercises.length, finishExercise]);

  useEffect(() => {
    if (processedExercises.length === 0) return;
    const handleKeyPress = (e: KeyboardEvent) => {
      if (ignoreEnterRef.current) return;
      if (e.key === 'Enter' && !showResult && answer.trim()) {
        checkAnswer();
      } else if (e.key === 'Enter' && showResult) {
        handleNext();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [answer, showResult, processedExercises.length, checkAnswer, handleNext]);

  if (!processedExercises.length) {
    return (
      <div className="error-correction__no-data">
        <p className="error-correction__no-data-text">
          {t('learning.noErrorCorrectionExercisesAvailable')}
        </p>
        <button onClick={handleReturnToMenu} className="error-correction__no-data-btn">
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
          setStreak(0);
          processedExercisesRef.current = module?.data
            ? conditionalShuffle(module.data as ErrorCorrectionData[], randomizeItems)
            : [];
        }}
        onContinue={handleResultContinue}
        t={t}
      />
    );
  }

  const hasAnswer = answer.trim().length > 0;
  const correct = showResult && isCorrectAnswer(answer);

  return (
    <div className="error-correction__container">
      <LearningProgressHeader
        title={module.name}
        currentIndex={currentIndex}
        totalItems={processedExercises.length}
        mode="error-correction"
        helpText={
          showResult ? t('learning.pressEnterNext') : t('learning.errorCorrectionInstruction')
        }
      />

      <div className="error-correction__exercise-card">
        {/* Streak badge */}
        {streak >= 2 && (
          <div className="error-correction__streak" key={streak}>
            🔥 {streak}
          </div>
        )}

        {/* Error sentence — visually distinct with red-tinted styling */}
        <div className="error-correction__error-sentence">
          <ContentRenderer
            content={ContentAdapter.ensureStructured(currentExercise.sentence, 'quiz')}
          />
        </div>

        {/* Hint */}
        {currentExercise.hint && (
          <div className="error-correction__hint">
            <p className="error-correction__hint-text">
              💡 <strong>{t('learning.tip')}</strong>{' '}
              <ContentRenderer
                content={ContentAdapter.ensureStructured(currentExercise.hint, 'explanation')}
              />
            </p>
          </div>
        )}

        {/* Answer input */}
        <div
          className={`error-correction__answer-area${
            showResult
              ? correct
                ? ' error-correction__answer-area--correct'
                : ' error-correction__answer-area--incorrect'
              : ''
          }`}
        >
          <EditableInput
            ref={inputRef}
            value={answer}
            onChange={setAnswer}
            disabled={showResult}
            placeholder="..."
            className={`editable-input editable-input--fullwidth error-correction__input${
              showResult
                ? correct
                  ? ' editable-input--correct'
                  : ' editable-input--incorrect'
                : ' editable-input--neutral'
            }`}
            autoFocus={!showResult}
          />
        </div>

        {/* Result feedback */}
        <div
          className={`error-correction__result-container ${
            showResult
              ? 'error-correction__result-container--visible'
              : 'error-correction__result-container--hidden'
          }`}
          aria-hidden={!showResult}
        >
          <div className="error-correction__result">
            <div className="error-correction__feedback-row">
              {correct ? (
                <Check className="error-correction__feedback-icon error-correction__feedback-icon--correct" />
              ) : (
                <X className="error-correction__feedback-icon error-correction__feedback-icon--incorrect" />
              )}
              <span className="error-correction__feedback">
                {correct ? t('common.correct') : t('common.incorrect')}
              </span>
              {!correct && (
                <span className="error-correction__correct-answer">
                  - {t('learning.answer')} <strong>{currentExercise.correct[0]}</strong>
                </span>
              )}
            </div>

            {/* Trap hint: sentence was already correct but user changed it */}
            {!correct && isTrapSentence && (
              <div className="error-correction__trap-hint">
                {t('learning.errorCorrectionTrapHint')}
              </div>
            )}

            {currentExercise.explanation && (
              <div className="error-correction__explanation">
                <div className="error-correction__explanation-text">
                  <span className="error-correction__explanation-label">
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

      {/* Control bar */}
      <div className="game-controls">
        <GameControlsExitButton
          onClick={handleReturnToMenu}
          title={t('learning.returnToMainMenu')}
        />
        <GameControlsResetButton onClick={triggerRestart} title={t('common.reset')} />

        {!showResult ? (
          <button
            onClick={checkAnswer}
            disabled={!hasAnswer}
            className="game-controls__primary-btn"
          >
            <Check className="game-controls__primary-icon" />
            <span>{t('learning.checkAnswer')}</span>
          </button>
        ) : (
          <button onClick={handleNext} className="game-controls__primary-btn">
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

export default ErrorCorrectionComponent;
