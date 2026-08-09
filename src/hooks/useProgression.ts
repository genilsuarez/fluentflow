import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { progressionService } from '../services/progressionService';
import { useProgressStore } from '../stores/progressStore';
import { useUserStore } from '../stores/userStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useModulesCatalog } from './useModuleData';
import type { LearningModule } from '../types';

/**
 * Hook for managing module progression and prerequisites
 */
export const useProgression = () => {
  const {
    data: rawModules = [],
    isLoading: modulesLoading,
    isFetched: modulesFetched,
  } = useModulesCatalog();
  const { getCompletedModuleIds, isModuleCompleted, completedModules } = useProgressStore();
  const { developmentMode } = useSettingsStore();

  // Track completed modules for query invalidation
  const completedModulesCount = Object.keys(completedModules || {}).length;
  const completedFromStore = completedModulesCount;

  // Initialize progression service synchronously (during render, not in useEffect)
  // so that helpers like getModuleStatus() work immediately without a timing gap.
  useMemo(() => {
    if (rawModules.length > 0) {
      const completedIds = getCompletedModuleIds();
      progressionService.initialize(rawModules, completedIds);
    }
  }, [rawModules, getCompletedModuleIds]);

  // Reconcile stale IDs from legacy migrations against the actual module catalog.
  useMemo(() => {
    if (rawModules.length > 0) {
      const validIds = new Set(rawModules.map(m => m.id));
      useProgressStore.getState().pruneStaleCatalogData(validIds);

      const { userScores } = useUserStore.getState();
      const prunedScores = Object.fromEntries(
        Object.entries(userScores).filter(([moduleId]) => validIds.has(moduleId))
      );
      if (Object.keys(prunedScores).length !== Object.keys(userScores).length) {
        useUserStore.setState({ userScores: prunedScores });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawModules.length]);

  // Force re-initialization when completed modules change
  useMemo(() => {
    if (rawModules.length > 0 && completedModulesCount > 0) {
      const completedIds = getCompletedModuleIds();
      progressionService.setCompletedModules(completedIds);
    }
  }, [completedModulesCount, rawModules.length, getCompletedModuleIds]);

  // Get progression data — keyed on raw modules count so it doesn't re-trigger on category changes
  const progressionData = useQuery({
    queryKey: ['progression', rawModules.length, completedModulesCount],
    queryFn: () => {
      if (rawModules.length === 0) {
        return {
          unlockedModules: [] as LearningModule[],
          lockedModules: [] as LearningModule[],
          nextAvailableModules: [] as LearningModule[],
          stats: {
            totalModules: 0,
            completedModules: 0,
            unlockedModules: 0,
            lockedModules: 0,
            completionPercentage: 0,
            unitStats: [],
          },
        };
      }

      return {
        unlockedModules: progressionService.getUnlockedModules(),
        lockedModules: progressionService.getLockedModules(),
        nextAvailableModules: progressionService.getNextAvailableModules(),
        stats: progressionService.getProgressionStats(),
      };
    },
    enabled: rawModules.length > 0,
    staleTime: 2 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const baseStats = progressionData.data?.stats || {
    totalModules: 0,
    completedModules: 0,
    unlockedModules: 0,
    lockedModules: 0,
    completionPercentage: 0,
    unitStats: [],
  };

  // While catalog loads (or if it failed), still surface persisted completion count.
  const stats =
    baseStats.totalModules > 0
      ? baseStats
      : {
          ...baseStats,
          completedModules: completedFromStore,
        };

  // Memoized helper functions
  const helpers = useMemo(
    () => ({
      isModuleUnlocked: (moduleId: string): boolean => {
        if (developmentMode) {
          return true;
        }
        return progressionService.isModuleUnlocked(moduleId);
      },

      getModulePrerequisites: (moduleId: string): LearningModule[] => {
        return progressionService.getModulePrerequisites(moduleId);
      },

      getMissingPrerequisites: (moduleId: string): LearningModule[] => {
        return progressionService.getMissingPrerequisites(moduleId);
      },

      getProgressionPath: (moduleId: string): LearningModule[] => {
        return progressionService.getProgressionPath(moduleId);
      },

      getModulesByUnit: (unit: number): LearningModule[] => {
        return progressionService.getModulesByUnit(unit);
      },

      getUnitCompletionStatus: (unit: number) => {
        return progressionService.getUnitCompletionStatus(unit);
      },

      canAccessModule: (moduleId: string): boolean => {
        if (developmentMode) {
          return true;
        }
        return progressionService.isModuleUnlocked(moduleId);
      },

      getModuleStatus: (moduleId: string): 'completed' | 'unlocked' | 'locked' => {
        if (isModuleCompleted(moduleId)) {
          return 'completed';
        }
        if (developmentMode || progressionService.isModuleUnlocked(moduleId)) {
          return 'unlocked';
        }
        return 'locked';
      },

      getUnlockedModulesByUnit: (unit: number): LearningModule[] => {
        const unitModules = progressionService.getModulesByUnit(unit);
        if (developmentMode) {
          return unitModules;
        }
        return unitModules.filter(module => progressionService.isModuleUnlocked(module.id));
      },

      getNextRecommendedModule: (): LearningModule | null => {
        return progressionService.getRecommendedModule();
      },
    }),
    [isModuleCompleted, developmentMode]
  );

  return {
    isLoading: modulesLoading || progressionData.isLoading,
    modulesFetched,

    unlockedModules: progressionData.data?.unlockedModules || [],
    lockedModules: progressionData.data?.lockedModules || [],
    nextAvailableModules: progressionData.data?.nextAvailableModules || [],
    stats,

    ...helpers,

    refresh: () => progressionData.refetch(),
  };
};
