import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { progressionService } from '../services/progressionService';
import { createLearnFlowId } from '../services/learnFlowIntegration';

export interface ProgressEntry {
  date: string; // YYYY-MM-DD format
  eventId: string;
  runId: string;
  occurredAt: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  moduleId?: string;
  learningMode?: string;
  timeSpent?: number;
}

interface DailyProgress {
  date: string;
  totalScore: number;
  totalQuestions: number;
  totalCorrect: number;
  averageScore: number;
  sessionsCount: number;
  timeSpent: number;
  modules: string[];
}

export interface ModuleCompletion {
  moduleId: string;
  completedAt: string;
  bestScore: number;
  attempts: number;
}

interface ProgressStore {
  progressHistory: ProgressEntry[];
  dailyProgress: Record<string, DailyProgress>;
  completedModules: Record<string, ModuleCompletion>;

  // Actions
  addProgressEntry: (entry: Omit<ProgressEntry, 'date' | 'eventId' | 'occurredAt'>) => void;
  getProgressData: (days?: number) => DailyProgress[];
  getDailyProgress: (date: string) => DailyProgress | null;
  getWeeklyAverage: () => number;
  getMonthlyAverage: () => number;
  clearOldProgress: (daysToKeep?: number) => void;

  // Module completion actions
  completeModule: (moduleId: string, score: number) => void;
  isModuleCompleted: (moduleId: string) => boolean;
  getCompletedModuleIds: () => string[];
  getModuleCompletion: (moduleId: string) => ModuleCompletion | null;
  resetProgress: () => void;
}

const getTodayString = (): string => {
  return new Date().toISOString().split('T')[0];
};

const getDateString = (daysAgo: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
};

export const useProgressStore = create<ProgressStore>()(
  persist(
    (set, get) => ({
      progressHistory: [],
      dailyProgress: {},
      completedModules: {},

      addProgressEntry: entry => {
        if (get().progressHistory.some(progress => progress.runId === entry.runId)) return;

        set(state => {
          const today = getTodayString();
          const occurredAt = new Date().toISOString();
          const newEntry: ProgressEntry = {
            ...entry,
            date: today,
            eventId: createLearnFlowId('event'),
            occurredAt,
          };

          // Add to history
          const updatedHistory = [...state.progressHistory, newEntry];

          // Update daily progress
          const existingDaily = state.dailyProgress[today] || {
            date: today,
            totalScore: 0,
            totalQuestions: 0,
            totalCorrect: 0,
            averageScore: 0,
            sessionsCount: 0,
            timeSpent: 0,
            modules: [],
          };

          const updatedDaily: DailyProgress = {
            ...existingDaily,
            totalScore: existingDaily.totalScore + entry.score,
            totalQuestions: existingDaily.totalQuestions + entry.totalQuestions,
            totalCorrect: existingDaily.totalCorrect + entry.correctAnswers,
            sessionsCount: existingDaily.sessionsCount + 1,
            timeSpent: existingDaily.timeSpent + (entry.timeSpent || 0),
            modules:
              entry.moduleId && !existingDaily.modules.includes(entry.moduleId)
                ? [...existingDaily.modules, entry.moduleId]
                : existingDaily.modules,
          };

          // Calculate average score
          updatedDaily.averageScore =
            updatedDaily.totalQuestions > 0
              ? Math.round((updatedDaily.totalCorrect / updatedDaily.totalQuestions) * 100)
              : 0;

          return {
            progressHistory: updatedHistory,
            dailyProgress: {
              ...state.dailyProgress,
              [today]: updatedDaily,
            },
          };
        });
      },

      getProgressData: (days = 7) => {
        const { dailyProgress } = get();
        const result: DailyProgress[] = [];

        for (let i = days - 1; i >= 0; i--) {
          const dateString = getDateString(i);
          const dayProgress = dailyProgress[dateString];

          if (dayProgress) {
            result.push(dayProgress);
          } else {
            // Create empty entry for days with no progress
            result.push({
              date: dateString,
              totalScore: 0,
              totalQuestions: 0,
              totalCorrect: 0,
              averageScore: 0,
              sessionsCount: 0,
              timeSpent: 0,
              modules: [],
            });
          }
        }

        return result;
      },

      getDailyProgress: date => {
        const { dailyProgress } = get();
        return dailyProgress[date] || null;
      },

      getWeeklyAverage: () => {
        const weekData = get().getProgressData(7);
        const validDays = weekData.filter(day => day.sessionsCount > 0);

        if (validDays.length === 0) return 0;

        const totalAverage = validDays.reduce((sum, day) => sum + day.averageScore, 0);
        return Math.round(totalAverage / validDays.length);
      },

      getMonthlyAverage: () => {
        const monthData = get().getProgressData(30);
        const validDays = monthData.filter(day => day.sessionsCount > 0);

        if (validDays.length === 0) return 0;

        const totalAverage = validDays.reduce((sum, day) => sum + day.averageScore, 0);
        return Math.round(totalAverage / validDays.length);
      },

      clearOldProgress: (daysToKeep = 90) =>
        set(state => {
          const cutoffDate = getDateString(daysToKeep);

          // Filter history
          const filteredHistory = state.progressHistory.filter(entry => entry.date >= cutoffDate);

          // Filter daily progress
          const filteredDaily: Record<string, DailyProgress> = {};
          Object.entries(state.dailyProgress).forEach(([date, progress]) => {
            if (date >= cutoffDate) {
              filteredDaily[date] = progress;
            }
          });

          return {
            progressHistory: filteredHistory,
            dailyProgress: filteredDaily,
          };
        }),

      // Module completion actions
      completeModule: (moduleId: string, score: number) =>
        set(state => {
          const today = getTodayString();
          const existing = state.completedModules[moduleId];

          const completion: ModuleCompletion = {
            moduleId,
            completedAt: existing?.completedAt || today,
            bestScore: existing ? Math.max(existing.bestScore, score) : score,
            attempts: existing ? existing.attempts + 1 : 1,
          };

          // Update progression service
          progressionService.completeModule(moduleId);

          return {
            ...state,
            completedModules: {
              ...state.completedModules,
              [moduleId]: completion,
            },
          };
        }),

      isModuleCompleted: (moduleId: string) => {
        const { completedModules } = get();
        return moduleId in completedModules;
      },

      getCompletedModuleIds: () => {
        const { completedModules } = get();
        return Object.keys(completedModules);
      },

      getModuleCompletion: (moduleId: string) => {
        const { completedModules } = get();
        return completedModules[moduleId] || null;
      },

      resetProgress: () =>
        set(() => {
          progressionService.reset();
          return {
            progressHistory: [],
            dailyProgress: {},
            completedModules: {},
          };
        }),
    }),
    {
      name: 'progress-storage',
      // Only persist essential data
      partialize: state => ({
        progressHistory: state.progressHistory,
        dailyProgress: state.dailyProgress,
        completedModules: state.completedModules,
      }),
      onRehydrateStorage: () => state => {
        // Auto-cleanup old progress data (keep 90 days) on app load
        if (state) {
          state.clearOldProgress(90);
        }
      },
    }
  )
);
