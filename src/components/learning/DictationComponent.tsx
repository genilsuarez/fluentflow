import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Volume2, Check, X, ArrowRight } from 'lucide-react';
import { useLearningSession } from '../../hooks/useLearningSession';
import { conditionalShuffle } from '../../utils/randomUtils';
import { matchesAnswer } from '../../utils/answerUtils';
import { advanceQuizTextStep } from '../../utils/exerciseTransition';
import LearningProgressHeader from '../ui/LearningProgressHeader';
import ExerciseResultScreen from '../ui/ExerciseResultScreen';
import { speak, stopSpeaking, isSpeechAvailable, whenVoicesReady } from '../../utils/speech';

import '../../styles/components/quiz-component.css';

import type { LearningModule } from '../../types';
import { GameControlsExitButton } from '../ui/GameControlsExitButton';
import { GameControlsResetButton } from '../ui/GameControlsResetButton';


interface DictationItem {
  text: string;
  hint?: string;
}

interface DictationComponentProps {
  module: LearningModule;
}

const DictationComponent: React.FC<DictationComponentProps> = ({ module }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
    triggerRestart} = useLearningSession({
    moduleId: module.id,
    moduleName: module.name,
    learningMode: 'dictation'});

  const itemsRef = useRef<DictationItem[] | null>(null);
  if (itemsRef.current === null) {
    const data = (module.data || []) as unknown as DictationItem[];
    itemsRef.current = conditionalShuffle(data, randomizeItems);
  }
  const items = itemsRef.current;
  const currentItem = items[currentIndex];

  const playAudio = useCallback(
    (rate = 0.85) => {
      if (!currentItem) return;
      setIsPlaying(true);
      speak(currentItem.text, { rate });
      setTimeout(() => setIsPlaying(false), Math.max(currentItem.text.length * 85, 2000));
    },
    [currentItem]
  );

  // Auto-play on new item
  useEffect(() => {
    if (!currentItem || showResult) return;
    let cancelled = false;
    void whenVoicesReady().then(() => {
      if (!cancelled) playAudio();
    });
    return () => {
      cancelled = true;
    };
  }, [currentIndex, currentItem, showResult, playAudio]);

  // Focus input on new item
  useEffect(() => {
    if (!showResult) inputRef.current?.focus();
  }, [currentIndex, showResult]);

  // Cleanup
  useEffect(() => () => stopSpeaking(), []);

  const handleSubmit = useCallback(() => {
    if (showResult || !currentItem || !userInput.trim()) return;
    const correct = matchesAnswer(userInput.trim(), [currentItem.text]);

    setIsCorrect(correct);
    setShowResult(true);
    if (correct) markCorrect();
    else markIncorrect();
  }, [showResult, currentItem, userInput, markCorrect, markIncorrect]);

  const handleNext = useCallback(() => {
    if (currentIndex < items.length - 1) {
      advanceQuizTextStep({
        setCurrentIndex,
        setUserInput,
        setShowResult,
        setIsCorrect,
        onAdvance: stopSpeaking,
        focusInput: () => inputRef.current?.focus()});
    } else {
      finishExercise();
    }
  }, [currentIndex, items.length, finishExercise]);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (showResult) handleNext();
        else handleSubmit();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showResult, handleNext, handleSubmit]);

  if (!items.length) {
    return (
      <div className="quiz-component__no-data">
        <p className="quiz-component__no-data-text">No dictation data available.</p>
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
          setUserInput('');
          setShowResult(false);
          setIsCorrect(false);
          itemsRef.current = conditionalShuffle(
            (module.data || []) as unknown as DictationItem[],
            randomizeItems
          );
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
        totalItems={items.length}
        mode="dictation"
        helpText={showResult ? t('learning.pressEnterNext') : 'Listen and type what you hear'}
      />

      <div className="quiz-component__question-card" style={{ gap: '1rem' }}>
        {/* Listen button */}
        {ttsAvailable && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 0'}}
          >
            <button
              onClick={() => playAudio()}
              aria-label="Play audio"
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                border: '2.5px solid var(--theme-primary-blue, #3b82f6)',
                background: 'rgba(59,130,246,0.08)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                transform: isPlaying ? 'scale(1.06)' : 'scale(1)'}}
            >
              <Volume2 size={32} color="var(--theme-primary-blue, #3b82f6)" />
            </button>
            <button
              onClick={() => playAudio(0.65)}
              style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                color: 'var(--theme-text-tertiary)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline'}}
            >
              🐢 Slower
            </button>
          </div>
        )}

        {/* Hint */}
        {currentItem?.hint && (
          <p
            style={{
              fontSize: '0.75rem',
              color: 'var(--theme-text-tertiary)',
              textAlign: 'center',
              fontStyle: 'italic'}}
          >
            💡 {currentItem.hint}
          </p>
        )}

        {/* Input */}
        <div className="quiz-component__text-input-wrap">
          <input
            ref={inputRef}
            type="text"
            value={userInput}
            onChange={e => setUserInput(e.target.value)}
            disabled={showResult}
            placeholder="Type what you hear…"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className={`quiz-component__text-input${
              showResult
                ? isCorrect
                  ? ' quiz-component__text-input--correct'
                  : ' quiz-component__text-input--incorrect'
                : ''
            }`}
          />
        </div>

        {/* Result feedback */}
        {showResult && (
          <div
            className={`quiz-component__inline-feedback ${
              isCorrect
                ? 'quiz-component__inline-feedback--correct'
                : 'quiz-component__inline-feedback--incorrect'
            }`}
          >
            <p className="quiz-component__inline-feedback-row">
              {isCorrect ? (
                <Check className="quiz-component__inline-feedback-icon" aria-hidden="true" />
              ) : (
                <X className="quiz-component__inline-feedback-icon" aria-hidden="true" />
              )}
              <span className="quiz-component__inline-feedback-label">
                {isCorrect ? t('common.correct') : t('common.incorrect')}
              </span>
              <span className="quiz-component__inline-feedback-sep" aria-hidden="true">
                ·
              </span>
              <span className="quiz-component__inline-feedback-answer">{currentItem.text}</span>
            </p>
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
        <button
          onClick={showResult ? handleNext : handleSubmit}
          disabled={!showResult && !userInput.trim()}
          className="game-controls__primary-btn"
        >
          <span>
            {showResult
              ? currentIndex < items.length - 1
                ? t('learning.nextQuestion')
                : t('learning.finishQuiz')
              : t('learning.checkAnswer')}
          </span>
          <ArrowRight className="game-controls__primary-icon" />
        </button>
      </div>
    </div>
  );
};

export default DictationComponent;
