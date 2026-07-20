import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useProgressStore } from './progressStore';
import type { User, ModuleScore } from '../types';

interface UserStore {
  user: User | null;
  userScores: Record<string, ModuleScore>;

  // Actions
  setUser: (user: User | null) => void;
  updateUserScore: (moduleId: string, score: number, timeSpent: number) => void;
  getUserProgress: (moduleId: string) => ModuleScore | null;
  getTotalScore: () => number;
  getGlobalStats: () => {
    totalScore: number;
    avgScore: number;
    totalAttempts: number;
    totalModules: number;
    bestStreak: number;
    level: number;
    progressToNextLevel: number;
  };
}

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      user: null,
      userScores: {},

      setUser: user => {
        set({ user });
        // Sync to shared cross-app key
        if (user) {
          localStorage.setItem('lp-user', JSON.stringify({ id: user.id, name: user.name }));
        } else {
          localStorage.removeItem('lp-user');
        }
      },

      updateUserScore: (moduleId, score, timeSpent) =>
        set(state => {
          const existingScore = state.userScores[moduleId];
          const newScore: ModuleScore = {
            moduleId,
            bestScore: existingScore ? Math.max(existingScore.bestScore, score) : score,
            attempts: existingScore ? existingScore.attempts + 1 : 1,
            lastAttempt: new Date().toISOString(),
            timeSpent: existingScore ? existingScore.timeSpent + timeSpent : timeSpent,
          };

          // Mark module as completed in progression system if score is good enough (>= 70%)
          if (score >= 70) {
            const progressStore = useProgressStore.getState();
            progressStore.completeModule(moduleId, score);
          }

          return {
            userScores: {
              ...state.userScores,
              [moduleId]: newScore,
            },
          };
        }),

      getUserProgress: moduleId => {
        const { userScores } = get();
        return userScores[moduleId] || null;
      },

      getTotalScore: () => {
        const { userScores } = get();
        return Object.values(userScores).reduce((total, score) => total + score.bestScore, 0);
      },

      getGlobalStats: () => {
        const { userScores } = get();
        const scores = Object.values(userScores);

        // Debug logging removed to avoid circular dependencies

        if (scores.length === 0) {
          const emptyStats = {
            totalScore: 0,
            avgScore: 0,
            totalAttempts: 0,
            totalModules: 0,
            bestStreak: 0,
            level: 1,
            progressToNextLevel: 0,
          };
          return emptyStats;
        }

        const totalScore = scores.reduce((sum, score) => sum + score.bestScore, 0);
        const totalAttempts = scores.reduce((sum, score) => sum + score.attempts, 0);
        const avgScore = Math.round(totalScore / scores.length);

        // Calculate level (every 100 points = 1 level)
        const level = Math.floor(totalScore / 100) + 1;
        const progressToNextLevel = totalScore % 100;

        // Calculate best streak (consecutive high scores)
        const sortedScores = scores
          .sort((a, b) => new Date(b.lastAttempt).getTime() - new Date(a.lastAttempt).getTime())
          .map(s => s.bestScore);

        let bestStreak = 0;
        let currentStreak = 0;

        for (const score of sortedScores) {
          if (score >= 80) {
            currentStreak++;
            bestStreak = Math.max(bestStreak, currentStreak);
          } else {
            currentStreak = 0;
          }
        }

        const globalStats = {
          totalScore,
          avgScore,
          totalAttempts,
          totalModules: scores.length,
          bestStreak,
          level,
          progressToNextLevel,
        };

        return globalStats;
      },
    }),
    {
      name: 'user-storage',
      onRehydrateStorage: () => state => {
        // On app load, sync from shared lp-user key if local store is empty
        if (state && !state.user) {
          try {
            const shared = localStorage.getItem('lp-user');
            if (shared) {
              const parsed = JSON.parse(shared);
              if (parsed && parsed.name) {
                state.setUser({ id: parsed.id || String(Date.now()), name: parsed.name });
              }
            }
          } catch {
            /* ignore parse errors */
          }
        }
        // If user exists locally but lp-user is empty, write it out
        if (state?.user && !localStorage.getItem('lp-user')) {
          localStorage.setItem(
            'lp-user',
            JSON.stringify({ id: state.user.id, name: state.user.name })
          );
        }
      },
    }
  )
);

// Listen for cross-tab changes to lp-user
if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key !== 'lp-user') return;
    const current = useUserStore.getState().user;
    if (e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed?.name && parsed.name !== current?.name) {
          useUserStore.setState({
            user: { id: parsed.id || String(Date.now()), name: parsed.name },
          });
        }
      } catch {
        /* ignore */
      }
    } else if (current) {
      useUserStore.setState({ user: null });
    }
  });

  // Same-tab sync: listen to lpLogin.onUpdate (vanilla modal writes lp-user directly)
  const lpLogin = (window as any).lpLogin;
  if (lpLogin && lpLogin.onUpdate) {
    lpLogin.onUpdate((user: { id: string; name: string } | null) => {
      const current = useUserStore.getState().user;
      if (user && user.name !== current?.name) {
        useUserStore.setState({ user: { id: user.id, name: user.name } });
      } else if (!user && current) {
        useUserStore.setState({ user: null });
      }
    });
  }
}
