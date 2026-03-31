import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Check, X, ArrowRight, Home } from 'lucide-react';
import { useLearningSession } from '../../hooks/useLearningSession';
import { conditionalShuffle } from '../../utils/randomUtils';
import '../../styles/components/word-formation-component.css';
import '../../styles/components/editable-input.css';
// BEM classes applied dynamically via .replace(): 'editable-input--correct' 'editable-input--incorrect' 'editable-input--neutral' 'editable-input--disabled'
import ContentRenderer from '../ui/ContentRenderer';
import LearningProgressHeader from '../ui/LearningProgressHeader';
import { EditableInput } from '../ui/EditableInput';
import type { EditableInputHandle } from '../ui/EditableInput';
import { ContentAdapter } from '../../utils/contentAdapter';
import { normalizeAnswer } from '../../utils/answerUtils';
import type { LearningModule, WordFormationData } from '../../types';

interface WordFormationComponentProps {
  module: LearningModule;
}

const WordFormationComponent: React.FC<WordFormationComponentProps> = ({ module }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [showResult, setShowResult] = useState(false);
  const inputRef = useRef<EditableInputHandle>(null);
  const ignoreEnterRef = useRef(false);

  const { t, randomizeItems, markCorrect, markIncorrect, finishExercise, handleReturnToMenu } =
    useLearningSession({
      moduleId: module.id,
      moduleName: module.name,
      learningMode: 'word-formation',
    });

  const processedExercisesRef = useRef<WordFormationData[] | null>(null);
  if (processedExercisesRef.current === null) {
    processedExercisesRef.current = module?.data
      ? conditionalShuffle(module.data as WordFormationData[], randomizeItems)
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
      return normalizeAnswer(userAnswer) === normalizeAnswer(currentExercise.correct);
    },
    [currentExercise]
  );

  const checkAnswer = useCallback(() => {
    if (showResult) return;
    if (isCorrectAnswer(answer)) {
      markCorrect();
    } else {
      markIncorrect();
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
      <div className="word-formation__no-data">
        <p className="word-formation__no-data-text">
          {t('learning.noWordFormationExercisesAvailable')}
        </p>
        <button onClick={handleReturnToMenu} className="word-formation__no-data-btn">
          {t('navigation.mainMenu')}
        </button>
      </div>
    );
  }

  const hasAnswer = answer.trim().length > 0;
  const correct = showResult && isCorrectAnswer(answer);

  return (
    <div className="word-formation__container">
      <LearningProgressHeader
        title={module.name}
        currentIndex={currentIndex}
        totalItems={processedExercises.length}
        mode="word-formation"
        helpText={showResult ? t('learning.pressEnterNext') : t('learning.wordFormationInstruction')}
      />

      <div className="word-formation__exercise-card">
        {/* Sentence with blank */}
        <h3 className="word-formation__sentence">
          <ContentRenderer
            content={ContentAdapter.ensureStructured(currentExercise.sentence, 'quiz')}
          />
        </h3>

        {/* Root word in CAPITALS */}
        <div className="word-formation__root-word">
          <span className="word-formation__root-word-label">{t('learning.rootWord')}</span>
          <span className="word-formation__root-word-value">{currentExercise.rootWord}</span>
        </div>

        {/* Hint */}
        {currentExercise.hint && (
          <div className="word-formation__hint">
            <p className="word-formation__hint-text">
              💡 <strong>{t('learning.tip')}</strong>{' '}
              <ContentRenderer
                content={ContentAdapter.ensureStructured(currentExercise.hint, 'explanation')}
              />
            </p>
          </div>
        )}

        {/* Answer input */}
        <div
          className={`word-formation__answer-area${
            showResult
              ? correct
                ? ' word-formation__answer-area--correct'
                : ' word-formation__answer-area--incorrect'
              : ''
          }`}
        >
          <EditableInput
            ref={inputRef}
            value={answer}
            onChange={setAnswer}
            disabled={showResult}
            placeholder="..."
            className={`editable-input word-formation__input${
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
          className={`word-formation__result-container ${
            showResult
              ? 'word-formation__result-container--visible'
              : 'word-formation__result-container--hidden'
          }`}
          aria-hidden={!showResult}
        >
          <div className="word-formation__result">
            <div className="word-formation__feedback-row">
              {correct ? (
                <Check className="word-formation__feedback-icon word-formation__feedback-icon--correct" />
              ) : (
                <X className="word-formation__feedback-icon word-formation__feedback-icon--incorrect" />
              )}
              <span className="word-formation__feedback">
                {correct ? t('common.correct') : t('common.incorrect')}
              </span>
              {!correct && (
                <span className="word-formation__correct-answer">
                  - {t('learning.answer')} <strong>{currentExercise.correct}</strong>
                </span>
              )}
            </div>

            {currentExercise.explanation && (
              <div className="word-formation__explanation">
                <div className="word-formation__explanation-text">
                  <span className="word-formation__explanation-label">
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

export default WordFormationComponent;
