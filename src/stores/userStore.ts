import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useProgressStore } from './progressStore';
import { checkLevelAdvancement } from '../services/levelProgression';
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
        if (user) {
          localStorage.setItem(
            'lp-user',
            JSON.stringify({
              id: user.id,
              name: user.name,
              ...(user.email ? { email: user.email } : {}),
              ...(user.isSupabaseUser ? { isSupabaseUser: true } : {}),
            })
          );
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
            // Cross-app CEFR level check — fire-and-forget (dynamic import + async Supabase write)
            void checkLevelAdvancement();
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
        if (!state) return;

        let shared: {
          id?: string;
          name?: string;
          email?: string;
          isSupabaseUser?: boolean;
        } | null = null;

        try {
          const raw = localStorage.getItem('lp-user');
          shared = raw ? JSON.parse(raw) : null;
        } catch {
          shared = null;
        }

        if (!shared?.name) {
          if (state.user) {
            state.user = null;
          }
          return;
        }

        if (!state.user || state.user.name !== shared.name) {
          state.setUser({
            id: shared.id || String(Date.now()),
            name: shared.name,
            email: shared.email,
            isSupabaseUser: shared.isSupabaseUser,
          });
        }
      },
    }
  )
);

// Listen for cross-tab changes to lp-user
if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key !== 'lp-user') return;
    if (e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed?.name) {
          useUserStore.setState({
            user: {
              id: parsed.id || String(Date.now()),
              name: parsed.name,
              email: parsed.email,
              isSupabaseUser: parsed.isSupabaseUser,
            },
          });
        }
      } catch {
        /* ignore */
      }
    } else {
      useUserStore.setState({ user: null });
    }
  });

  // Same-tab sync: lp-login modal writes lp-user directly
  const lpLogin = (window as any).lpLogin;
  if (lpLogin && lpLogin.onUpdate) {
    lpLogin.onUpdate(
      (user: { id: string; name: string; email?: string; isSupabaseUser?: boolean } | null) => {
        useUserStore.getState().setUser(
          user
            ? {
                id: user.id,
                name: user.name,
                email: user.email,
                isSupabaseUser: user.isSupabaseUser,
              }
            : null
        );
      }
    );
  }
}
