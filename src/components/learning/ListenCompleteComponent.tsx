import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Volume2, CheckCircle, XCircle, ArrowRight, Home } from 'lucide-react';
import { useLearningSession } from '../../hooks/useLearningSession';
import { useSettingsStore } from '../../stores/settingsStore';
import { conditionalShuffle } from '../../utils/randomUtils';
import { normalizeAnswer } from '../../utils/answerUtils';
import { ContentAdapter } from '../../utils/contentAdapter';
import ContentRenderer from '../ui/ContentRenderer';
import LearningProgressHeader from '../ui/LearningProgressHeader';
import ExerciseResultScreen from '../ui/ExerciseResultScreen';
import { speak, stopSpeaking, isSpeechAvailable } from '../../utils/speech';

import '../../styles/components/quiz-component.css';

import type { LearningModule, CompletionData } from '../../types';

interface ListenCompleteComponentProps {
  module: LearningModule;
}

const ListenCompleteComponent: React.FC<ListenCompleteComponentProps> = ({ module }) => {
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
  } = useLearningSession({
    moduleId: module.id,
    moduleName: module.name,
    learningMode: 'listen-complete',
  });

  const { theme } = useSettingsStore();
  const isDark = theme === 'dark';

  const itemsRef = useRef<CompletionData[] | null>(null);
  if (itemsRef.current === null) {
    const data = (module.data || []) as CompletionData[];
    itemsRef.current = conditionalShuffle(data, randomizeItems);
  }
  const items = itemsRef.current;
  const currentItem = items[currentIndex];

  // Build the full sentence for TTS (replace blank with the correct answer)
  const getFullSentence = useCallback(() => {
    if (!currentItem) return '';
    return currentItem.sentence.replace(/_{2,}/, currentItem.correct);
  }, [currentItem]);

  const playAudio = useCallback((rate = 0.85) => {
    const text = getFullSentence();
    if (!text) return;
    setIsPlaying(true);
    speak(text, { rate });
    setTimeout(() => setIsPlaying(false), Math.max(text.length * 80, 2000));
  }, [getFullSentence]);

  // Auto-play on new item
  useEffect(() => {
    if (currentItem && !showResult) {
      const timer = setTimeout(() => playAudio(), 400);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, currentItem, showResult, playAudio]);

  // Focus input
  useEffect(() => {
    if (!showResult) inputRef.current?.focus();
  }, [currentIndex, showResult]);

  // Cleanup
  useEffect(() => () => stopSpeaking(), []);

  const handleSubmit = useCallback(() => {
    if (showResult || !currentItem || !userInput.trim()) return;
    const normalized = normalizeAnswer(userInput.trim());
    const expected = normalizeAnswer(currentItem.correct);
    const correct = normalized === expected;

    setIsCorrect(correct);
    setShowResult(true);
    if (correct) markCorrect();
    else markIncorrect();
  }, [showResult, currentItem, userInput, markCorrect, markIncorrect]);

  const handleNext = useCallback(() => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setUserInput('');
      setShowResult(false);
      setIsCorrect(false);
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
        <p className="quiz-component__no-data-text">No data available.</p>
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
          itemsRef.current = conditionalShuffle((module.data || []) as CompletionData[], randomizeItems);
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
        mode="listen-complete"
        helpText={showResult ? t('learning.pressEnterNext') : 'Listen, then fill in the blank'}
      />

      <div className="quiz-component__question-card" style={{ gap: '1rem' }}>
        {/* Listen button */}
        {ttsAvailable && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0' }}>
            <button
              onClick={() => playAudio()}
              aria-label="Play audio"
              style={{
                width: '64px', height: '64px', borderRadius: '50%',
                border: '2.5px solid var(--theme-primary-blue, #3b82f6)',
                background: 'rgba(59,130,246,0.08)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s', transform: isPlaying ? 'scale(1.06)' : 'scale(1)',
              }}
            >
              <Volume2 size={28} color="var(--theme-primary-blue, #3b82f6)" />
            </button>
            <button
              onClick={() => playAudio(0.65)}
              style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--theme-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              🐢 Slower
            </button>
          </div>
        )}

        {/* Sentence with blank */}
        <div style={{ fontSize: '1.05rem', fontWeight: 500, color: isDark ? '#e5e7eb' : '#1f2937', textAlign: 'center', lineHeight: 1.6 }}>
          <ContentRenderer content={ContentAdapter.ensureStructured(currentItem.sentence, 'completion')} />
        </div>

        {/* Tip */}
        {currentItem?.tip && !showResult && (
          <p style={{ fontSize: '0.72rem', color: 'var(--theme-text-tertiary)', textAlign: 'center', fontStyle: 'italic' }}>
            💡 {currentItem.tip}
          </p>
        )}

        {/* Input */}
        <div style={{ width: '100%', maxWidth: '320px', margin: '0 auto' }}>
          <input
            ref={inputRef}
            type="text"
            value={userInput}
            onChange={e => setUserInput(e.target.value)}
            disabled={showResult}
            placeholder="Type the missing word…"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            style={{
              width: '100%', padding: '12px 14px', fontSize: '1rem', textAlign: 'center',
              borderRadius: '0.5rem', border: `2px solid ${showResult ? (isCorrect ? '#10b981' : '#ef4444') : 'var(--theme-border, #e5e7eb)'}`,
              background: isDark ? 'var(--theme-bg-elevated, #1f2937)' : '#fff',
              color: isDark ? '#fff' : '#111827',
              outline: 'none', transition: 'border-color 0.2s',
            }}
          />
        </div>

        {/* Feedback */}
        {showResult && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {isCorrect ? <CheckCircle size={18} color="#10b981" /> : <XCircle size={18} color="#ef4444" />}
              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: isCorrect ? '#10b981' : '#ef4444' }}>
                {isCorrect ? 'Correct!' : `Answer: ${currentItem.correct}`}
              </span>
            </div>
            {currentItem.explanation && (
              <p style={{ fontSize: '0.75rem', color: 'var(--theme-text-tertiary)', textAlign: 'center' }}>
                {currentItem.explanation}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Unified Control Bar */}
      <div className="game-controls">
        <button onClick={handleReturnToMenu} className="game-controls__home-btn" title={t('learning.returnToMainMenu')}>
          <Home className="game-controls__home-icon" />
        </button>
        <button onClick={showResult ? handleNext : handleSubmit} disabled={!showResult && !userInput.trim()} className="game-controls__primary-btn game-controls__primary-btn--green">
          <span>{showResult ? (currentIndex < items.length - 1 ? t('learning.nextQuestion') : t('learning.finishQuiz')) : t('learning.checkAnswer')}</span>
          <ArrowRight className="game-controls__primary-icon" />
        </button>
      </div>
    </div>
  );
};

export default ListenCompleteComponent;
