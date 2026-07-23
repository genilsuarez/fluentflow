// Bridges DeskFlow's learnflow:progress:fluentflow:v1 projection into FluentFlow's
// Zustand progress-storage. DeskFlow's sync-engine writes v1 on login; FluentFlow's
// UI reads completedModules — without this import the portal shows data but the app does not.
import {
  rebuildDailyProgressFromHistory,
  useProgressStore,
  waitForProgressHydration,
  type ModuleCompletion,
  type ProgressEntry,
} from '../stores/progressStore';
import { useUserStore } from '../stores/userStore';
import type { ModuleScore } from '../types';
import type { RemoteActivityRow, RemoteProgressRow } from './supabaseClient';

const PROGRESS_KEY = 'learnflow:progress:fluentflow:v1';
const ACTIVITY_KEY = 'learnflow:activity:fluentflow:v1';

interface ProjectionContentItem {
  contentId?: string;
  completed?: boolean;
  completedAt?: string | null;
  bestScorePct?: number | null;
  attempts?: number;
  progressPct?: number;
}

interface ProjectionProgressDoc {
  content?: Record<string, ProjectionContentItem>;
}

interface ProjectionActivityEvent {
  eventId: string;
  runId: string;
  contentId: string;
  activity: string;
  eventType?: string;
  occurredAt: string;
  scorePct?: number | null;
  passed?: boolean | null;
  durationMs?: number | null;
  metrics?: Record<string, unknown>;
}

interface ProjectionActivityDoc {
  events?: ProjectionActivityEvent[];
}

function normalizeIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function readProjectionDocs(): {
  progress: ProjectionProgressDoc | null;
  activity: ProjectionActivityDoc | null;
} {
  try {
    const progress = JSON.parse(localStorage.getItem(PROGRESS_KEY) || 'null') as ProjectionProgressDoc;
    const activity = JSON.parse(localStorage.getItem(ACTIVITY_KEY) || 'null') as ProjectionActivityDoc;
    return {
      progress: progress?.content ? progress : null,
      activity: Array.isArray(activity?.events) ? activity : null,
    };
  } catch {
    return { progress: null, activity: null };
  }
}

function progressDocToRows(doc: ProjectionProgressDoc): RemoteProgressRow[] {
  return Object.entries(doc.content ?? {})
    .filter(([, item]) => item?.completed)
    .map(([contentId, item]) => ({
      content_id: contentId,
      content_type: 'module',
      progress_pct: 100,
      completed: true,
      completed_at: item.completedAt ?? null,
      best_score_pct: item.bestScorePct ?? null,
      attempts: item.attempts ?? 0,
    }));
}

function activityDocToRows(doc: ProjectionActivityDoc): RemoteActivityRow[] {
  return (doc.events ?? []).map(event => ({
    event_id: event.eventId,
    run_id: event.runId,
    content_id: event.contentId,
    title: event.contentId,
    activity: event.activity,
    event_type: event.eventType || 'attempt_completed',
    occurred_at: event.occurredAt,
    score_pct: event.scorePct ?? null,
    passed: event.passed ?? null,
    duration_ms: event.durationMs ?? null,
    metrics: event.metrics ?? {},
  }));
}

function mergeRemoteProgress(
  local: Record<string, ModuleCompletion>,
  remote: RemoteProgressRow[]
): Record<string, ModuleCompletion> {
  const merged = { ...local };
  for (const row of remote) {
    if (!row.completed) continue;
    const existing = merged[row.content_id];
    merged[row.content_id] = {
      moduleId: row.content_id,
      completedAt:
        normalizeIsoDate(row.completed_at) || existing?.completedAt || new Date().toISOString(),
      bestScore: Math.max(row.best_score_pct ?? 0, existing?.bestScore ?? 0),
      attempts: Math.max(row.attempts ?? 0, existing?.attempts ?? 0),
    };
  }
  return merged;
}

function mergeRemoteActivityHistory(
  local: ProgressEntry[],
  remote: RemoteActivityRow[]
): ProgressEntry[] {
  const byRunId = new Map(local.map(entry => [entry.runId, entry]));

  for (const row of remote) {
    if (byRunId.has(row.run_id)) continue;
    const occurredAt = normalizeIsoDate(row.occurred_at);
    if (!occurredAt) continue;

    const metrics = row.metrics ?? {};
    const totalQuestions = Number(
      'totalQuestions' in metrics ? metrics.totalQuestions : 'total' in metrics ? metrics.total : 0
    );
    const correctAnswers = Number(
      'correctAnswers' in metrics
        ? metrics.correctAnswers
        : 'correct' in metrics
          ? metrics.correct
          : 0
    );

    byRunId.set(row.run_id, {
      date: occurredAt.slice(0, 10),
      eventId: row.event_id,
      runId: row.run_id,
      occurredAt,
      score: row.score_pct ?? 0,
      totalQuestions: Number.isFinite(totalQuestions) ? totalQuestions : 0,
      correctAnswers: Number.isFinite(correctAnswers) ? correctAnswers : 0,
      moduleId: row.content_id,
      learningMode: row.activity,
      timeSpent: row.duration_ms ? row.duration_ms / 1000 : undefined,
    });
  }

  return [...byRunId.values()].sort((left, right) =>
    right.occurredAt.localeCompare(left.occurredAt)
  );
}

function entryScorePct(entry: ProgressEntry): number {
  if (entry.totalQuestions > 0) {
    return Math.round((entry.correctAnswers / entry.totalQuestions) * 100);
  }
  return Math.max(0, Math.min(100, entry.score));
}

function rebuildUserScoresFromHistory(history: ProgressEntry[]): Record<string, ModuleScore> {
  const scores: Record<string, ModuleScore> = {};
  for (const entry of history) {
    if (!entry.moduleId) continue;
    const scorePct = entryScorePct(entry);
    const existing = scores[entry.moduleId];
    scores[entry.moduleId] = {
      moduleId: entry.moduleId,
      bestScore: Math.max(existing?.bestScore ?? 0, scorePct),
      attempts: (existing?.attempts ?? 0) + 1,
      lastAttempt:
        existing && existing.lastAttempt > entry.occurredAt
          ? existing.lastAttempt
          : entry.occurredAt,
      timeSpent: (existing?.timeSpent ?? 0) + (entry.timeSpent ?? 0),
    };
  }
  return scores;
}

function mergeUserScores(
  local: Record<string, ModuleScore>,
  fromHistory: Record<string, ModuleScore>
): Record<string, ModuleScore> {
  const merged = { ...local };
  for (const [moduleId, score] of Object.entries(fromHistory)) {
    const existing = merged[moduleId];
    merged[moduleId] = {
      moduleId,
      bestScore: Math.max(existing?.bestScore ?? 0, score.bestScore),
      attempts: Math.max(existing?.attempts ?? 0, score.attempts),
      lastAttempt:
        existing && existing.lastAttempt > score.lastAttempt
          ? existing.lastAttempt
          : score.lastAttempt,
      timeSpent: Math.max(existing?.timeSpent ?? 0, score.timeSpent),
    };
  }
  return merged;
}

/** Import completed modules + activity from the shared v1 projection into Zustand. */
export async function bootstrapFromLocalProjection(): Promise<boolean> {
  await waitForProgressHydration();

  const { progress, activity } = readProjectionDocs();
  if (!progress && !activity) return false;

  const progressRows = progress ? progressDocToRows(progress) : [];
  const activityRows = activity ? activityDocToRows(activity) : [];
  if (!progressRows.length && !activityRows.length) return false;

  const { completedModules, progressHistory } = useProgressStore.getState();
  const mergedModules = progressRows.length
    ? mergeRemoteProgress(completedModules, progressRows)
    : completedModules;
  const mergedHistory = activityRows.length
    ? mergeRemoteActivityHistory(progressHistory, activityRows)
    : progressHistory;

  const modulesChanged =
    Object.keys(mergedModules).length !== Object.keys(completedModules).length ||
    Object.entries(mergedModules).some(([id, mod]) => {
      const prev = completedModules[id];
      return !prev || prev.bestScore !== mod.bestScore || prev.attempts !== mod.attempts;
    });
  const historyChanged = mergedHistory.length !== progressHistory.length;

  if (!modulesChanged && !historyChanged) return false;

  useProgressStore.setState({
    completedModules: mergedModules,
    ...(historyChanged
      ? {
          progressHistory: mergedHistory,
          dailyProgress: rebuildDailyProgressFromHistory(mergedHistory),
        }
      : {}),
  });

  if (historyChanged) {
    const { userScores } = useUserStore.getState();
    useUserStore.setState({
      userScores: mergeUserScores(userScores, rebuildUserScoresFromHistory(mergedHistory)),
    });
  }

  return true;
}
