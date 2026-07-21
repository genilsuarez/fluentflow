import type { LearningModule } from '../types';

const PROGRESS_KEY = 'learnflow:progress:fluentflow:v1';
const ACTIVITY_KEY = 'learnflow:activity:fluentflow:v1';
const MAX_ACTIVITY_EVENTS = 200;
const CEFR_LEVELS = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'] as const;

type CefrLevel = (typeof CEFR_LEVELS)[number];

interface ProgressEntrySource {
  eventId?: string;
  runId?: string;
  occurredAt?: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  moduleId?: string;
  learningMode?: string;
}

interface ModuleCompletionSource {
  moduleId: string;
  completedAt: string;
  bestScore: number;
  attempts: number;
}

interface LearnFlowProgressSource {
  progressHistory: ProgressEntrySource[];
  completedModules: Record<string, ModuleCompletionSource>;
}

const clampPercentage = (value: number): number => Math.min(100, Math.max(0, value));

const toIsoTimestamp = (value: string): string | null => {
  const timestamp = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const getModuleLevel = (module: LearningModule): CefrLevel => {
  const level = Array.isArray(module.level) ? module.level[0] : module.level;
  return CEFR_LEVELS.includes(level as CefrLevel) ? (level as CefrLevel) : 'a1';
};

const hashCatalog = (modules: LearningModule[]): string => {
  const catalogIdentity = modules
    .map(module => `${module.id}:${getModuleLevel(module)}`)
    .sort()
    .join('|');
  let hash = 2166136261;

  for (let index = 0; index < catalogIdentity.length; index += 1) {
    hash ^= catalogIdentity.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `catalog-${modules.length}-${(hash >>> 0).toString(16)}`;
};

export const createLearnFlowId = (prefix: 'event' | 'run'): string => {
  const randomId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${randomId}`;
};

export const publishLearnFlowIntegration = (
  modules: LearningModule[],
  source: LearnFlowProgressSource
): void => {
  if (modules.length === 0) return;

  const publishedAt = new Date().toISOString();
  const knownModuleIds = new Set(modules.map(module => module.id));
  const completedIds = new Set(
    Object.keys(source.completedModules).filter(moduleId => knownModuleIds.has(moduleId))
  );
  const attemptedIds = new Set(
    source.progressHistory
      .map(entry => entry.moduleId)
      .filter((moduleId): moduleId is string => Boolean(moduleId && knownModuleIds.has(moduleId)))
  );

  const moduleById = new Map(modules.map((module) => [module.id, module]));

  const content = Object.fromEntries(
    modules.map(module => {
      const completion = source.completedModules[module.id];
      const completed = Boolean(completion);
      return [
        module.id,
        {
          contentId: module.id,
          title: module.name,
          contentType: 'module',
          cefrLevel: getModuleLevel(module).toUpperCase(),
          progressPct: completed ? 100 : 0,
          completed,
          completedAt: completion ? toIsoTimestamp(completion.completedAt) : null,
          bestScorePct: completion ? clampPercentage(completion.bestScore) : null,
          attempts: completion?.attempts ?? 0,
        },
      ];
    })
  );

  const cefr = Object.fromEntries(
    CEFR_LEVELS.map(level => {
      const levelModules = modules.filter(module => getModuleLevel(module) === level);
      const completedModules = levelModules.filter(module => completedIds.has(module.id)).length;
      const progressPct =
        levelModules.length > 0 ? (completedModules / levelModules.length) * 100 : 0;
      const status =
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
  );

  const progress = {
    schemaVersion: 1,
    app: 'fluentflow',
    updatedAt: publishedAt,
    catalogVersion: hashCatalog(modules),
    summary: {
      progressPct: (completedIds.size / modules.length) * 100,
      completedContent: completedIds.size,
      totalContent: modules.length,
      attemptedContent: attemptedIds.size,
    },
    cefr,
    content,
  };

  const events = source.progressHistory
    .filter(
      entry =>
        entry.moduleId &&
        knownModuleIds.has(entry.moduleId) &&
        entry.eventId &&
        entry.runId &&
        entry.occurredAt
    )
    .map(entry => ({
      eventId: entry.eventId as string,
      runId: entry.runId as string,
      app: 'fluentflow',
      contentId: entry.moduleId as string,
      title: moduleById.get(entry.moduleId as string)?.name ?? entry.moduleId as string,
      activity: entry.learningMode ?? 'module',
      eventType: 'attempt_completed',
      occurredAt: toIsoTimestamp(entry.occurredAt as string) ?? publishedAt,
      scorePct: clampPercentage(entry.score),
      passed: entry.score >= 70,
      metrics: {
        correct: Math.max(0, entry.correctAnswers),
        total: Math.max(0, entry.totalQuestions),
      },
    }))
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .slice(0, MAX_ACTIVITY_EVENTS);

  const activity = {
    schemaVersion: 1,
    app: 'fluentflow',
    updatedAt: publishedAt,
    events,
  };

  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activity));
  } catch {
    // Integration snapshots are reconstructible; source progress remains untouched.
  }
};
