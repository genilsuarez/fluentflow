import { logDebug } from '../utils/logger';
import type { LearningModule } from '../types';

/** Ordered CEFR levels — index determines hierarchy */
const LEVEL_ORDER = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'] as const;

/**
 * Service for managing module progression and prerequisites
 */
export class ProgressionService {
  private modules: LearningModule[] = [];
  private moduleMap: Map<string, LearningModule> = new Map();
  private completedModules: Set<string> = new Set();
  private _initialized = false;
  /** Cache: modules grouped by their primary level */
  private modulesByLevel: Map<string, LearningModule[]> = new Map();

  /**
   * Whether the service has been initialized with modules
   */
  get initialized(): boolean {
    return this._initialized;
  }

  /**
   * Initialize the service with modules and completed modules
   */
  initialize(modules: LearningModule[], completedModuleIds: string[] = []): void {
    this.modules = modules;
    this.moduleMap = new Map(modules.map(m => [m.id, m]));
    // Filter out stale IDs that don't exist in the current module set
    // (e.g. renamed/removed modules still in persisted progress)
    const validCompletedIds = completedModuleIds.filter(id => this.moduleMap.has(id));
    this.completedModules = new Set(validCompletedIds);
    this._initialized = true;

    // Build level cache for gate checks
    this.modulesByLevel = new Map();
    for (const mod of modules) {
      const primaryLevel = this.getPrimaryLevel(mod);
      if (!primaryLevel) continue;
      const list = this.modulesByLevel.get(primaryLevel) ?? [];
      list.push(mod);
      this.modulesByLevel.set(primaryLevel, list);
    }

    logDebug(
      'ProgressionService initialized',
      {
        totalModules: modules.length,
        completedModules: completedModuleIds.length,
        modulesPerLevel: Object.fromEntries(
          [...this.modulesByLevel.entries()].map(([k, v]) => [k, v.length])
        ),
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
      // Module not in current set — either not loaded yet (race condition)
      // or a stale ID from persisted progress. Only log in dev to avoid
      // flooding production console (was causing ~138 errors per session).
      if (this._initialized) {
        logDebug('Module not in current set', { moduleId }, 'ProgressionService');
      }
      return false;
    }

    // Level gate: require 100% completion of the previous level before
    // any module in the next level can unlock. This prevents accessing
    // A2 while A1 still has incomplete modules, regardless of prerequisites.
    if (!this.isPreviousLevelComplete(module)) {
      return false;
    }

    // Cross-app gate: `lp-level` (localStorage) es el nivel CEFR combinado de
    // las 3 apps, calculado en lp-progress-summary.js con la regla FluentFlow
    // ≥100% + LyricFlow ≥100% + HubFlow ≥50% del nivel anterior. Sin este
    // check, terminar el nivel anterior solo en FluentFlow ya desbloqueaba el
    // siguiente aquí, aunque HubFlow/LyricFlow estuvieran muy por detrás —
    // isPreviousLevelComplete() de arriba solo mira el progreso propio de
    // FluentFlow. No se fusiona con ese método porque también alimenta
    // countsTowardProgress() (estadísticas del dashboard), que debe seguir
    // reflejando el progreso real de FluentFlow sin depender de las otras apps.
    if (!this.hasReachedCombinedLevel(module)) {
      return false;
    }

    // If no prerequisites, module is unlocked
    if (!module.prerequisites || module.prerequisites.length === 0) {
      return true;
    }

    // Check if all prerequisites are completed. Excepción: un prerequisito de un
    // nivel ANTERIOR al del propio módulo (ej. el módulo B1 "Education Reading"
    // exige el quiz de repaso de A2 "quiz-elementary-review-a2") cuenta como
    // satisfecho si el usuario ya autoevaluó ese nivel como dominado (onboarding,
    // Fase B.2) — mismo criterio que el level gate de arriba. Restringido a
    // prerequisitos de nivel *inferior* al del módulo: la inmensa mayoría de
    // prerequisitos del catálogo son del MISMO nivel (secuencia interna, ej. A1
    // exige A1) y esos deben seguir exigiendo completar de verdad — si no, alguien
    // con lp-level='a1' (el default de casi todo el mundo) se saltaría el orden
    // completo dentro de su propio nivel.
    const ownLevel = this.getPrimaryLevel(module);
    const moduleLevelIndex = ownLevel
      ? LEVEL_ORDER.indexOf(ownLevel as (typeof LEVEL_ORDER)[number])
      : -1;
    const baselineIndex = this.getSelfAssessedLevelIndex();
    const allPrerequisitesMet = module.prerequisites.every(prereqId => {
      if (this.completedModules.has(prereqId)) return true;
      const prereqModule = this.getModule(prereqId);
      const prereqLevel = prereqModule ? this.getPrimaryLevel(prereqModule) : null;
      const prereqLevelIndex = prereqLevel
        ? LEVEL_ORDER.indexOf(prereqLevel as (typeof LEVEL_ORDER)[number])
        : -1;
      return (
        prereqLevelIndex >= 0 &&
        prereqLevelIndex < moduleLevelIndex &&
        prereqLevelIndex <= baselineIndex
      );
    });

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
   * Módulo recomendado: normalmente el primer disponible en orden de catálogo.
   * Si el usuario se autoevaluó un nivel en el onboarding de DeskFlow (Fase B.2) y
   * quedan módulos de niveles anteriores sin completar, se prioriza igual un módulo
   * del nivel autoevaluado — evita recomendar contenido que el usuario ya dijo saber.
   * Esos módulos anteriores no desaparecen ni se marcan como completados, solo dejan
   * de ser "lo siguiente a hacer".
   */
  getRecommendedModule(): LearningModule | null {
    const available = this.getNextAvailableModules();
    if (available.length === 0) return null;

    const baselineIndex = this.getSelfAssessedLevelIndex();
    if (baselineIndex > 0) {
      const atBaseline = available.find(module => {
        const primaryLevel = this.getPrimaryLevel(module);
        const levelIndex = primaryLevel
          ? LEVEL_ORDER.indexOf(primaryLevel as (typeof LEVEL_ORDER)[number])
          : -1;
        return levelIndex === baselineIndex;
      });
      if (atBaseline) return atBaseline;
    }

    return available[0];
  }

  /**
   * Mark a module as completed and return newly unlocked modules
   */
  completeModule(moduleId: string): LearningModule[] {
    if (!this.getModule(moduleId)) {
      logDebug('Ignoring completion for unknown module', { moduleId }, 'ProgressionService');
      return [];
    }

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
   * Get the primary (first) level of a module
   */
  private getPrimaryLevel(module: LearningModule): string | null {
    if (!module.level) return null;
    return Array.isArray(module.level) ? module.level[0] : module.level;
  }

  /** Whether a completed module counts toward dashboard stats (catalog + level gate). */
  private countsTowardProgress(module: LearningModule): boolean {
    return this.completedModules.has(module.id) && this.isPreviousLevelComplete(module);
  }

  /**
   * Level gate: checks whether all modules of the previous CEFR level are completed.
   * A1 modules have no previous level and always pass this check.
   */
  private isPreviousLevelComplete(module: LearningModule): boolean {
    const primaryLevel = this.getPrimaryLevel(module);
    if (!primaryLevel) return true;

    const levelIndex = LEVEL_ORDER.indexOf(primaryLevel as (typeof LEVEL_ORDER)[number]);
    // A1 (index 0) or unknown level — no gate
    if (levelIndex <= 0) return true;

    // Autoevaluación de nivel (onboarding de DeskFlow, Fase B.2): si el usuario ya
    // se ubicó en este nivel o uno superior, no tiene sentido exigirle completar
    // niveles que dice ya dominar. Solo afecta este gate de acceso — el progreso
    // real (countsTowardProgress, más abajo) sigue exigiendo completar cada
    // módulo de verdad, esto no fabrica estadísticas de completado.
    if (levelIndex <= this.getSelfAssessedLevelIndex()) return true;

    const previousLevel = LEVEL_ORDER[levelIndex - 1];
    const previousLevelModules = this.modulesByLevel.get(previousLevel);
    if (!previousLevelModules || previousLevelModules.length === 0) return true;

    // All modules of the previous level must be completed
    return previousLevelModules.every(mod => this.completedModules.has(mod.id));
  }

  /** `true` si `lp-level` (combinado cross-app) ya alcanzó el nivel del módulo. A1 nunca lo requiere. */
  private hasReachedCombinedLevel(module: LearningModule): boolean {
    const primaryLevel = this.getPrimaryLevel(module);
    if (!primaryLevel) return true;
    const levelIndex = LEVEL_ORDER.indexOf(primaryLevel as (typeof LEVEL_ORDER)[number]);
    if (levelIndex <= 0) return true;
    return levelIndex <= this.getCombinedLevelIndex();
  }

  /**
   * Índice en LEVEL_ORDER de `lp-level` (localStorage), con default 'a1' si
   * la key no existe todavía — mismo fallback que readLpLevel() en el módulo
   * canónico lp-progress-summary.js. A diferencia de getSelfAssessedLevelIndex()
   * (que usa -1 como "sin autoevaluación" para un bypass opcional), este valor
   * es un gate obligatorio: tratar "sin key" como -1 aquí bloquearía A2 para
   * cualquier usuario nuevo, que nunca tiene 'lp-level' escrito hasta el
   * primer ascenso de nivel.
   */
  private getCombinedLevelIndex(): number {
    try {
      const stored = localStorage.getItem('lp-level') || 'a1';
      const idx = LEVEL_ORDER.indexOf(stored as (typeof LEVEL_ORDER)[number]);
      return idx === -1 ? 0 : idx;
    } catch {
      return 0;
    }
  }

  /** Índice en LEVEL_ORDER del nivel autoevaluado en `lp-level` (localStorage), o -1 si no hay ninguno. */
  private getSelfAssessedLevelIndex(): number {
    try {
      const stored = localStorage.getItem('lp-level');
      if (!stored) return -1;
      return LEVEL_ORDER.indexOf(stored as (typeof LEVEL_ORDER)[number]);
    } catch {
      return -1;
    }
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
    const completedInUnit = unitModules.filter(module => this.countsTowardProgress(module)).length;

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

    const completedModules = unitStats.reduce((sum, unit) => sum + unit.completed, 0);

    return {
      totalModules: this.modules.length,
      completedModules,
      unlockedModules: unlockedModules.length,
      lockedModules: lockedModules.length,
      completionPercentage:
        this.modules.length > 0 ? Math.round((completedModules / this.modules.length) * 100) : 0,
      unitStats,
    };
  }

  /**
   * Reset progression (for testing or user reset)
   */
  reset(): void {
    this.completedModules.clear();
    this._initialized = false;
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
    // Filter out stale IDs not in current module set
    const validIds = this._initialized
      ? completedModuleIds.filter(id => this.moduleMap.has(id))
      : completedModuleIds;
    this.completedModules = new Set(validIds);
    logDebug(
      'Completed modules updated',
      {
        count: validIds.length,
        filtered: completedModuleIds.length - validIds.length,
      },
      'ProgressionService'
    );
  }
}

// Export singleton instance
export const progressionService = new ProgressionService();
