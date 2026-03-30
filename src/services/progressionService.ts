import { logDebug, logError } from '../utils/logger';
import type { LearningModule } from '../types';

/**
 * Service for managing module progression and prerequisites
 */
export class ProgressionService {
  private modules: LearningModule[] = [];
  private moduleMap: Map<string, LearningModule> = new Map();
  private completedModules: Set<string> = new Set();

  /**
   * Initialize the service with modules and completed modules
   */
  initialize(modules: LearningModule[], completedModuleIds: string[] = []): void {
    this.modules = modules;
    this.moduleMap = new Map(modules.map(m => [m.id, m]));
    this.completedModules = new Set(completedModuleIds);

    logDebug(
      'ProgressionService initialized',
      {
        totalModules: modules.length,
        completedModules: completedModuleIds.length,
      },
      'ProgressionService'
    );
  }

  /**
   * Check if a module is unlocked based on its prerequisites
   */
  isModuleUnlocked(moduleId: string): boolean {
    const module = this.getModule(moduleId);
    if (!module) {
      logError('Module not found', { moduleId }, 'ProgressionService');
      return false;
    }

    // If no prerequisites, module is unlocked
    if (!module.prerequisites || module.prerequisites.length === 0) {
      return true;
    }

    // Check if all prerequisites are completed
    const allPrerequisitesMet = module.prerequisites.every(prereqId =>
      this.completedModules.has(prereqId)
    );

    logDebug(
      'Checking module unlock status',
      {
        moduleId,
        prerequisites: module.prerequisites,
        completedModules: Array.from(this.completedModules),
        isUnlocked: allPrerequisitesMet,
      },
      'ProgressionService'
    );

    return allPrerequisitesMet;
  }

  /**
   * Get all modules that are currently unlocked
   */
  getUnlockedModules(): LearningModule[] {
    return this.modules.filter(module => this.isModuleUnlocked(module.id));
  }

  /**
   * Get all modules that are locked
   */
  getLockedModules(): LearningModule[] {
    return this.modules.filter(module => !this.isModuleUnlocked(module.id));
  }

  /**
   * Get next available modules that can be unlocked
   */
  getNextAvailableModules(): LearningModule[] {
    return this.modules.filter(
      module => !this.completedModules.has(module.id) && this.isModuleUnlocked(module.id)
    );
  }

  /**
   * Mark a module as completed and return newly unlocked modules
   */
  completeModule(moduleId: string): LearningModule[] {
    if (this.completedModules.has(moduleId)) {
      logDebug('Module already completed', { moduleId }, 'ProgressionService');
      return [];
    }

    // Get modules that were locked before completion
    const previouslyLockedModules = this.getLockedModules();

    // Mark module as completed
    this.completedModules.add(moduleId);

    // Find newly unlocked modules
    const newlyUnlockedModules = previouslyLockedModules.filter(module =>
      this.isModuleUnlocked(module.id)
    );

    logDebug(
      'Module completed',
      {
        moduleId,
        newlyUnlockedCount: newlyUnlockedModules.length,
        newlyUnlockedModules: newlyUnlockedModules.map(m => m.id),
      },
      'ProgressionService'
    );

    return newlyUnlockedModules;
  }

  /**
   * Get module by ID
   */
  private getModule(moduleId: string): LearningModule | undefined {
    return this.moduleMap.get(moduleId);
  }

  /**
   * Get prerequisites for a module
   */
  getModulePrerequisites(moduleId: string): LearningModule[] {
    const module = this.getModule(moduleId);
    if (!module || !module.prerequisites) {
      return [];
    }

    return module.prerequisites
      .map(prereqId => this.getModule(prereqId))
      .filter((prereq): prereq is LearningModule => prereq !== undefined);
  }

  /**
   * Get missing prerequisites for a module
   */
  getMissingPrerequisites(moduleId: string): LearningModule[] {
    const prerequisites = this.getModulePrerequisites(moduleId);
    return prerequisites.filter(prereq => !this.completedModules.has(prereq.id));
  }

  /**
   * Get progression path for a module (all prerequisites in order)
   */
  getProgressionPath(moduleId: string): LearningModule[] {
    const visited = new Set<string>();
    const path: LearningModule[] = [];

    const buildPath = (currentModuleId: string): void => {
      if (visited.has(currentModuleId)) {
        return; // Avoid circular dependencies
      }

      visited.add(currentModuleId);
      const module = this.getModule(currentModuleId);

      if (!module) {
        return;
      }

      // First, add all prerequisites
      if (module.prerequisites) {
        module.prerequisites.forEach(prereqId => {
          buildPath(prereqId);
        });
      }

      // Then add the current module if not already in path
      if (!path.find(m => m.id === currentModuleId)) {
        path.push(module);
      }
    };

    buildPath(moduleId);
    return path;
  }

  /**
   * Get modules by unit (for progression tracking)
   */
  getModulesByUnit(unit: number): LearningModule[] {
    return this.modules.filter(module => module.unit === unit);
  }

  /**
   * Get completion status for a unit
   */
  getUnitCompletionStatus(unit: number): {
    total: number;
    completed: number;
    percentage: number;
    allCompleted: boolean;
  } {
    const unitModules = this.getModulesByUnit(unit);
    const completedInUnit = unitModules.filter(module =>
      this.completedModules.has(module.id)
    ).length;

    return {
      total: unitModules.length,
      completed: completedInUnit,
      percentage:
        unitModules.length > 0 ? Math.round((completedInUnit / unitModules.length) * 100) : 0,
      allCompleted: completedInUnit === unitModules.length && unitModules.length > 0,
    };
  }

  /**
   * Get overall progression statistics
   */
  getProgressionStats(): {
    totalModules: number;
    completedModules: number;
    unlockedModules: number;
    lockedModules: number;
    completionPercentage: number;
    unitStats: Array<{
      unit: number;
      total: number;
      completed: number;
      percentage: number;
    }>;
  } {
    const unlockedModules = this.getUnlockedModules();
    const lockedModules = this.getLockedModules();

    // Get unit statistics
    const units = [...new Set(this.modules.map(m => m.unit))].sort();
    const unitStats = units.map(unit => {
      const status = this.getUnitCompletionStatus(unit);
      return {
        unit,
        total: status.total,
        completed: status.completed,
        percentage: status.percentage,
      };
    });

    return {
      totalModules: this.modules.length,
      completedModules: this.completedModules.size,
      unlockedModules: unlockedModules.length,
      lockedModules: lockedModules.length,
      completionPercentage:
        this.modules.length > 0
          ? Math.round((this.completedModules.size / this.modules.length) * 100)
          : 0,
      unitStats,
    };
  }

  /**
   * Reset progression (for testing or user reset)
   */
  reset(): void {
    this.completedModules.clear();
    logDebug('Progression reset', {}, 'ProgressionService');
  }

  /**
   * Get completed modules list
   */
  getCompletedModules(): string[] {
    return Array.from(this.completedModules);
  }

  /**
   * Set completed modules (for initialization from storage)
   */
  setCompletedModules(completedModuleIds: string[]): void {
    this.completedModules = new Set(completedModuleIds);
    logDebug(
      'Completed modules updated',
      {
        count: completedModuleIds.length,
      },
      'ProgressionService'
    );
  }
}

// Export singleton instance
export const progressionService = new ProgressionService();
