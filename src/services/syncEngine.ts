// syncEngine.ts — Subscribes to progressStore and uploads to Supabase when
// authenticated. No login UI here: FluentFlow shares the Supabase session via
// localStorage with DeskFlow/HubFlow/LyricFlow on the same origin (production),
// same as it already does for the lp-user identity key (see userStore.ts).
import {
  useProgressStore,
  type ProgressEntry,
  type ModuleCompletion,
} from '../stores/progressStore';
import {
  isAuthenticated,
  onAuthStateChange,
  syncProgress,
  syncActivityEvents,
  type ActivityEventInput,
  type ProgressContentItem,
} from './supabaseClient';

const PASS_SCORE_PCT = 70;

function mapCompletedModules(
  completedModules: Record<string, ModuleCompletion>
): Record<string, ProgressContentItem> {
  return Object.fromEntries(
    Object.entries(completedModules).map(([moduleId, completion]) => [
      moduleId,
      {
        contentType: 'module',
        progressPct: 100,
        completed: true,
        completedAt: completion.completedAt,
        bestScorePct: completion.bestScore,
        lastScorePct: completion.bestScore,
        attempts: completion.attempts,
        activities: {},
      },
    ])
  );
}

function mapProgressHistory(entries: ProgressEntry[]): ActivityEventInput[] {
  return entries.map(entry => {
    const scorePct =
      entry.totalQuestions > 0
        ? Math.round((entry.correctAnswers / entry.totalQuestions) * 100)
        : Math.max(0, Math.min(100, entry.score));
    return {
      eventId: entry.eventId,
      runId: entry.runId,
      contentId: entry.moduleId || 'unknown',
      activity: entry.learningMode || 'practice',
      occurredAt: entry.occurredAt,
      scorePct,
      passed: scorePct >= PASS_SCORE_PCT,
      durationMs: entry.timeSpent ? Math.round(entry.timeSpent * 1000) : null,
      metrics: {
        totalQuestions: entry.totalQuestions,
        correctAnswers: entry.correctAnswers,
      },
    };
  });
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSync() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    syncTimer = null;
    const authed = await isAuthenticated().catch(() => false);
    if (!authed) return;

    const { completedModules, progressHistory } = useProgressStore.getState();
    if (Object.keys(completedModules).length) {
      await syncProgress(mapCompletedModules(completedModules));
    }
    if (progressHistory.length) {
      await syncActivityEvents(mapProgressHistory(progressHistory));
    }
  }, 500);
}

let initialized = false;

export function initSyncEngine(): void {
  if (initialized) return;
  initialized = true;

  useProgressStore.subscribe(() => scheduleSync());
  onAuthStateChange(async (_event, session) => {
    if (session?.user) scheduleSync();
  });
  isAuthenticated()
    .then(authed => {
      if (authed) scheduleSync();
    })
    .catch(() => {});
}
