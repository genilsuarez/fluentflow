import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { progressionService } from '../services/progressionService';
import { useProgressStore } from '../stores/progressStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useAllModules } from './useModuleData';
import type { LearningModule } from '../types';

/**
 * Hook for managing module progression and prerequisites
 */
export const useProgression = () => {
  const { data: allModules = [], isLoading: modulesLoading } = useAllModules();
  const { getCompletedModuleIds, isModuleCompleted, completedModules } = useProgressStore();
  const { developmentMode } = useSettingsStore();

  // Initialize progression service when modules are loaded
  useEffect(() => {
    if (allModules.length > 0) {
      const completedIds = getCompletedModuleIds();
      progressionService.initialize(allModules, completedIds);
    }
  }, [allModules, getCompletedModuleIds]);

  // Track completed modules for query invalidation
  // Using completedModules object directly ensures React detects changes
  const completedModulesCount = Object.keys(completedModules || {}).length;

  // Force re-initialization when completed modules change
  useEffect(() => {
    if (allModules.length > 0 && completedModulesCount > 0) {
      const completedIds = getCompletedModuleIds();
      progressionService.setCompletedModules(completedIds);
    }
  }, [completedModulesCount, allModules.length, getCompletedModuleIds]);

  // Get progression data
  const progressionData = useQuery({
    queryKey: ['progression', allModules.length, completedModulesCount],
    queryFn: () => {
      if (allModules.length === 0) {
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
    enabled: allModules.length > 0,
    staleTime: 0, // No stale time - always refetch when dependencies change
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

        // Sort by unit and then by order within unit (based on prerequisites)
        const sorted = nextAvailable.sort((a, b) => {
          if (a.unit !== b.unit) {
            return a.unit - b.unit;
          }
          // Within same unit, prioritize modules with fewer prerequisites
          const aPrereqCount = a.prerequisites?.length || 0;
          const bPrereqCount = b.prerequisites?.length || 0;
          return aPrereqCount - bPrereqCount;
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

/**
 * Hook for getting progression info for a specific module
 */
export const useModuleProgression = (moduleId: string) => {
  const progression = useProgression();
  const { isModuleCompleted } = useProgressStore();

  return useMemo(() => {
    if (!moduleId || progression.isLoading) {
      return {
        isLoading: true,
        status: 'locked' as const,
        prerequisites: [],
        missingPrerequisites: [],
        progressionPath: [],
        canAccess: false,
      };
    }

    const status = progression.getModuleStatus(moduleId);
    const prerequisites = progression.getModulePrerequisites(moduleId);
    const missingPrerequisites = progression.getMissingPrerequisites(moduleId);
    const progressionPath = progression.getProgressionPath(moduleId);
    const canAccess = progression.canAccessModule(moduleId);

    return {
      isLoading: false,
      status,
      prerequisites,
      missingPrerequisites,
      progressionPath,
      canAccess,
      isCompleted: isModuleCompleted(moduleId),
      isUnlocked: status !== 'locked',
    };
  }, [moduleId, progression, isModuleCompleted]);
};
