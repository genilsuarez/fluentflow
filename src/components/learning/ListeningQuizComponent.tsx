import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle, XCircle, Volume2, ArrowRight, Lightbulb } from 'lucide-react';
import { useLearningSession } from '../../hooks/useLearningSession';
import { useSettingsStore } from '../../stores/settingsStore';
import { conditionalShuffle } from '../../utils/randomUtils';
import { EXERCISE_FEEDBACK_COLLAPSE_MS } from '../../utils/exerciseTransition';
import { ContentAdapter } from '../../utils/contentAdapter';
import ContentRenderer from '../ui/ContentRenderer';
import LearningProgressHeader from '../ui/LearningProgressHeader';
import ExerciseResultScreen from '../ui/ExerciseResultScreen';
import { speak, stopSpeaking, isSpeechAvailable, whenVoicesReady } from '../../utils/speech';

import '../../styles/components/quiz-component.css';

import type { LearningModule, QuizData } from '../../types';
import { GameControlsExitButton } from '../ui/GameControlsExitButton';
import { GameControlsResetButton } from '../ui/GameControlsResetButton';

interface ListeningQuizComponentProps {
  module: LearningModule;
}

const ListeningQuizComponent: React.FC<ListeningQuizComponentProps> = ({ module }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const optionsRef = useRef<HTMLDivElement>(null);

  // Generate a written hint: first letter of each word + blanks (e.g. "W___ d_ y__ d_?")
  function generateHint(text: string): string {
    return text.replace(/[a-zA-Z]+/g, word => {
      if (word.length <= 2) return word[0] + '_';
      return word[0] + '_'.repeat(Math.min(word.length - 1, 3));
    });
  }

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
    learningMode: 'listening-quiz',
  });

  const { theme } = useSettingsStore();

  const processedQuestionsRef = useRef<ReturnType<typeof buildProcessedQuestions> | null>(null);

  function buildProcessedQuestions(data: typeof module.data, shuffle: boolean) {
    if (!data) return [];
    const questions = data as QuizData[];
    const shuffled = conditionalShuffle(questions, shuffle);
    return shuffled.map(question => {
      if (!question.options) return question;
      const correctText =
        typeof question.correct === 'number'
          ? question.options[question.correct]
          : question.correct;
      const processedOptions = conditionalShuffle([...question.options], shuffle);
      return {
        ...question,
        options: processedOptions,
        correct: correctText,
      };
    });
  }

  if (processedQuestionsRef.current === null) {
    processedQuestionsRef.current = buildProcessedQuestions(module?.data, randomizeItems);
  }

  const processedQuestions = processedQuestionsRef.current;
  const isDark = theme === 'dark';
  const textColor = isDark ? 'white' : '#111827';
  const currentQuestion = processedQuestions[currentIndex];

  // Auto-play on question change
  const playQuestion = useCallback(() => {
    if (!currentQuestion) return;
    const text = currentQuestion.question || currentQuestion.sentence || '';
    setIsPlaying(true);
    speak(text, { rate: 0.85 });
    setTimeout(() => setIsPlaying(false), Math.max(text.length * 80, 2000));
  }, [currentQuestion]);

  useEffect(() => {
    if (!currentQuestion || showResult) return;
    let cancelled = false;
    void whenVoicesReady().then(() => {
      if (!cancelled) playQuestion();
    });
    return () => {
      cancelled = true;
    };
  }, [currentIndex, currentQuestion, showResult, playQuestion]);

  // Cleanup speech on unmount
  useEffect(() => () => stopSpeaking(), []);

  // Equalize option heights
  useEffect(() => {
    const container = optionsRef.current;
    if (!container) return;
    const buttons = container.querySelectorAll<HTMLButtonElement>('.quiz-component__option');
    buttons.forEach(b => (b.style.minHeight = ''));
    const maxH = Math.max(...Array.from(buttons).map(b => b.offsetHeight));
    if (maxH > 0) buttons.forEach(b => (b.style.minHeight = `${maxH}px`));
  }, [currentIndex]);

  const handleAnswerSelect = useCallback(
    (optionIndex: number) => {
      if (showResult || !currentQuestion) return;
      const selectedAnswerText = currentQuestion.options?.[optionIndex];
      const isCorrect = selectedAnswerText === currentQuestion.correct;
      setSelectedAnswer(optionIndex);
      setShowResult(true);
      if (isCorrect) markCorrect();
      else markIncorrect();
    },
    [showResult, currentQuestion, markCorrect, markIncorrect]
  );

  const handleNext = useCallback(() => {
    if (currentIndex < processedQuestions.length - 1) {
      setShowResult(false);
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
        setSelectedAnswer(null);
        setShowHint(false);
      }, EXERCISE_FEEDBACK_COLLAPSE_MS);
    } else {
      finishExercise();
    }
  }, [currentIndex, processedQuestions.length, finishExercise]);

  // Keyboard shortcuts
  useEffect(() => {
    if (processedQuestions.length === 0) return;
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key >= '1' && e.key <= '4' && !showResult && currentQuestion) {
        const idx = parseInt(e.key) - 1;
        if (idx < (currentQuestion.options?.length || 0)) handleAnswerSelect(idx);
      } else if (e.key === 'Enter' && showResult) handleNext();
      else if (e.key === ' ' && !showResult) {
        e.preventDefault();
        playQuestion();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [
    showResult,
    currentQuestion,
    processedQuestions.length,
    handleAnswerSelect,
    handleNext,
    playQuestion,
  ]);

  if (!processedQuestions.length) {
    return (
      <div className="quiz-component__no-data">
        <p className="quiz-component__no-data-text">{t('learning.noQuizQuestions')}</p>
        <button onClick={handleReturnToMenu} className="quiz-component__no-data-btn">
          {t('learning.backToMenu')}
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
          setSelectedAnswer(null);
          setShowResult(false);
          processedQuestionsRef.current = buildProcessedQuestions(module?.data, randomizeItems);
        }}
        onContinue={handleResultContinue}
        t={t}
      />
    );
  }

  const ttsAvailable = isSpeechAvailable();

  return (
    <div className="quiz-component__container">
      <LearningProgressHeader
        title={module.name}
        currentIndex={currentIndex}
        totalItems={processedQuestions.length}
        mode="listening-quiz"
        helpText={
          showResult ? t('learning.pressEnterNext') : 'Listen and choose the correct answer'
        }
      />

      {/* Audio prompt — question text is hidden, replaced by listen button */}
      <div className="quiz-component__question-card">
        {ttsAvailable ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0',
            }}
          >
            <button
              onClick={playQuestion}
              aria-label="Play audio"
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                border: '2px solid var(--lp-primary, #3d6b9f)',
                background: 'var(--lp-primary-soft, rgba(59,130,246,0.08))',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                transform: isPlaying ? 'scale(1.06)' : 'scale(1)',
              }}
            >
              <Volume2 size={24} color="var(--lp-primary, #3d6b9f)" />
            </button>
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                color: 'var(--lp-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {isPlaying ? 'Playing…' : 'Tap to listen'}
            </span>

            {/* Hint toggle — only before answering */}
            {!showResult && (
              <button
                onClick={() => setShowHint(h => !h)}
                aria-label={showHint ? 'Hide tip' : 'Show tip'}
                className="quiz-component__hint-toggle"
              >
                <Lightbulb size={14} />
                <span>{showHint ? 'Hide tip' : 'Show tip'}</span>
              </button>
            )}

            {/* Hint text */}
            {showHint && !showResult && (
              <p className="quiz-component__hint-text">
                {(currentQuestion as QuizData & { hint?: string })?.hint ||
                  generateHint(currentQuestion?.question || currentQuestion?.sentence || '')}
              </p>
            )}
          </div>
        ) : (
          // Fallback: show text if TTS not available
          <h3
            className="quiz-component__question-title dynamic-text-color"
            style={{ '--dynamic-text-color': textColor } as React.CSSProperties}
          >
            <ContentRenderer
              content={ContentAdapter.ensureStructured(
                currentQuestion?.question || currentQuestion?.sentence || '',
                'quiz'
              )}
            />
          </h3>
        )}

        {/* Show the text after answering for learning */}
        {showResult && (
          <p
            style={{
              fontSize: '0.8rem',
              fontWeight: 500,
              color: textColor,
              textAlign: 'center',
              marginTop: '0.25rem',
              opacity: 0.85,
            }}
          >
            {currentQuestion?.question || currentQuestion?.sentence}
          </p>
        )}

        {/* Options */}
        <div ref={optionsRef} className="quiz-component__options">
          {(currentQuestion?.options || []).map((option, index) => {
            let buttonClass = 'quiz-component__option';
            if (showResult) {
              if (currentQuestion?.options[index] === currentQuestion?.correct)
                buttonClass += ' quiz-component__option--correct';
              else if (
                index === selectedAnswer &&
                currentQuestion?.options[index] !== currentQuestion?.correct
              )
                buttonClass += ' quiz-component__option--incorrect';
              else buttonClass += ' quiz-component__option--disabled';
            }
            return (
              <button
                key={index}
                onClick={() => handleAnswerSelect(index)}
                disabled={showResult}
                className={buttonClass}
              >
                <div className="quiz-component__option-content">
                  <div className="quiz-component__option-left">
                    <span className="quiz-component__option-number">{index + 1}</span>
                    <span
                      className="quiz-component__option-text dynamic-text-color"
                      style={{ '--dynamic-text-color': textColor } as React.CSSProperties}
                    >
                      <ContentRenderer content={ContentAdapter.ensureStructured(option, 'quiz')} />
                    </span>
                  </div>
                  {showResult && (
                    <div>
                      {currentQuestion?.options[index] === currentQuestion?.correct && (
                        <CheckCircle className="quiz-component__option-icon quiz-component__option-icon--correct" />
                      )}
                      {index === selectedAnswer &&
                        currentQuestion?.options[index] !== currentQuestion?.correct && (
                          <XCircle className="quiz-component__option-icon quiz-component__option-icon--incorrect" />
                        )}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Explanation after answering */}
        {showResult && currentQuestion?.explanation && (
          <div className="quiz-component__explanation">
            <ContentRenderer
              content={ContentAdapter.ensureStructured(currentQuestion.explanation, 'explanation')}
            />
          </div>
        )}
      </div>

      {/* Unified Control Bar */}
      <div className="game-controls">
        <GameControlsExitButton
          onClick={handleReturnToMenu}
          title={t('learning.returnToMainMenu')}
        />
        <GameControlsResetButton onClick={triggerRestart} title={t('common.reset')} />
        <button onClick={handleNext} disabled={!showResult} className="game-controls__primary-btn">
          <span>
            {currentIndex < processedQuestions.length - 1
              ? t('learning.nextQuestion')
              : t('learning.finishQuiz')}
          </span>
          <ArrowRight className="game-controls__primary-icon" />
        </button>
      </div>
    </div>
  );
};

export default ListeningQuizComponent;
