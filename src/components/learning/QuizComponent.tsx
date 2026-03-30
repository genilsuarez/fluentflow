import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle, XCircle, ArrowRight, Home } from 'lucide-react';
import { useLearningSession } from '../../hooks/useLearningSession';
import { useSettingsStore } from '../../stores/settingsStore';
import { conditionalShuffle } from '../../utils/randomUtils';
import { ContentAdapter } from '../../utils/contentAdapter';
import ContentRenderer from '../ui/ContentRenderer';
import LearningProgressHeader from '../ui/LearningProgressHeader';

import type { LearningModule, QuizData } from '../../types';

interface QuizComponentProps {
  module: LearningModule;
}

const QuizComponent: React.FC<QuizComponentProps> = ({ module }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const optionsRef = useRef<HTMLDivElement>(null);

  const { t, randomizeItems, markCorrect, markIncorrect, finishExercise, handleReturnToMenu } =
    useLearningSession({
      moduleId: module.id,
      moduleName: module.name,
      learningMode: 'quiz',
    });

  const { theme } = useSettingsStore();

  // Compute processed questions once on mount — stored in a ref so that
  // re-renders triggered by score updates never re-shuffle the options.
  const processedQuestionsRef = useRef<ReturnType<typeof buildProcessedQuestions> | null>(null);

  // Prevent length-based guessing by padding shorter distractors when the
  // correct answer is noticeably longer than every other option.
  const PAD_SUFFIXES = [
    'in this context',
    'in most cases',
    'as commonly used',
    'in general terms',
    'by definition',
    'in everyday use',
    'as typically meant',
    'in standard usage',
    'as generally understood',
    'in the usual sense',
    'as widely accepted',
    'in practical terms',
    'in conventional terms',
    'as commonly defined',
    'in the standard sense',
    'in the broadest sense',
  ];
  let padCursor = 0;

  function balanceOptionLengths(options: string[], correctText: string): string[] {
    const correctLen = correctText.length;
    const maxDistractorLen = Math.max(...options.filter(o => o !== correctText).map(o => o.length));
    // Only act when correct is clearly the longest (>3 chars gap)
    if (correctLen - maxDistractorLen <= 3) return options;

    return options.map(opt => {
      if (opt === correctText || opt.length >= correctLen - 2) return opt;
      if (/[.!?;:]$/.test(opt)) return opt; // skip punctuated sentences
      const suffix = PAD_SUFFIXES[padCursor++ % PAD_SUFFIXES.length];
      return `${opt} ${suffix}`;
    });
  }

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
        options: balanceOptionLengths(processedOptions, correctText),
        correct: correctText,
      };
    });
  }

  if (processedQuestionsRef.current === null) {
    processedQuestionsRef.current = buildProcessedQuestions(module?.data, randomizeItems);
  }

  const processedQuestions = processedQuestionsRef.current;

  // Equalize option button heights to prevent length-based visual bias
  useEffect(() => {
    const container = optionsRef.current;
    if (!container) return;
    const buttons = container.querySelectorAll<HTMLButtonElement>('.quiz-component__option');
    buttons.forEach(b => (b.style.minHeight = ''));
    const maxH = Math.max(...Array.from(buttons).map(b => b.offsetHeight));
    if (maxH > 0) buttons.forEach(b => (b.style.minHeight = `${maxH}px`));
  }, [currentIndex]);

  const isDark = theme === 'dark';
  const textColor = isDark ? 'white' : '#111827';

  const currentQuestion = processedQuestions[currentIndex];

  const handleAnswerSelect = useCallback(
    (optionIndex: number) => {
      if (showResult || !currentQuestion) return;

      const selectedAnswerText = currentQuestion.options?.[optionIndex];
      const isCorrect = selectedAnswerText === currentQuestion.correct;

      setSelectedAnswer(optionIndex);
      setShowResult(true);

      if (isCorrect) {
        markCorrect();
      } else {
        markIncorrect();
      }
    },
    [showResult, currentQuestion, markCorrect, markIncorrect]
  );

  const handleNext = useCallback(() => {
    if (currentIndex < processedQuestions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    } else {
      finishExercise();
    }
  }, [currentIndex, processedQuestions.length, finishExercise]);

  useEffect(() => {
    if (processedQuestions.length === 0) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key >= '1' && e.key <= '4' && !showResult && currentQuestion) {
        const optionIndex = parseInt(e.key) - 1;
        if (optionIndex < (currentQuestion.options?.length || 0)) {
          handleAnswerSelect(optionIndex);
        }
      } else if (e.key === 'Enter' && showResult) {
        handleNext();
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
  ]);

  // Early return if no data
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

  return (
    <div className="quiz-component__container">
      {/* Unified progress header */}
      <LearningProgressHeader
        title={module.name}
        currentIndex={currentIndex}
        totalItems={processedQuestions.length}
        mode="quiz"
        helpText={showResult ? t('learning.pressEnterNext') : t('learning.pressSelectOption')}
      />

      {/* Question */}
      <div className="quiz-component__question-card">
        <h3
          className="quiz-component__question-title dynamic-text-color"
          style={{ '--dynamic-text-color': textColor } as React.CSSProperties}
        >
          <ContentRenderer
            content={ContentAdapter.ensureStructured(
              currentQuestion?.question ||
                currentQuestion?.sentence ||
                t('learning.loadingQuestion'),
              'quiz'
            )}
          />
        </h3>

        {/* Options */}
        <div ref={optionsRef} className="quiz-component__options">
          {(currentQuestion?.options || []).map((option, index) => {
            let buttonClass = 'quiz-component__option';

            if (showResult) {
              if (currentQuestion?.options[index] === currentQuestion?.correct) {
                buttonClass += ' quiz-component__option--correct';
              } else if (
                index === selectedAnswer &&
                currentQuestion?.options[index] !== currentQuestion?.correct
              ) {
                buttonClass += ' quiz-component__option--incorrect';
              } else {
                buttonClass += ' quiz-component__option--disabled';
              }
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

        {/* Explanation - Always present with smooth transition */}
        <div
          className={`quiz-component__explanation-container ${
            showResult && currentQuestion?.explanation
              ? 'quiz-component__explanation-container--visible'
              : 'quiz-component__explanation-container--hidden'
          }`}
          aria-hidden={!(showResult && currentQuestion?.explanation)}
        >
          <div className="quiz-component__explanation">
            <h4
              className="quiz-component__explanation-title dynamic-text-color"
              style={{ '--dynamic-text-color': textColor } as React.CSSProperties}
            >
              {t('learning.explanation')}
            </h4>
            <div
              className="quiz-component__explanation-content dynamic-text-color"
              style={{ '--dynamic-text-color': textColor } as React.CSSProperties}
            >
              <ContentRenderer
                content={ContentAdapter.ensureStructured(
                  currentQuestion?.explanation || '',
                  'explanation'
                )}
              />
            </div>
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
          onClick={handleNext}
          disabled={!showResult}
          className="game-controls__primary-btn game-controls__primary-btn--green"
        >
          <span>
            {currentIndex === processedQuestions.length - 1
              ? t('learning.finishQuiz')
              : t('learning.nextQuestion')}
          </span>
          <ArrowRight className="game-controls__primary-icon" />
        </button>
      </div>
    </div>
  );
};

export default QuizComponent;
