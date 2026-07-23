// syncEngine.ts — Subscribes to progressStore and uploads to Supabase when
// authenticated. No login UI here: FluentFlow shares the Supabase session via
// localStorage with DeskFlow/HubFlow/LyricFlow on the same origin (production),
// same as it already does for the lp-user identity key (see userStore.ts).
import {
  useProgressStore,
  waitForProgressHydration,
  rebuildDailyProgressFromHistory,
  type ProgressEntry,
  type ModuleCompletion,
} from '../stores/progressStore';
import { useUserStore } from '../stores/userStore';
import type { ModuleScore } from '../types';
import {
  isAuthenticated,
  onAuthStateChange,
  signOut,
  syncProgress,
  syncActivityEvents,
  fetchProgress,
  fetchActivityEvents,
  type ActivityEventInput,
  type ProgressContentItem,
} from './supabaseClient';
import { bootstrapFromLocalProjection } from './projectionBootstrap';
import {
  mergeRemoteActivityHistory,
  mergeRemoteProgress,
  mergeUserScores,
  rebuildUserScoresFromHistory,
} from './progressMerge';

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
    if (!authed || !cloudHydrated) return;

    const { completedModules, progressHistory } = useProgressStore.getState();
    if (Object.keys(completedModules).length) {
      await syncProgress(mapCompletedModules(completedModules));
    }
    if (progressHistory.length) {
      await syncActivityEvents(mapProgressHistory(progressHistory));
    }
  }, 500);
}

function rebuildUserScoresFromCompletedModules(
  completedModules: Record<string, ModuleCompletion>
): Record<string, ModuleScore> {
  const scores: Record<string, ModuleScore> = {};
  for (const [moduleId, completion] of Object.entries(completedModules)) {
    scores[moduleId] = {
      moduleId,
      bestScore: completion.bestScore,
      attempts: completion.attempts,
      lastAttempt: completion.completedAt,
      timeSpent: 0,
    };
  }
  return scores;
}

let downloaded = false;
let cloudHydrated = false;

function resetDownloadState() {
  downloaded = false;
  cloudHydrated = false;
}

type GuestResetBridge = {
  shouldRejectSession: () => boolean;
  shouldForceCloudDownload: () => boolean;
  clearExplicitLogout: () => void;
};

function getGuestReset(): GuestResetBridge | undefined {
  return (window as Window & { lpGuestReset?: GuestResetBridge }).lpGuestReset;
}

export function handleSignedOut(): void {
  resetDownloadState();
  getGuestReset()?.clearExplicitLogout?.();
}

export async function handleAuthenticatedSession(event: string): Promise<void> {
  const guestReset = getGuestReset();
  if (guestReset?.shouldRejectSession?.()) {
    try {
      await signOut();
    } catch {
      /* noop */
    }
    guestReset.clearExplicitLogout?.();
    return;
  }

  if (event === 'SIGNED_IN' || guestReset?.shouldForceCloudDownload?.()) {
    resetDownloadState();
  }

  await downloadOnLogin({
    force: event === 'SIGNED_IN' || !!guestReset?.shouldForceCloudDownload?.(),
  });
  scheduleSync();
}

// Se llama una sola vez por sesión, justo después de autenticarse. No hay
// polling — el refresh normal ocurre vía scheduleSync() al completar algo.
async function downloadOnLogin({ force = false } = {}) {
  if (downloaded && !force) return;
  const authed = await isAuthenticated().catch(() => false);
  if (!authed) return;

  // Must wait for progress-storage rehydration — otherwise a late rehydrate
  // overwrites the merged remote progress with stale/empty local state.
  await waitForProgressHydration();
  if (downloaded && !force) return;

  // DeskFlow may have already downloaded cloud data into the v1 projection keys.
  // Import those into Zustand before merging remote rows.
  await bootstrapFromLocalProjection();

  const [remoteProgress, remoteActivity] = await Promise.all([
    fetchProgress().catch(() => null),
    fetchActivityEvents().catch(() => null),
  ]);

  if (remoteProgress === null && remoteActivity === null) {
    return;
  }

  downloaded = true;
  cloudHydrated = true;

  const { completedModules, progressHistory } = useProgressStore.getState();

  if (!remoteProgress?.length && !remoteActivity?.length) return;

  const nextState: {
    completedModules?: Record<string, ModuleCompletion>;
    progressHistory?: ProgressEntry[];
    dailyProgress?: Record<string, import('../stores/progressStore').DailyProgress>;
  } = {};

  let nextHistory = progressHistory;

  if (remoteProgress?.length) {
    nextState.completedModules = mergeRemoteProgress(completedModules, remoteProgress);
  }
  if (remoteActivity?.length) {
    nextHistory = mergeRemoteActivityHistory(progressHistory, remoteActivity);
    nextState.progressHistory = nextHistory;
    // Stats (sessions, time, averages) derive from dailyProgress — rebuild after
    // merging remote activity so they stay aligned with the history ledger.
    nextState.dailyProgress = rebuildDailyProgressFromHistory(nextHistory);
  }

  if (Object.keys(nextState).length) {
    useProgressStore.setState(nextState);
  }

  const mergedCompleted = nextState.completedModules ?? completedModules;
  if (remoteProgress?.length || remoteActivity?.length) {
    const { userScores } = useUserStore.getState();
    const fromHistory = rebuildUserScoresFromHistory(nextHistory);
    const fromCompleted = rebuildUserScoresFromCompletedModules(mergedCompleted);
    useUserStore.setState({
      userScores: mergeUserScores(mergeUserScores(userScores, fromHistory), fromCompleted),
    });
  }
}

let initialized = false;

export function initSyncEngine(): void {
  if (initialized) return;
  initialized = true;

  useProgressStore.subscribe(() => scheduleSync());

  // Same-origin DeskFlow may have populated v1 before FluentFlow mounts — import on cold start.
  void waitForProgressHydration().then(() => bootstrapFromLocalProjection());
}
