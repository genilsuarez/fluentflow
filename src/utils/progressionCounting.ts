import type { LearningModule } from '../types';

export const CEFR_LEVEL_ORDER = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'] as const;
export type CefrLevel = (typeof CEFR_LEVEL_ORDER)[number];

export function getPrimaryLevel(module: Pick<LearningModule, 'level'>): CefrLevel {
  const level = Array.isArray(module.level) ? module.level[0] : module.level;
  return CEFR_LEVEL_ORDER.includes(level as CefrLevel) ? (level as CefrLevel) : 'a1';
}

export function buildModulesByLevel(modules: LearningModule[]): Map<string, LearningModule[]> {
  const map = new Map<string, LearningModule[]>();
  for (const mod of modules) {
    const primaryLevel = getPrimaryLevel(mod);
    const list = map.get(primaryLevel) ?? [];
    list.push(mod);
    map.set(primaryLevel, list);
  }
  return map;
}

export function isPreviousLevelComplete(
  module: LearningModule,
  completedIds: Set<string>,
  modulesByLevel: Map<string, LearningModule[]>
): boolean {
  const primaryLevel = getPrimaryLevel(module);
  const levelIndex = CEFR_LEVEL_ORDER.indexOf(primaryLevel);
  if (levelIndex <= 0) return true;

  const previousLevel = CEFR_LEVEL_ORDER[levelIndex - 1];
  const previousLevelModules = modulesByLevel.get(previousLevel);
  if (!previousLevelModules || previousLevelModules.length === 0) return true;

  return previousLevelModules.every(mod => completedIds.has(mod.id));
}

export function countsTowardProgress(
  module: LearningModule,
  completedIds: Set<string>,
  modulesByLevel: Map<string, LearningModule[]>
): boolean {
  return (
    completedIds.has(module.id) && isPreviousLevelComplete(module, completedIds, modulesByLevel)
  );
}

/** Completed module IDs that count toward stats (catalog-valid + level gate). */
export function getCountedCompletionIds(
  modules: LearningModule[],
  completedModuleIds: Iterable<string>
): Set<string> {
  const moduleIds = new Set(modules.map(m => m.id));
  const completedIds = new Set([...completedModuleIds].filter(id => moduleIds.has(id)));
  const modulesByLevel = buildModulesByLevel(modules);

  return new Set(
    modules.filter(m => countsTowardProgress(m, completedIds, modulesByLevel)).map(m => m.id)
  );
}

export type CefrLevelStats = {
  progressPct: number;
  completedModules: number;
  totalModules: number;
  status: 'not_started' | 'in_progress' | 'near_completion' | 'completed';
};

export function buildCefrStats(
  modules: LearningModule[],
  countedIds: Set<string>
): Record<string, CefrLevelStats> {
  return Object.fromEntries(
    CEFR_LEVEL_ORDER.map(level => {
      const levelModules = modules.filter(module => getPrimaryLevel(module) === level);
      const completedModules = levelModules.filter(module => countedIds.has(module.id)).length;
      const progressPct =
        levelModules.length > 0 ? (completedModules / levelModules.length) * 100 : 0;
      const status: CefrLevelStats['status'] =
        completedModules === 0
          ? 'not_started'
          : completedModules === levelModules.length
            ? 'completed'
            : progressPct >= 80
              ? 'near_completion'
              : 'in_progress';

      return [
        level.toUpperCase(),
        {
          progressPct,
          completedModules,
          totalModules: levelModules.length,
          status,
        },
      ];
    })
  ) as Record<string, CefrLevelStats>;
}
