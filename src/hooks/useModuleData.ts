import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSettingsStore } from '../stores/settingsStore';
import { apiService, fetchModules, fetchModuleData } from '../services/api';
import type { LearningModule } from '../types';

/**
 * Pure function that returns the unselected categories (or modes) containing prerequisites of a module.
 * Used to show dependency indicators when categories or learning modes are filtered out.
 */
export function getHiddenDependencies(
  module: LearningModule,
  allModules: LearningModule[],
  selectedCategories: string[],
  selectedModes?: string[]
): string[] {
  const hiddenReasons = new Set<string>();
  const moduleMap = new Map(allModules.map(m => [m.id, m]));

  for (const prereqId of module.prerequisites) {
    const prereq = moduleMap.get(prereqId);
    if (!prereq) continue;

    if (selectedCategories.length > 0 && !selectedCategories.includes(prereq.category)) {
      hiddenReasons.add(prereq.category);
    } else if (
      selectedModes &&
      selectedModes.length > 0 &&
      !selectedModes.includes(prereq.learningMode)
    ) {
      hiddenReasons.add(prereq.learningMode);
    }
  }

  return Array.from(hiddenReasons);
}

export const useModuleData = (moduleId: string) => {
  const { level, gameSettings, developmentMode } = useSettingsStore();

  // Session key ensures a fresh shuffle each time the hook mounts (new game session).
  // We use a ref-like approach via a module-level map so the key is stable within
  // a single component lifecycle but changes on remount (new session).
  const sessionKey = React.useRef(Date.now()).current;

  // Cache the select result so filterModuleData (which shuffles) only runs once
  // per raw data identity. Without this, select runs on every render and
  // produces different shuffled subsets, breaking components that compare
  // against the original data (e.g., MatchingComponent's pair checking).
  const cachedSelectRef = React.useRef<{ rawData: unknown; result: LearningModule | null }>({
    rawData: null,
    result: null,
  });

  return useQuery({
    queryKey: ['module', moduleId, sessionKey],
    queryFn: async () => {
      const response = await fetchModuleData(moduleId);
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch module data');
      }
      return response.data;
    },
    networkMode: 'always', // Allow queries offline - service worker handles caching
    select: (module: LearningModule) => {
      // Return cached result if raw data hasn't changed (same reference)
      if (cachedSelectRef.current.rawData === module.data && cachedSelectRef.current.result) {
        return cachedSelectRef.current.result;
      }

      // Apply filtering using the service layer
      if (module.data && Array.isArray(module.data)) {
        // Determine limit based on game settings
        let limit = 10; // default

        if (module.learningMode) {
          switch (module.learningMode) {
            case 'flashcard':
              limit = gameSettings.flashcardMode.wordCount;
              break;
            case 'quiz':
              limit = gameSettings.quizMode.questionCount;
              break;
            case 'completion':
              limit = gameSettings.completionMode.itemCount;
              break;
            case 'sorting':
              // For sorting mode, we need more data than the final word count
              // because the component will select words from multiple categories
              limit =
                gameSettings.sortingMode.wordCount * gameSettings.sortingMode.categoryCount * 2;
              break;
            case 'matching':
              limit = gameSettings.matchingMode.wordCount;
              break;
          }
        }

        const filteredData = apiService.filterModuleData(
          module.data,
          {
            level: developmentMode ? 'all' : level,
            limit,
          },
          moduleId
        );

        const result = { ...module, data: filteredData };
        cachedSelectRef.current = { rawData: module.data, result };
        return result;
      }

      cachedSelectRef.current = { rawData: module.data, result: module };
      return module;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('not found')) {
        return false; // Don't retry for 404-like errors
      }
      if (error instanceof Error && error.message.includes('parse JSON')) {
        return false; // Don't retry parse errors
      }
      if (error instanceof Error && error.message.includes('not available offline')) {
        return false; // Don't retry offline errors — show modal immediately
      }
      return failureCount < 2; // Aligned with QueryClient global config
    },
    refetchOnWindowFocus: false,
  });
};

export const useAllModules = () => {
  const { categories, learningModes, level, developmentMode } = useSettingsStore();

  return useQuery({
    queryKey: ['modules'],
    queryFn: async () => {
      const response = await fetchModules();
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch modules');
      }
      return response.data;
    },
    networkMode: 'always', // Allow queries offline - service worker handles caching
    select: (modules: LearningModule[]) => {
      // In development mode, show all modules without filtering
      if (developmentMode) {
        return modules;
      }

      // Filter modules based on settings
      return modules.filter(module => {
        // Filter by categories
        if (categories.length > 0 && module.category) {
          if (!categories.includes(module.category)) {
            return false;
          }
        }

        // Filter by learning modes
        if (learningModes?.length > 0 && module.learningMode) {
          if (!learningModes.includes(module.learningMode)) {
            return false;
          }
        }

        // Filter by level - module.level can be array or string
        if (level !== 'all' && module.level) {
          const moduleLevels = Array.isArray(module.level) ? module.level : [module.level];
          if (!moduleLevels.includes(level as any)) {
            return false;
          }
        }

        return true;
      });
    },
    staleTime: 15 * 60 * 1000, // 15 minutes for modules list (longer than module data — list changes rarely)
    retry: (failureCount, error) => {
      // Don't retry parse errors
      if (error instanceof Error && error.message.includes('parse JSON')) {
        return false;
      }
      return failureCount < 2; // Aligned with QueryClient global config
    },
    refetchOnWindowFocus: false, // Explicit — don't refetch list on tab focus
  });
};
