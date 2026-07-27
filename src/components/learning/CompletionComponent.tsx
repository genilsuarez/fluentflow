import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Check, X, ArrowRight } from 'lucide-react';
import { useLearningSession } from '../../hooks/useLearningSession';
import { conditionalShuffle } from '../../utils/randomUtils';
import {
  matchesAnswer,
  isTenseError,
  isParticleError,
  isNoArticleAnswer,
  formatCorrectAnswerForDisplay,
  normalizeAnswer,
} from '../../utils/answerUtils';
import {
  advanceInputExerciseStep,
  EXERCISE_RESULT_ENTER_GUARD_MS,
} from '../../utils/exerciseTransition';
import '../../styles/components/completion-component.css';
import '../../styles/components/editable-input.css';
// BEM classes applied dynamically via .replace(): 'editable-input--correct' 'editable-input--incorrect' 'editable-input--neutral' 'editable-input--disabled'
import { ContentAdapter } from '../../utils/contentAdapter';
import ContentRenderer from '../ui/ContentRenderer';
import LearningProgressHeader from '../ui/LearningProgressHeader';
import ExerciseResultScreen from '../ui/ExerciseResultScreen';
import { EditableInput } from '../ui/EditableInput';
import type { EditableInputHandle } from '../ui/EditableInput';

import type { LearningModule, CompletionData } from '../../types';
import { countBlanks, splitOnBlanks } from '../../utils/blankMarker';
import { gapBlankCharCount, inlineBlankWidthCh } from '../../utils/inlineBlankWidth';
import { GameControlsExitButton } from '../ui/GameControlsExitButton';
import { GameControlsResetButton } from '../ui/GameControlsResetButton';

interface CompletionComponentProps {
  module: LearningModule;
}

function emptyAnswers(blankCount: number): string[] {
  return Array.from({ length: Math.max(blankCount, 1) }, () => '');
}

/** Multi-blank exercises store answers comma-separated: "The, the" */
function parseCorrectParts(correct: string, blankCount: number): string[] {
  if (blankCount <= 1) return [correct.trim()];
  const parts = correct.split(',').map(part => part.trim());
  while (parts.length < blankCount) parts.push('');
  return parts.slice(0, blankCount);
}

function matchesAllBlanks(answers: string[], correctParts: string[]): boolean {
  if (!correctParts.length) return false;
  return correctParts.every((correct, index) => matchesAnswer(answers[index] || '', [correct]));
}

function isBlankAnswered(userAnswer: string, correctForGap: string): boolean {
  if (normalizeAnswer(userAnswer).length > 0) return true;
  return isNoArticleAnswer(correctForGap);
}

function allBlanksAnswered(answers: string[], correctParts: string[]): boolean {
  return correctParts.every((correct, index) => isBlankAnswered(answers[index] || '', correct));
}

function gapPlaceholder(correctForGap: string, sentence: string, showPlaceholder: boolean): string {
  if (!showPlaceholder) return '';
  if (isNoArticleAnswer(correctForGap)) return '—';
  const trimmed = correctForGap.trim();
  const correctLen = trimmed.length;
  const firstLetter = trimmed.charAt(0) || '';
  const hasBaseWordInSentence = /\([a-zA-Z]/.test(sentence);
  if (!firstLetter || hasBaseWordInSentence) return '...';
  // Short articles (the, a, an) and longer words both get a first-letter hint
  if (correctLen >= 2) return `${firstLetter.toLowerCase()}...`;
  return '...';
}

const CompletionComponent: React.FC<CompletionComponentProps> = ({ module }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>(['']);
  const [showResult, setShowResult] = useState(false);
  const inputRef = useRef<EditableInputHandle>(null);
  const inputRefs = useRef<(EditableInputHandle | null)[]>([]);
  const focusedGapRef = useRef(0);
  const gapRefCallbacksRef = useRef(
    new Map<number, (el: EditableInputHandle | null) => void>()
  );
  const answersRef = useRef(answers);
  const showResultRef = useRef(showResult);
  showResultRef.current = showResult;
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
    triggerRestart,
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
  const sentenceParts = splitOnBlanks(currentExercise?.sentence || '');
  const blankCount = Math.max(sentenceParts.length - 1, 0);
  const correctParts = parseCorrectParts(currentExercise?.correct || '', blankCount);
  const joinedAnswer = answers.join(', ');
  const hasNoArticleGap = correctParts.some(isNoArticleAnswer);
  const noArticleLabel = t('learning.noArticle');
  const showGapPlaceholders = currentExercise?.showPlaceholder !== false;

  const collectCurrentAnswers = useCallback((gapTotal: number) => {
    return Array.from({ length: gapTotal }, (_, gapIndex) => {
      const fromDom = inputRefs.current[gapIndex]?.getValue?.() ?? '';
      const fromRef = answersRef.current[gapIndex] ?? '';
      return (fromDom || fromRef).toLowerCase().trim();
    });
  }, []);

  const blurAllGaps = useCallback(() => {
    inputRefs.current.forEach(ref => ref?.blur());
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, []);

  const getGapRef = useCallback((gapIndex: number) => {
    let callback = gapRefCallbacksRef.current.get(gapIndex);
    if (!callback) {
      callback = (el: EditableInputHandle | null) => {
        inputRefs.current[gapIndex] = el;
        if (gapIndex === 0) {
          (inputRef as React.MutableRefObject<EditableInputHandle | null>).current = el;
        }
      };
      gapRefCallbacksRef.current.set(gapIndex, callback);
    }
    return callback;
  }, []);

  const focusGap = useCallback((gapIndex: number) => {
    focusedGapRef.current = gapIndex;
    requestAnimationFrame(() => {
      inputRefs.current[gapIndex]?.focus();
    });
  }, []);

  const handleGapTab = useCallback(
    (fromIndex: number, direction: 'next' | 'prev') => {
      if (showResultRef.current) return;
      if (blankCount <= 1) {
        focusGap(0);
        return;
      }
      const delta = direction === 'prev' ? -1 : 1;
      const next = (fromIndex + delta + blankCount) % blankCount;
      focusGap(next);
    },
    [blankCount, focusGap]
  );

  const helpText = showResult
    ? t('learning.pressEnterNext')
    : hasNoArticleGap
      ? t('learning.fillBlankArticles')
      : blankCount > 1
        ? t('learning.fillBlankMulti')
        : !showGapPlaceholders
          ? t('learning.fillBlankNoHint')
          : t('learning.fillBlank');

  const resetAnswersForExercise = useCallback((exercise?: CompletionData) => {
    const next = emptyAnswers(countBlanks(exercise?.sentence || ''));
    answersRef.current = next;
    setAnswers(next);
  }, []);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    resetAnswersForExercise(processedExercises[currentIndex]);
    inputRefs.current = inputRefs.current.slice(0, blankCount);
    focusedGapRef.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when advancing exercises
  }, [currentIndex]);

  const checkAnswer = useCallback(() => {
    if (showResultRef.current) return;

    blurAllGaps();
    const flushed = collectCurrentAnswers(blankCount);
    answersRef.current = flushed;
    setAnswers(flushed);

    const isCorrect = matchesAllBlanks(flushed, correctParts);

    if (isCorrect) {
      markCorrect();
    } else {
      markIncorrect();
    }
    showResultRef.current = true;
    setShowResult(true);
    // Block the window Enter listener from advancing on the same keypress (mobile double-fire)
    ignoreEnterRef.current = true;
    window.setTimeout(() => {
      ignoreEnterRef.current = false;
    }, EXERCISE_RESULT_ENTER_GUARD_MS);
  }, [blankCount, blurAllGaps, collectCurrentAnswers, correctParts, markCorrect, markIncorrect]);

  const handleNext = useCallback(() => {
    showResultRef.current = false;
    if (currentIndex < processedExercises.length - 1) {
      const nextExercise = processedExercises[currentIndex + 1];
      advanceInputExerciseStep({
        setCurrentIndex,
        setShowResult,
        ignoreEnterRef,
        focusInput: () => inputRef.current?.focus(),
        resetAnswer: () => resetAnswersForExercise(nextExercise),
      });
    } else {
      finishExercise();
    }
  }, [currentIndex, processedExercises, finishExercise, resetAnswersForExercise]);

  useEffect(() => {
    if (processedExercises.length === 0) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (ignoreEnterRef.current) return;
      if (e.key === 'Enter' && !showResultRef.current) {
        const current = collectCurrentAnswers(blankCount);
        answersRef.current = current;
        if (allBlanksAnswered(current, correctParts)) {
          checkAnswer();
        }
      } else if (e.key === 'Enter' && showResultRef.current) {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [processedExercises.length, blankCount, correctParts, collectCurrentAnswers, checkAnswer, handleNext]);

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
          resetAnswersForExercise(processedExercises[0]);
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

    const parts = splitOnBlanks(currentExercise.sentence);
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
        const gapIndex = elements.filter(el => el.key?.toString().startsWith('input-')).length;
        const gapValue = answers[gapIndex] || '';
        const correctForGap = correctParts[gapIndex] || '';
        const gapCorrect = showResult && matchesAnswer(gapValue, [correctForGap]);

        let inputClass = 'completion-component__input';
        if (showResult) {
          if (gapCorrect) {
            inputClass += ' completion-component__input--correct';
          } else {
            inputClass += ' completion-component__input--incorrect';
          }
        } else {
          inputClass += ' completion-component__input--neutral';
        }

        const placeholderHint = gapPlaceholder(
          correctForGap,
          currentExercise.sentence || '',
          showGapPlaceholders
        );

        const hintLen = showGapPlaceholders
          ? placeholderHint.replace(/\./g, '').length || 3
          : 4;
        const correctReservedLen = isNoArticleAnswer(correctForGap)
          ? Math.max(noArticleLabel.length, 1)
          : correctForGap.trim().length;

        const widthSource = gapBlankCharCount({
          typedLength: gapValue.length,
          correctLength: correctReservedLen,
          hintLength: hintLen,
        });

        const blankAriaLabel = t('learning.blankLabel', undefined, {
          current: gapIndex + 1,
          total: blankCount,
        });

        elements.push(
          <EditableInput
            key={`input-${index}`}
            ref={getGapRef(gapIndex)}
            value={gapValue}
            onChange={value => {
              setAnswers(prev => {
                const next = [...prev];
                while (next.length <= gapIndex) next.push('');
                next[gapIndex] = value.toLowerCase();
                answersRef.current = next;
                return next;
              });
            }}
            disabled={showResult}
            placeholder={placeholderHint}
            ariaLabel={blankAriaLabel}
            className={`editable-input editable-input--inline ${inputClass.replace(/completion-component__input/g, 'editable-input')}`}
            style={
              {
                '--dynamic-width': inlineBlankWidthCh(widthSource),
                textTransform: 'lowercase',
              } as React.CSSProperties
            }
            autoFocus={!showResult && gapIndex === 0}
            onFocus={() => {
              focusedGapRef.current = gapIndex;
            }}
            onEnter={() => {
              if (ignoreEnterRef.current) return;
              if (showResultRef.current) {
                handleNext();
                return;
              }
              const current = collectCurrentAnswers(blankCount);
              answersRef.current = current;
              if (allBlanksAnswered(current, correctParts)) {
                checkAnswer();
              }
            }}
            onTab={showResult ? undefined : direction => handleGapTab(gapIndex, direction)}
          />
        );
      }
    });

    return <>{elements}</>;
  };

  const liveAnswers = collectCurrentAnswers(blankCount);
  const hasAnswer = allBlanksAnswered(liveAnswers, correctParts);
  const isAnswerCorrect = showResult && matchesAllBlanks(answers, correctParts);
  const formattedCorrect = formatCorrectAnswerForDisplay(
    currentExercise?.correct || '',
    noArticleLabel
  );

  return (
    <div className="completion-component__container">
      {/* Unified progress header */}
      <LearningProgressHeader
        title={module.name}
        currentIndex={currentIndex}
        totalItems={processedExercises.length}
        mode="completion"
        helpText={helpText}
      />

      {/* Exercise */}
      <div className="completion-component__exercise-card">
        <h3 className="completion-component__instruction">{t('learning.completeSentence')}</h3>

        {currentExercise?.tip && (
          <div className="completion-component__tip">
            <p className="completion-component__tip-text">
              <strong>{t('learning.tip')}</strong>{' '}
              <ContentRenderer
                content={ContentAdapter.ensureStructured(currentExercise.tip, 'explanation')}
              />
            </p>
          </div>
        )}

        <div
          className={`completion-component__sentence-container${
            showResult
              ? isAnswerCorrect
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
          {showResult && (
            <div
              className={`completion-component__result${
                isAnswerCorrect
                  ? ' completion-component__result--correct'
                  : ' completion-component__result--incorrect'
              }`}
            >
              {/* Ultra-compact result feedback */}
              <div className="completion-component__feedback-row">
                {isAnswerCorrect ? (
                  <Check className="completion-component__feedback-icon completion-component__feedback-icon--correct" />
                ) : (
                  <X className="completion-component__feedback-icon completion-component__feedback-icon--incorrect" />
                )}
                <span className="completion-component__feedback">
                  {isAnswerCorrect ? t('common.correct') : t('common.incorrect')}
                </span>

                {/* Correct answer flows naturally after incorrect */}
                {!isAnswerCorrect && (
                  <span className="completion-component__correct-answer">
                    - {t('learning.answer')} <strong>{formattedCorrect}</strong>
                  </span>
                )}
              </div>

              {/* Compact explanation */}
              {!isAnswerCorrect && isTenseError(joinedAnswer, currentExercise?.correct || '') && (
                <div className="completion-component__tense-hint">
                  <p className="completion-component__tense-hint-text">{t('learning.tenseHint')}</p>
                </div>
              )}
              {!isAnswerCorrect &&
                !isTenseError(joinedAnswer, currentExercise?.correct || '') &&
                isParticleError(joinedAnswer, currentExercise?.correct || '') && (
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
          )}
        </div>
      </div>

      {/* Unified Control Bar */}
      <div className="game-controls">
        {/* Home Navigation */}
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

export default CompletionComponent;
