import { useState, useCallback, useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import { useUserStore } from '../stores/userStore';
import { useProgressStore } from '../stores/progressStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useMenuNavigation } from './useMenuNavigation';
import { useTranslation } from '../utils/i18n';
import { useToast } from './useToast';
import { useLearningCleanup } from './useLearningCleanup';
import type { LearningMode } from '../types';

interface UseLearningSessionOptions {
  moduleId: string;
  moduleName: string;
  learningMode: LearningMode;
}

/**
 * Shared hook for the common learning session lifecycle:
 * - Start time tracking
 * - Score updates (correct/incorrect)
 * - Finish exercise (progress entry + user score + return to menu)
 * - Keyboard escape to return to menu
 * - Toast feedback (correct/incorrect/completed)
 * - Learning cleanup on unmount
 */
export const useLearningSession = ({ moduleId, moduleName, learningMode }: UseLearningSessionOptions) => {
  const [startTime] = useState(Date.now());

  const updateSessionScore = useAppStore(state => state.updateSessionScore);
  const { updateUserScore } = useUserStore();
  const { language, randomizeItems } = useSettingsStore();
  const { returnToMenu } = useMenuNavigation();
  const { addProgressEntry } = useProgressStore();
  const { t } = useTranslation(language);
  const { showCorrectAnswer, showIncorrectAnswer, showModuleCompleted } = useToast();
  useLearningCleanup();

  const markCorrect = useCallback(() => {
    updateSessionScore({ correct: 1 });
    showCorrectAnswer();
  }, [updateSessionScore, showCorrectAnswer]);

  const markIncorrect = useCallback(() => {
    updateSessionScore({ incorrect: 1 });
    showIncorrectAnswer();
  }, [updateSessionScore, showIncorrectAnswer]);

  const finishExercise = useCallback((overrideScore?: { correct: number; total: number; accuracy: number }) => {
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);

    const score = overrideScore ?? (() => {
      const { sessionScore } = useAppStore.getState();
      return {
        correct: sessionScore.correct,
        total: sessionScore.total,
        accuracy: sessionScore.accuracy,
      };
    })();

    const finalScore = score.total > 0
      ? Math.round((score.correct / score.total) * 100)
      : 0;

    addProgressEntry({
      score: finalScore,
      totalQuestions: score.total,
      correctAnswers: score.correct,
      moduleId,
      learningMode,
      timeSpent,
    });

    showModuleCompleted(moduleName, finalScore, score.accuracy);
    updateUserScore(moduleId, finalScore, timeSpent);
    returnToMenu({ autoScrollToNext: true });
  }, [startTime, moduleId, moduleName, learningMode, addProgressEntry, showModuleCompleted, updateUserScore, returnToMenu]);

  const handleReturnToMenu = useCallback(() => returnToMenu(), [returnToMenu]);

  // Escape key to return to menu (base behavior, components can override)
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        returnToMenu();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [returnToMenu]);

  return {
    startTime,
    language,
    randomizeItems,
    t,
    updateSessionScore,
    markCorrect,
    markIncorrect,
    finishExercise,
    handleReturnToMenu,
    returnToMenu,
  };
};
