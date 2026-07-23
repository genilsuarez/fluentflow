import type { LearningModule } from '../types';
import {
  buildCefrStats,
  getCountedCompletionIds,
  getPrimaryLevel,
} from '../utils/progressionCounting';

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

const PROGRESS_KEY = 'learnflow:progress:fluentflow:v1';
const ACTIVITY_KEY = 'learnflow:activity:fluentflow:v1';
const MAX_ACTIVITY_EVENTS = 200;

const clampPercentage = (value: number): number => Math.min(100, Math.max(0, value));

const toIsoTimestamp = (value: string): string | null => {
  const timestamp = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const hashCatalog = (modules: LearningModule[]): string => {
  const catalogIdentity = modules
    .map(module => `${module.id}:${getPrimaryLevel(module)}`)
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
  const attemptedIds = new Set(
    source.progressHistory
      .map(entry => entry.moduleId)
      .filter((moduleId): moduleId is string => Boolean(moduleId && knownModuleIds.has(moduleId)))
  );

  const moduleById = new Map(modules.map(module => [module.id, module]));

  let existingContent: Record<
    string,
    {
      completed?: boolean;
      completedAt?: string | null;
      bestScorePct?: number | null;
      attempts?: number;
      progressPct?: number;
    }
  > = {};
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { content?: typeof existingContent };
      if (parsed?.content) existingContent = parsed.content;
    }
  } catch {
    /* ignore */
  }

  const content = Object.fromEntries(
    modules.map(module => {
      const completion = source.completedModules[module.id];
      const existing = existingContent[module.id];
      const completed = Boolean(completion);
      const bestScore = Math.max(
        completion ? clampPercentage(completion.bestScore) : 0,
        existing?.bestScorePct ?? 0
      );
      const attempts = Math.max(completion?.attempts ?? 0, existing?.attempts ?? 0);
      const completedAt = completion
        ? toIsoTimestamp(completion.completedAt)
        : existing?.completedAt
          ? toIsoTimestamp(existing.completedAt as string)
          : null;

      return [
        module.id,
        {
          contentId: module.id,
          title: module.name,
          contentType: 'module',
          cefrLevel: getPrimaryLevel(module).toUpperCase(),
          progressPct: completed ? 100 : (existing?.progressPct ?? 0),
          completed,
          completedAt,
          bestScorePct: completed || bestScore > 0 ? bestScore : null,
          attempts,
        },
      ];
    })
  );

  const completedIds = getCountedCompletionIds(modules, Object.keys(source.completedModules));
  const cefr = buildCefrStats(modules, completedIds);

  const progress = {
    schemaVersion: 1,
    app: 'fluentflow',
    updatedAt: publishedAt,
    catalogVersion: hashCatalog(modules),
    summary: {
      progressPct: modules.length > 0 ? (completedIds.size / modules.length) * 100 : 0,
      completedContent: completedIds.size,
      totalContent: modules.length,
      attemptedContent: attemptedIds.size,
    },
    cefr,
    content,
  };

  const eventsFromSource = source.progressHistory
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
      title: moduleById.get(entry.moduleId as string)?.name ?? (entry.moduleId as string),
      activity: entry.learningMode ?? 'module',
      eventType: 'attempt_completed',
      occurredAt: toIsoTimestamp(entry.occurredAt as string) ?? publishedAt,
      scorePct: clampPercentage(entry.score),
      passed: entry.score >= 70,
      metrics: {
        correct: Math.max(0, entry.correctAnswers),
        total: Math.max(0, entry.totalQuestions),
      },
    }));

  let existingEvents: Array<(typeof eventsFromSource)[number]> = [];
  try {
    const raw = localStorage.getItem(ACTIVITY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { events?: typeof existingEvents };
      if (Array.isArray(parsed?.events)) existingEvents = parsed.events;
    }
  } catch {
    /* ignore */
  }

  const eventsById = new Map<string, (typeof eventsFromSource)[number]>();
  for (const event of existingEvents) {
    if (event?.eventId) eventsById.set(event.eventId, event);
  }
  for (const event of eventsFromSource) {
    eventsById.set(event.eventId, event);
  }

  const events = [...eventsById.values()]
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
