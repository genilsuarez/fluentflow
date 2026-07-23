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
      version: 1,
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
