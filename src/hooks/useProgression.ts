import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { progressionService } from '../services/progressionService';
import { useProgressStore } from '../stores/progressStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useAllModules } from './useModuleData';
import type { LearningModule } from '../types';

/**
 * Hook for managing module progression and prerequisites
 */
export const useProgression = () => {
  const { isLoading: modulesLoading } = useAllModules();
  const { getCompletedModuleIds, isModuleCompleted, completedModules } = useProgressStore();
  const { developmentMode } = useSettingsStore();
  const queryClient = useQueryClient();

  // Use raw (unfiltered) modules for progression — category filtering is visual only
  // and must not affect prerequisite chains or module unlock status
  const rawModules = queryClient.getQueryData<LearningModule[]>(['modules']) ?? [];

  // Track completed modules for query invalidation
  // Using completedModules object directly ensures React detects changes
  const completedModulesCount = Object.keys(completedModules || {}).length;

  // Initialize progression service synchronously (during render, not in useEffect)
  // so that helpers like getModuleStatus() work immediately without a timing gap.
  useMemo(() => {
    if (rawModules.length > 0) {
      const completedIds = getCompletedModuleIds();
      progressionService.initialize(rawModules, completedIds);
    }
  }, [rawModules, getCompletedModuleIds]);

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
          unlockedModules: [],
          lockedModules: [],
          nextAvailableModules: [],
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
    staleTime: 2 * 60 * 1000, // 2 minutes — progression only changes on module completion (tracked via queryKey)
    refetchOnMount: true, // Always refetch on mount
    refetchOnWindowFocus: false, // Don't refetch on window focus to avoid unnecessary updates
  });

  // Memoized helper functions
  const helpers = useMemo(
    () => ({
      isModuleUnlocked: (moduleId: string): boolean => {
        // In development mode, all modules are unlocked
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
        // In development mode, all modules are accessible
        if (developmentMode) {
          return true;
        }
        return progressionService.isModuleUnlocked(moduleId);
      },

      getModuleStatus: (moduleId: string): 'completed' | 'unlocked' | 'locked' => {
        if (isModuleCompleted(moduleId)) {
          return 'completed';
        }
        // In development mode, all modules are unlocked
        if (developmentMode || progressionService.isModuleUnlocked(moduleId)) {
          return 'unlocked';
        }
        return 'locked';
      },

      getUnlockedModulesByUnit: (unit: number): LearningModule[] => {
        const unitModules = progressionService.getModulesByUnit(unit);
        // In development mode, all modules are unlocked
        if (developmentMode) {
          return unitModules;
        }
        return unitModules.filter(module => progressionService.isModuleUnlocked(module.id));
      },

      getNextRecommendedModule: (): LearningModule | null => {
        const nextAvailable = progressionService.getNextAvailableModules();
        if (nextAvailable.length === 0) {
          return null;
        }

        // Use curriculum order (index in rawModules) as the canonical progression sequence.
        // The previous sort by unit + prereq count was non-deterministic and caused the same
        // module to always appear as "next" regardless of what was just completed.
        const indexMap = new Map(rawModules.map((m, i) => [m.id, i]));
        const sorted = nextAvailable.sort((a, b) => {
          const aIdx = indexMap.get(a.id) ?? Infinity;
          const bIdx = indexMap.get(b.id) ?? Infinity;
          return aIdx - bIdx;
        });

        return sorted[0];
      },
    }),
    [isModuleCompleted, developmentMode]
  );

  return {
    // Loading states
    isLoading: modulesLoading || progressionData.isLoading,

    // Data
    unlockedModules: progressionData.data?.unlockedModules || [],
    lockedModules: progressionData.data?.lockedModules || [],
    nextAvailableModules: progressionData.data?.nextAvailableModules || [],
    stats: progressionData.data?.stats || {
      totalModules: 0,
      completedModules: 0,
      unlockedModules: 0,
      lockedModules: 0,
      completionPercentage: 0,
      unitStats: [],
    },

    // Helper functions
    ...helpers,

    // Refresh function
    refresh: () => progressionData.refetch(),
  };
};

// useModuleProgression removed — was unused
