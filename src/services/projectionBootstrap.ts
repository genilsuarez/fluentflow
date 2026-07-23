// Bridges DeskFlow's learnflow:progress:fluentflow:v1 projection into FluentFlow's
// Zustand progress-storage. DeskFlow's sync-engine writes v1 on login; FluentFlow's
// UI reads completedModules — without this import the portal shows data but the app does not.
import {
  rebuildDailyProgressFromHistory,
  useProgressStore,
  waitForProgressHydration,
} from '../stores/progressStore';
import { useUserStore } from '../stores/userStore';
import type { RemoteActivityRow, RemoteProgressRow } from './supabaseClient';
import {
  mergeRemoteActivityHistory,
  mergeRemoteProgress,
  mergeUserScores,
  rebuildUserScoresFromHistory,
} from './progressMerge';

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

function readProjectionDocs(): {
  progress: ProjectionProgressDoc | null;
  activity: ProjectionActivityDoc | null;
} {
  try {
    const progress = JSON.parse(
      localStorage.getItem(PROGRESS_KEY) || 'null'
    ) as ProjectionProgressDoc;
    const activity = JSON.parse(
      localStorage.getItem(ACTIVITY_KEY) || 'null'
    ) as ProjectionActivityDoc;
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
