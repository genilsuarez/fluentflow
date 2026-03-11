import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { applyThemeToDOM } from '../utils/themeInitializer';

export interface GameSettings {
  flashcardMode: { wordCount: number };
  quizMode: { questionCount: number };
  completionMode: { itemCount: number };
  sortingMode: { wordCount: number; categoryCount: number };
  matchingMode: { wordCount: number };
}

export interface MaxLimits {
  flashcard: number;
  quiz: number;
  completion: number;
  sorting: number;
  matching: number;
  maxCategories: number;
}

interface SettingsState {
  // General
  theme: 'light' | 'dark';
  language: 'en' | 'es';
  level: 'all' | 'a1' | 'a2' | 'b1' | 'b2' | 'c1' | 'c2';

  // Development
  developmentMode: boolean;

  // Learning Settings
  randomizeItems: boolean;

  // Categories
  categories: string[];

  // Game Settings
  gameSettings: GameSettings;

  // Max limits based on available data
  maxLimits: MaxLimits;

  // Actions
  setTheme: (theme: 'light' | 'dark') => void;
  setLanguage: (language: 'en' | 'es') => void;
  setLevel: (level: string) => void;
  setDevelopmentMode: (enabled: boolean) => void;
  setRandomizeItems: (enabled: boolean) => void;
  setCategories: (categories: string[]) => void;
  setGameSetting: (mode: keyof GameSettings, setting: string, value: number) => void;
  updateMaxLimits: (limits: MaxLimits) => void;
}

// Default categories for fallback and migration
const DEFAULT_CATEGORIES = ['Vocabulary', 'Grammar', 'PhrasalVerbs', 'Idioms', 'Reading', 'Review'];

// Categories removed in v4 migration
const REMOVED_CATEGORIES = ['Pronunciation', 'Listening', 'Writing', 'Speaking'];

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // Default values - will be overridden by theme initializer
      theme: 'light',
      language: 'en',
      level: 'all',
      developmentMode: false,
      randomizeItems: true, // Default: randomization enabled
      categories: DEFAULT_CATEGORIES,
      gameSettings: {
        flashcardMode: { wordCount: 10 },
        quizMode: { questionCount: 10 },
        completionMode: { itemCount: 10 },
        sortingMode: { wordCount: 5, categoryCount: 3 },
        matchingMode: { wordCount: 6 },
      },

      maxLimits: {
        flashcard: 50,
        quiz: 50,
        completion: 50,
        sorting: 50,
        matching: 50,
        maxCategories: 10,
      },

      // Actions
      setTheme: theme => {
        set({ theme });
        // Apply theme to DOM and update meta theme-color
        applyThemeToDOM(theme);
      },

      setLanguage: language => set({ language }),

      setLevel: level => set({ level: level as any }),

      setDevelopmentMode: enabled => set({ developmentMode: enabled }),

      setRandomizeItems: enabled => set({ randomizeItems: enabled }),

      setCategories: categories => set({ categories }),

      setGameSetting: (mode, setting, value) => {
        const currentSettings = get().gameSettings;
        set({
          gameSettings: {
            ...currentSettings,
            [mode]: {
              ...currentSettings[mode],
              [setting]: value,
            },
          },
        });
      },

      updateMaxLimits: limits => set({ maxLimits: limits }),
    }),
    {
      name: 'settings-storage',
      version: 4,
      migrate: (persistedState: any, version: number) => {
        // Migration from version 1 to version 2
        if (version < 2) {
          persistedState = {
            ...persistedState,
            categories: DEFAULT_CATEGORIES,
          };
        }
        // Migration from version 2 to version 3
        if (version < 3) {
          persistedState = {
            ...persistedState,
            randomizeItems: true,
          };
        }
        // Migration from version 3 to version 4: remove unused categories
        if (version < 4) {
          const currentCategories = persistedState.categories || [];
          persistedState = {
            ...persistedState,
            categories: currentCategories.filter((c: string) => !REMOVED_CATEGORIES.includes(c)),
          };
        }
        return persistedState;
      },
      onRehydrateStorage: () => state => {
        // Ensure theme is applied after rehydration
        if (state?.theme) {
          applyThemeToDOM(state.theme);
        }
      },
    }
  )
);
