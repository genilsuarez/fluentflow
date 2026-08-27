import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppState, LearningModule, SessionScore, MenuContext } from '../types';

interface AppStore extends AppState {
  // Global score that persists across sessions
  globalScore: SessionScore;

  // Key that increments on in-place restart to force component remount
  restartKey: number;

  // Transient (never persisted) — true while App.tsx's async hash resolver
  // is still fetching a module for the initial #/learn/<id> deep link on
  // this page load. currentView starts as 'menu' on every load (see
  // partialize below), so components that branch on currentView === 'menu'
  // (Header, AppRouter) use this to avoid flashing menu-mode UI during that
  // window. Always false once the initial resolution completes.
  isResolvingInitialHash: boolean;

  // Actions
  setCurrentModule: (module: LearningModule | null) => void;
  setCurrentView: (view: AppState['currentView']) => void;
  setPreviousMenuContext: (context: MenuContext) => void;
  setIsResolvingInitialHash: (value: boolean) => void;
  updateSessionScore: (score: Partial<SessionScore>) => void;
  updateGlobalScore: (score: Partial<SessionScore>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  resetSession: () => void;
  resetGlobalScore: () => void;
  triggerRestart: () => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    set => ({
      // Initial state
      currentModule: null,
      currentView: 'menu',
      previousMenuContext: 'progression',
      restartKey: 0,
      isResolvingInitialHash:
        typeof window !== 'undefined' && window.location.hash.startsWith('#/learn/'),
      sessionScore: {
        correct: 0,
        incorrect: 0,
        total: 0,
        accuracy: 0,
      },
      globalScore: {
        correct: 0,
        incorrect: 0,
        total: 0,
        accuracy: 0,
      },
      isLoading: false,
      error: null,

      // Actions
      setCurrentModule: module =>
        set(state => {
          // Always reset session score when setting a new module
          const shouldResetScore =
            module && (!state.currentModule || module.id !== state.currentModule.id);

          const newSessionScore = shouldResetScore
            ? { correct: 0, incorrect: 0, total: 0, accuracy: 0 }
            : state.sessionScore;

          return {
            currentModule: module,
            sessionScore: newSessionScore,
          };
        }),

      setCurrentView: view =>
        set(state => {
          return {
            currentView: view,
            // Clear currentModule when going back to menu
            currentModule: view === 'menu' ? null : state.currentModule,
          };
        }),

      setPreviousMenuContext: context =>
        set(() => ({
          previousMenuContext: context,
        })),

      setIsResolvingInitialHash: value => set({ isResolvingInitialHash: value }),

      updateSessionScore: scoreUpdate =>
        set(state => {
          // INCREMENT the session score values
          const newSessionScore = { ...state.sessionScore };
          if (scoreUpdate.correct) {
            newSessionScore.correct += scoreUpdate.correct;
          }
          if (scoreUpdate.incorrect) {
            newSessionScore.incorrect += scoreUpdate.incorrect;
          }

          newSessionScore.total = newSessionScore.correct + newSessionScore.incorrect;
          newSessionScore.accuracy =
            newSessionScore.total > 0 ? (newSessionScore.correct / newSessionScore.total) * 100 : 0;

          // Also update global score
          const newGlobalScore = { ...state.globalScore };
          if (scoreUpdate.correct) {
            newGlobalScore.correct += scoreUpdate.correct;
          }
          if (scoreUpdate.incorrect) {
            newGlobalScore.incorrect += scoreUpdate.incorrect;
          }

          newGlobalScore.total = newGlobalScore.correct + newGlobalScore.incorrect;
          newGlobalScore.accuracy =
            newGlobalScore.total > 0 ? (newGlobalScore.correct / newGlobalScore.total) * 100 : 0;

          return {
            sessionScore: newSessionScore,
            globalScore: newGlobalScore,
          };
        }),

      updateGlobalScore: scoreUpdate =>
        set(state => {
          const newGlobalScore = { ...state.globalScore };
          if (scoreUpdate.correct) {
            newGlobalScore.correct += scoreUpdate.correct;
          }
          if (scoreUpdate.incorrect) {
            newGlobalScore.incorrect += scoreUpdate.incorrect;
          }

          newGlobalScore.total = newGlobalScore.correct + newGlobalScore.incorrect;
          newGlobalScore.accuracy =
            newGlobalScore.total > 0 ? (newGlobalScore.correct / newGlobalScore.total) * 100 : 0;

          return { globalScore: newGlobalScore };
        }),

      setLoading: loading => set({ isLoading: loading }),

      setError: error => set({ error }),

      resetSession: () => {
        return set({
          sessionScore: { correct: 0, incorrect: 0, total: 0, accuracy: 0 },
          error: null,
          currentModule: null,
        });
      },

      resetGlobalScore: () => {
        return set({
          globalScore: { correct: 0, incorrect: 0, total: 0, accuracy: 0 },
        });
      },

      triggerRestart: () => {
        return set(state => ({
          restartKey: state.restartKey + 1,
          sessionScore: { correct: 0, incorrect: 0, total: 0, accuracy: 0 },
          error: null,
        }));
      },
    }),
    {
      name: 'app-storage',
      partialize: state => ({
        // Always restore to menu on reload — learning views are restored via URL hash.
        // Persisting a learning view without its module causes a flash of
        // "no module selected" before handleHashChange resolves.
        currentView: 'menu' as const,
        // NOTE: currentModule is intentionally NOT persisted.
        // The URL hash (#/learn/module-id) is the source of truth for navigation.
        // Persisting currentModule causes stale data issues when the user returns
        // after a long time — the module metadata may have changed or been removed.
        // handleHashChange re-validates the module from the network/cache on mount.
        // previousMenuContext is session-only — each fresh load starts on Inicio.
        globalScore: state.globalScore,
        // sessionScore should NOT be persisted - it's session-only data
      }),
      onRehydrateStorage: () => state => {
        if (state) {
          state.previousMenuContext = 'progression';
        }
      },
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as Partial<typeof currentState>),
        previousMenuContext: 'progression' as const,
      }),
    }
  )
);
