import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { applyThemeToDOM, syncThemeUrlParam } from '../utils/themeInitializer';

export interface GameSettings {
  flashcardMode: { wordCount: number };
  quizMode: { questionCount: number };
  completionMode: { itemCount: number };
  sortingMode: { wordCount: number; categoryCount: number };
  matchingMode: { wordCount: number };
  reorderingMode: { itemCount: number };
  transformationMode: { itemCount: number };
  wordFormationMode: { itemCount: number };
  errorCorrectionMode: { itemCount: number };
  dictationMode: { itemCount: number };
  listenCompleteMode: { itemCount: number };
  listeningQuizMode: { itemCount: number };
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
const DEFAULT_LEARNING_MODES = [
  'flashcard',
  'quiz',
  'completion',
  'sorting',
  'matching',
  'reading',
  'reordering',
  'transformation',
  'word-formation',
  'error-correction',
];

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
      categories: [],
      learningModes: [],
      gameSettings: {
        flashcardMode: { wordCount: 8 },
        quizMode: { questionCount: 8 },
        completionMode: { itemCount: 8 },
        sortingMode: { wordCount: 4, categoryCount: 3 },
        matchingMode: { wordCount: 5 },
        reorderingMode: { itemCount: 8 },
        transformationMode: { itemCount: 8 },
        wordFormationMode: { itemCount: 8 },
        errorCorrectionMode: { itemCount: 8 },
        dictationMode: { itemCount: 5 },
        listenCompleteMode: { itemCount: 8 },
        listeningQuizMode: { itemCount: 8 },
      },

      // Offline defaults
      offlineEnabled: false,
      downloadedLevels: [],
      lastDownloadDate: null,

      // Actions
      setTheme: theme => {
        // Smooth cross-app theme transition (matches DeskFlow/HubFlow/LyricFlow)
        if (typeof document !== 'undefined') {
          document.documentElement.classList.add('theme-transitioning');
          setTimeout(() => {
            document.documentElement.classList.remove('theme-transitioning');
          }, 350);
        }
        set({ theme });
        // Apply theme to DOM and update meta theme-color
        applyThemeToDOM(theme);
        syncThemeUrlParam(theme);
        // Sync shared cross-app theme key
        try {
          localStorage.setItem('lp-theme', theme);
        } catch {
          /* noop */
        }
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
      version: 16,
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
        // Migration from version 8 to version 9: invert filter logic
        // Old: all selected = no filter. New: empty array = no filter.
        if (version < 9) {
          const cats: string[] = persistedState.categories || [];
          const modes: string[] = persistedState.learningModes || [];
          // If all were selected (old "no filter"), convert to empty (new "no filter")
          if (cats.length >= DEFAULT_CATEGORIES.length) {
            persistedState = { ...persistedState, categories: [] };
          }
          if (modes.length >= DEFAULT_LEARNING_MODES.length) {
            persistedState = { ...persistedState, learningModes: [] };
          }
        }
        // Migration from version 9 to version 10: add reorderingMode to gameSettings
        if (version < 10) {
          const gs = persistedState.gameSettings || {};
          if (!gs.reorderingMode) {
            persistedState = {
              ...persistedState,
              gameSettings: {
                ...gs,
                reorderingMode: { itemCount: 10 },
              },
            };
          }
        }
        // Migration from version 10 to version 11: add transformationMode to gameSettings
        if (version < 11) {
          const gs = persistedState.gameSettings || {};
          if (!gs.transformationMode) {
            persistedState = {
              ...persistedState,
              gameSettings: {
                ...gs,
                transformationMode: { itemCount: 10 },
              },
            };
          }
        }
        // Migration from version 11 to version 12: add wordFormationMode and errorCorrectionMode to gameSettings
        if (version < 12) {
          const gs = persistedState.gameSettings || {};
          if (!gs.wordFormationMode) gs.wordFormationMode = { itemCount: 10 };
          if (!gs.errorCorrectionMode) gs.errorCorrectionMode = { itemCount: 10 };
          persistedState = { ...persistedState, gameSettings: gs };
        }
        // Migration from version 12 to version 13: adjust defaults (10→8, matching 6→5)
        if (version < 13) {
          const gs = persistedState.gameSettings || {};
          if (gs.flashcardMode && gs.flashcardMode.wordCount === 10) gs.flashcardMode.wordCount = 8;
          if (gs.quizMode && gs.quizMode.questionCount === 10) gs.quizMode.questionCount = 8;
          if (gs.completionMode && gs.completionMode.itemCount === 10)
            gs.completionMode.itemCount = 8;
          if (gs.matchingMode && gs.matchingMode.wordCount === 6) gs.matchingMode.wordCount = 5;
          if (gs.reorderingMode && gs.reorderingMode.itemCount === 10)
            gs.reorderingMode.itemCount = 8;
          if (gs.transformationMode && gs.transformationMode.itemCount === 10)
            gs.transformationMode.itemCount = 8;
          if (gs.wordFormationMode && gs.wordFormationMode.itemCount === 10)
            gs.wordFormationMode.itemCount = 8;
          if (gs.errorCorrectionMode && gs.errorCorrectionMode.itemCount === 10)
            gs.errorCorrectionMode.itemCount = 8;
          persistedState = { ...persistedState, gameSettings: gs };
        }
        // Migration from version 13 to version 14: sorting default 5→4
        if (version < 14) {
          const gs = persistedState.gameSettings || {};
          if (gs.sortingMode && gs.sortingMode.wordCount === 5) gs.sortingMode.wordCount = 4;
          persistedState = { ...persistedState, gameSettings: gs };
        }
        // Migration from version 14 to version 15: re-apply sorting 5→4 for stale persisted values
        if (version < 15) {
          const gs = persistedState.gameSettings || {};
          if (gs.sortingMode && gs.sortingMode.wordCount === 5) gs.sortingMode.wordCount = 4;
          persistedState = { ...persistedState, gameSettings: gs };
        }
        // Migration from version 15 to version 16: add dictationMode, listenCompleteMode,
        // listeningQuizMode to gameSettings (previously unconfigurable audio exercise modes)
        if (version < 16) {
          const gs = persistedState.gameSettings || {};
          if (!gs.dictationMode) gs.dictationMode = { itemCount: 8 };
          if (!gs.listenCompleteMode) gs.listenCompleteMode = { itemCount: 8 };
          if (!gs.listeningQuizMode) gs.listeningQuizMode = { itemCount: 8 };
          persistedState = { ...persistedState, gameSettings: gs };
        }
        return persistedState;
      },
      merge: (persistedState: any, currentState: SettingsState): SettingsState => {
        const merged = { ...currentState, ...persistedState };
        // Deep-merge gameSettings to ensure new modes get defaults
        if (persistedState && (persistedState as any).gameSettings) {
          merged.gameSettings = {
            ...currentState.gameSettings,
            ...(persistedState as any).gameSettings,
          };
        }
        return merged;
      },
      onRehydrateStorage: () => state => {
        // Shared lp-theme key is the authority
        const sharedTheme =
          typeof window !== 'undefined'
            ? (localStorage.getItem('lp-theme') as 'light' | 'dark' | null)
            : null;

        if (sharedTheme && (sharedTheme === 'dark' || sharedTheme === 'light')) {
          if (state && state.theme !== sharedTheme) {
            state.theme = sharedTheme;
          }
          applyThemeToDOM(sharedTheme);
        } else if (state?.theme) {
          applyThemeToDOM(state.theme);
        }
      },
    }
  )
);
