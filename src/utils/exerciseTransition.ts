/** Legacy collapse timing — prefer atomic advance (see advanceInputExerciseStep) */
export const EXERCISE_FEEDBACK_COLLAPSE_MS = 220;

/** Short guard after advance before re-enabling Enter */
export const EXERCISE_ENTER_GUARD_MS = 50;

/** Block ghost Enter keypresses right after showing exercise feedback (mobile keyboards) */
export const EXERCISE_RESULT_ENTER_GUARD_MS = 400;

/** Delay before TTS so voices are warm and feedback UI has painted */
export const EXERCISE_SPEECH_DELAY_MS = 500;

type AdvanceQuizTextStepOptions = {
  setCurrentIndex: (value: number | ((prev: number) => number)) => void;
  setUserInput: (value: string | ((prev: string) => string)) => void;
  setShowResult: (value: boolean | ((prev: boolean) => boolean)) => void;
  setIsCorrect: (value: boolean | ((prev: boolean) => boolean)) => void;
  focusInput?: () => void;
  onAdvance?: () => void;
};

/** Dictation / listen-complete — clear input and hide feedback in one frame */
export function advanceQuizTextStep({
  setCurrentIndex,
  setUserInput,
  setShowResult,
  setIsCorrect,
  focusInput,
  onAdvance,
}: AdvanceQuizTextStepOptions): void {
  onAdvance?.();
  setCurrentIndex(prev => prev + 1);
  setUserInput('');
  setShowResult(false);
  setIsCorrect(false);
  requestAnimationFrame(() => focusInput?.());
}

type AdvanceInputExerciseStepOptions = {
  setCurrentIndex: (value: number | ((prev: number) => number)) => void;
  setAnswer?: (value: string | ((prev: string) => string)) => void;
  resetAnswer?: () => void;
  setShowResult: (value: boolean | ((prev: boolean) => boolean)) => void;
  ignoreEnterRef: { current: boolean };
  focusInput?: () => void;
};

/** Swap exercise content in one frame — no staged clear + collapse */
export function advanceInputExerciseStep({
  setCurrentIndex,
  setAnswer,
  resetAnswer,
  setShowResult,
  ignoreEnterRef,
  focusInput,
}: AdvanceInputExerciseStepOptions): void {
  ignoreEnterRef.current = true;
  setCurrentIndex(prev => prev + 1);
  if (resetAnswer) resetAnswer();
  else setAnswer?.('');
  setShowResult(false);
  window.setTimeout(() => {
    ignoreEnterRef.current = false;
    requestAnimationFrame(() => focusInput?.());
  }, EXERCISE_ENTER_GUARD_MS);
}
