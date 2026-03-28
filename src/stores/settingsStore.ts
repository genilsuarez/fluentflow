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

  // Learning Modes
  learningModes: string[];

  // Game Settings
  gameSettings: GameSettings;

  // Offline
  offlineEnabled: boolean;
  downloadedLevels: string[];
  lastDownloadDate: string | null;

  // Actions
  setTheme: (theme: 'light' | 'dark') => void;
  setLanguage: (language: 'en' | 'es') => void;
  setLevel: (level: string) => void;
  setDevelopmentMode: (enabled: boolean) => void;
  setRandomizeItems: (enabled: boolean) => void;
  setCategories: (categories: string[]) => void;
  setLearningModes: (modes: string[]) => void;
  setGameSetting: (mode: keyof GameSettings, setting: string, value: number) => void;
  setOfflineEnabled: (enabled: boolean) => void;
  setDownloadedLevels: (levels: string[]) => void;
  setLastDownloadDate: (date: string | null) => void;
}

// Default categories for fallback and migration
const DEFAULT_CATEGORIES = ['Vocabulary', 'Grammar', 'PhrasalVerbs', 'Idioms', 'Reading', 'Review'];

// Default learning modes
const DEFAULT_LEARNING_MODES = ['flashcard', 'quiz', 'completion', 'sorting', 'matching', 'reading'];

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
      learningModes: DEFAULT_LEARNING_MODES,
      gameSettings: {
        flashcardMode: { wordCount: 10 },
        quizMode: { questionCount: 10 },
        completionMode: { itemCount: 10 },
        sortingMode: { wordCount: 5, categoryCount: 3 },
        matchingMode: { wordCount: 6 },
      },

      // Offline defaults
      offlineEnabled: false,
      downloadedLevels: [],
      lastDownloadDate: null,

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

      setLearningModes: modes => set({ learningModes: modes }),

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

      setOfflineEnabled: enabled => set({ offlineEnabled: enabled }),

      setDownloadedLevels: levels => set({ downloadedLevels: levels }),

      setLastDownloadDate: date => set({ lastDownloadDate: date }),
    }),
    {
      name: 'settings-storage',
      version: 8,
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
        // Migration from version 4 to version 5: add offline fields
        if (version < 5) {
          persistedState = {
            ...persistedState,
            offlineEnabled: false,
            downloadedLevels: [],
            lastDownloadDate: null,
          };
        }
        // Migration from version 5 to version 6: ensure Idioms category is included
        if (version < 6) {
          const currentCategories: string[] = persistedState.categories || [];
          if (!currentCategories.includes('Idioms')) {
            persistedState = {
              ...persistedState,
              categories: [...currentCategories, 'Idioms'],
            };
          }
        }
        // Migration from version 6 to version 7: ensure Reading and Review categories are included
        if (version < 7) {
          const currentCategories: string[] = persistedState.categories || [];
          const toAdd: string[] = [];
          if (!currentCategories.includes('Reading')) toAdd.push('Reading');
          if (!currentCategories.includes('Review')) toAdd.push('Review');
          if (toAdd.length > 0) {
            persistedState = {
              ...persistedState,
              categories: [...currentCategories, ...toAdd],
            };
          }
        }
        // Migration from version 7 to version 8: add learningModes filter
        if (version < 8) {
          persistedState = {
            ...persistedState,
            learningModes: DEFAULT_LEARNING_MODES,
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
