import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Check, X, ArrowRight } from 'lucide-react';
import { useLearningSession } from '../../hooks/useLearningSession';
import { conditionalShuffle } from '../../utils/randomUtils';
import '../../styles/components/input-exercise-base.css';
import '../../styles/components/word-formation-component.css';
import '../../styles/components/editable-input.css';
// BEM classes applied dynamically via .replace(): 'editable-input--correct' 'editable-input--incorrect' 'editable-input--neutral' 'editable-input--disabled'
import ContentRenderer from '../ui/ContentRenderer';
import LearningProgressHeader from '../ui/LearningProgressHeader';
import ExerciseResultScreen from '../ui/ExerciseResultScreen';
import { EditableInput } from '../ui/EditableInput';
import type { EditableInputHandle } from '../ui/EditableInput';
import { ContentAdapter } from '../../utils/contentAdapter';
import { matchesAnswer } from '../../utils/answerUtils';
import { advanceInputExerciseStep } from '../../utils/exerciseTransition';
import type { LearningModule, WordFormationData } from '../../types';
import { GameControlsExitButton } from '../ui/GameControlsExitButton';
import { GameControlsResetButton } from '../ui/GameControlsResetButton';

interface WordFormationComponentProps {
  module: LearningModule;
}

/** Width in `ch` for inline blanks — scales with content, never clips typed text */
function inlineInputWidthCh(charCount: number, minChars = 5): string {
  const len = Math.max(charCount, minChars);
  return `${Math.ceil(len * 1.05 + 2)}ch`;
}

const BLANK_PATTERN = /_{3}/;

const WordFormationComponent: React.FC<WordFormationComponentProps> = ({ module }) => {
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
      return matchesAnswer(userAnswer, [currentExercise.correct]);
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
            ? conditionalShuffle(module.data as WordFormationData[], randomizeItems)
            : [];
        }}
        onContinue={handleResultContinue}
        t={t}
      />
    );
  }

  const hasAnswer = answer.trim().length > 0;
  const correct = showResult && isCorrectAnswer(answer);

  const renderSentence = () => {
    if (!currentExercise?.sentence) return null;

    const parts = currentExercise.sentence.split(BLANK_PATTERN);
    const elements: React.ReactElement[] = [];

    parts.forEach((part, index) => {
      if (part) {
        elements.push(
          <span key={`text-${index}`} className="word-formation__sentence-text">
            <ContentRenderer content={ContentAdapter.ensureStructured(part, 'quiz')} />
          </span>
        );
      }

      if (index < parts.length - 1) {
        const isCorrect = showResult && isCorrectAnswer(answer);
        const isIncorrect = showResult && answer.trim() && !isCorrect;

        let inputClass = ' editable-input--neutral';
        if (showResult) {
          if (isCorrect) inputClass = ' editable-input--correct';
          else if (isIncorrect) inputClass = ' editable-input--incorrect';
          else inputClass = ' editable-input--disabled';
        }

        const correctLen = (currentExercise.correct || '').trim().length;
        const firstLetter = currentExercise.correct?.charAt(0) || '';
        const placeholderHint = correctLen > 3 && firstLetter ? `${firstLetter}...` : '...';

        const widthSource = showResult
          ? Math.max(answer.length, correctLen)
          : Math.max(answer.length, placeholderHint.replace(/\./g, '').length || 3);

        elements.push(
          <EditableInput
            key={`input-${index}`}
            ref={inputRef}
            value={answer}
            onChange={setAnswer}
            disabled={showResult}
            placeholder={placeholderHint}
            className={`editable-input editable-input--inline${inputClass}`}
            style={{ '--dynamic-width': inlineInputWidthCh(widthSource) } as React.CSSProperties}
            autoFocus={!showResult && index === 0}
          />
        );
      }
    });

    return <>{elements}</>;
  };

  return (
    <div className="word-formation__container">
      <LearningProgressHeader
        title={module.name}
        currentIndex={currentIndex}
        totalItems={processedExercises.length}
        mode="word-formation"
        helpText={
          showResult ? t('learning.pressEnterNext') : t('learning.wordFormationInstruction')
        }
      />

      <div className="word-formation__exercise-card">
        {/* Streak badge */}
        {streak >= 2 && (
          <div className="word-formation__streak" key={streak}>
            🔥 {streak}
          </div>
        )}

        {/* Hint — first so context is visible before the exercise */}
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

        {/* Root word first — then sentence closer to input for easier rewriting */}
        <div className="word-formation__root-word">
          <span className="word-formation__root-word-label">{t('learning.rootWord')}</span>
          <span className="word-formation__root-word-value">{currentExercise.rootWord}</span>
        </div>

        {/* Sentence with inline blank */}
        <h3 className="word-formation__sentence">{renderSentence()}</h3>

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

export default WordFormationComponent;
