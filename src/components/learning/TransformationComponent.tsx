import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Check, X, ArrowRight, Home } from 'lucide-react';
import { useLearningSession } from '../../hooks/useLearningSession';
import { conditionalShuffle } from '../../utils/randomUtils';
import '../../styles/components/transformation-component.css';
import '../../styles/components/editable-input.css';
// BEM classes applied dynamically via .replace(): 'editable-input--correct' 'editable-input--incorrect' 'editable-input--neutral' 'editable-input--disabled'
import ContentRenderer from '../ui/ContentRenderer';
import LearningProgressHeader from '../ui/LearningProgressHeader';
import { EditableInput } from '../ui/EditableInput';
import type { EditableInputHandle } from '../ui/EditableInput';
import { ContentAdapter } from '../../utils/contentAdapter';
import { normalizeAnswer } from '../../utils/answerUtils';
import type { LearningModule, TransformationData } from '../../types';

interface TransformationComponentProps {
  module: LearningModule;
}

const TransformationComponent: React.FC<TransformationComponentProps> = ({ module }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [streak, setStreak] = useState(0);
  const inputRef = useRef<EditableInputHandle>(null);
  const ignoreEnterRef = useRef(false);

  const { t, randomizeItems, markCorrect, markIncorrect, finishExercise, handleReturnToMenu } =
    useLearningSession({
      moduleId: module.id,
      moduleName: module.name,
      learningMode: 'transformation',
    });

  const processedExercisesRef = useRef<TransformationData[] | null>(null);
  if (processedExercisesRef.current === null) {
    processedExercisesRef.current = module?.data
      ? conditionalShuffle(module.data as TransformationData[], randomizeItems)
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
      const norm = normalizeAnswer(userAnswer);
      return currentExercise.correct.some(c => normalizeAnswer(c) === norm);
    },
    [currentExercise]
  );

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
      inputRef.current?.clear();
      setCurrentIndex(currentIndex + 1);
      setAnswer('');
      setShowResult(false);
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
      <div className="transformation__no-data">
        <p className="transformation__no-data-text">
          {t('learning.noTransformationExercisesAvailable')}
        </p>
        <button onClick={handleReturnToMenu} className="transformation__no-data-btn">
          {t('navigation.mainMenu')}
        </button>
      </div>
    );
  }

  const hasAnswer = answer.trim().length > 0;
  const correct = showResult && isCorrectAnswer(answer);

  return (
    <div className="transformation__container">
      <LearningProgressHeader
        title={module.name}
        currentIndex={currentIndex}
        totalItems={processedExercises.length}
        mode="transformation"
        helpText={showResult ? t('learning.pressEnterNext') : t('learning.transformInstruction')}
      />

      <div className="transformation__exercise-card" key={currentIndex}>
        {/* Streak badge */}
        {streak >= 2 && (
          <div className="transformation__streak" key={streak}>
            🔥 {streak}
          </div>
        )}

        {/* Instruction / prompt */}
        <h3 className="transformation__instruction">
          <ContentRenderer
            content={ContentAdapter.ensureStructured(currentExercise.prompt, 'quiz')}
          />
        </h3>

        {/* Hint */}
        {currentExercise.hint && (
          <div className="transformation__hint">
            <p className="transformation__hint-text">
              💡 <strong>{t('learning.tip')}</strong>{' '}
              <ContentRenderer
                content={ContentAdapter.ensureStructured(currentExercise.hint, 'explanation')}
              />
            </p>
          </div>
        )}

        {/* Source sentence */}
        <div className="transformation__source">
          <ContentRenderer
            content={ContentAdapter.ensureStructured(currentExercise.source, 'quiz')}
          />
        </div>

        {/* Answer input */}
        <div
          className={`transformation__answer-area${
            showResult
              ? correct
                ? ' transformation__answer-area--correct'
                : ' transformation__answer-area--incorrect'
              : ''
          }`}
        >
          <EditableInput
            ref={inputRef}
            value={answer}
            onChange={setAnswer}
            disabled={showResult}
            placeholder="..."
            className={`editable-input editable-input--fullwidth transformation__input${
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
          className={`transformation__result-container ${
            showResult
              ? 'transformation__result-container--visible'
              : 'transformation__result-container--hidden'
          }`}
          aria-hidden={!showResult}
        >
          <div className="transformation__result">
            <div className="transformation__feedback-row">
              {correct ? (
                <Check className="transformation__feedback-icon transformation__feedback-icon--correct" />
              ) : (
                <X className="transformation__feedback-icon transformation__feedback-icon--incorrect" />
              )}
              <span className="transformation__feedback">
                {correct ? t('common.correct') : t('common.incorrect')}
              </span>
              {!correct && (
                <span className="transformation__correct-answer">
                  - {t('learning.answer')} <strong>{currentExercise.correct[0]}</strong>
                </span>
              )}
            </div>

            {currentExercise.explanation && (
              <div className="transformation__explanation">
                <div className="transformation__explanation-text">
                  <span className="transformation__explanation-label">
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

export default TransformationComponent;
