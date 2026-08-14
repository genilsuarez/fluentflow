// syncEngine.ts — Subscribes to progressStore and uploads to Supabase when
// authenticated. No login UI here: FluentFlow shares the Supabase session via
// localStorage with DeskFlow/HubFlow/LyricFlow on the same origin (production),
// same as it already does for the lp-user identity key (see userStore.ts).
//
// Multi-session: pull on login + visibility/focus, BroadcastChannel peer
// refresh, pending upload queue until cloudHydrated, merge RPC on upload.
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
  signOut,
  syncProgress,
  syncActivityEvents,
  fetchProgress,
  fetchActivityEvents,
  isOAuthReturnUrl,
  type ActivityEventInput,
  type ProgressContentItem,
} from './supabaseClient';
import { bootstrapFromLocalProjection } from './projectionBootstrap';
import { purgeInvalidatedProgress } from './progressInvalidations';
import {
  mergeRemoteActivityHistory,
  mergeRemoteProgress,
  mergeUserScores,
  rebuildUserScoresFromHistory,
} from './progressMerge';
import { beginStatsDeferral, markStatsDisplayReady } from '../utils/statsBootstrap';
import { filterToKnownModules, readKnownModuleIds } from '../utils/catalogIds';

const PASS_SCORE_PCT = 70;
const VISIBILITY_REFRESH_MIN_MS = 12_000;
const SYNC_CHANNEL_NAME = 'lp-sync';

function mapCompletedModules(
  completedModules: Record<string, ModuleCompletion>
): Record<string, ProgressContentItem> {
  // Solo módulos del catálogo vigente: subir ids huérfanos los reinstala en
  // Supabase en cada sync (upsert_progress_merge es monotónico y nunca los
  // borra), y de ahí vuelven a bajar a todos los dispositivos. Ver catalogIds.ts.
  return Object.fromEntries(
    filterToKnownModules(Object.entries(completedModules)).map(([moduleId, completion]) => [
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
  // Solo eventos de módulos del catálogo vigente. activity_events es
  // append-only en Supabase (migración 003), así que una fila huérfana subida
  // desde acá solo se puede quitar con una migración server-side. Ver catalogIds.ts.
  const knownIds = readKnownModuleIds();
  const inCatalog = knownIds
    ? entries.filter(entry => !entry.moduleId || knownIds.has(entry.moduleId))
    : entries;
  return inCatalog.map(entry => {
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
let pendingCloudSync = false;
let lastVisibilityRefreshAt = 0;
let refreshingFromCloud = false;
let syncChannel: BroadcastChannel | null = null;
let uploading = false;
let needsReschedule = false;

function scheduleSync() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    syncTimer = null;
    if (shouldAbortCloudHydration()) return;
    const authed = await isAuthenticated().catch(() => false);
    if (!authed || shouldAbortCloudHydration()) return;
    if (!cloudHydrated) {
      pendingCloudSync = true;
      return;
    }
    if (uploading) {
      needsReschedule = true;
      return;
    }

    pendingCloudSync = false;
    uploading = true;
    try {
      // Pull before push so another device/tab's newer cloud rows win merge.
      await downloadOnLogin({ force: true });
      if (shouldAbortCloudHydration() || !(await isAuthenticated().catch(() => false))) {
        return;
      }

      const { completedModules, progressHistory } = useProgressStore.getState();
      if (Object.keys(completedModules).length) {
        await syncProgress(mapCompletedModules(completedModules));
      }
      if (progressHistory.length) {
        await syncActivityEvents(mapProgressHistory(progressHistory));
      }

      try {
        syncChannel?.postMessage({ type: 'progress-local', app: 'fluentflow', at: Date.now() });
      } catch {
        /* noop */
      }
    } finally {
      uploading = false;
      if (needsReschedule) {
        needsReschedule = false;
        scheduleSync();
      }
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
let activityFetchedThisSession = false;

const ACTIVITY_FETCHED_KEY = 'lp-activity-fetched:fluentflow';

function wasActivityFetched(): boolean {
  if (activityFetchedThisSession) return true;
  try {
    return sessionStorage.getItem(ACTIVITY_FETCHED_KEY) === '1';
  } catch {
    return false;
  }
}

function markActivityFetched(): void {
  activityFetchedThisSession = true;
  try {
    sessionStorage.setItem(ACTIVITY_FETCHED_KEY, '1');
  } catch {
    /* noop */
  }
}

function hasLocalActivityLedger(): boolean {
  try {
    const parsed = JSON.parse(localStorage.getItem('learnflow:activity:fluentflow:v1') || 'null');
    return Array.isArray(parsed?.events) && parsed.events.length > 0;
  } catch {
    return false;
  }
}

function resetDownloadState() {
  downloaded = false;
  cloudHydrated = false;
  activityFetchedThisSession = false;
  try {
    sessionStorage.removeItem(ACTIVITY_FETCHED_KEY);
  } catch {
    /* noop */
  }
  beginStatsDeferral();
}

function getGuestReset() {
  return window.lpGuestReset;
}

function shouldAbortCloudHydration(): boolean {
  return !!getGuestReset()?.isExplicitLogout?.();
}

function cancelPendingSync(): void {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
  pendingCloudSync = false;
  needsReschedule = false;
}

export function handleSignedOut(): void {
  cancelPendingSync();
  resetDownloadState();
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

  const forceDownload =
    event === 'SIGNED_IN' ||
    (event === 'INITIAL_SESSION' && isOAuthReturnUrl()) ||
    !!guestReset?.shouldForceCloudDownload?.();

  if (forceDownload) {
    resetDownloadState();
  }

  await downloadOnLogin({ force: forceDownload });
  scheduleSync();
}

async function applyPeerLocalProjection() {
  await waitForProgressHydration();
  await bootstrapFromLocalProjection();
}

// Se llama una sola vez por sesión, justo después de autenticarse. No hay
// polling — el refresh normal ocurre vía scheduleSync() / visibility.
async function downloadOnLogin({ force = false } = {}) {
  if (downloaded && !force) return;
  if (shouldAbortCloudHydration()) return;
  const authed = await isAuthenticated().catch(() => false);
  if (!authed || shouldAbortCloudHydration()) return;

  // Must wait for progress-storage rehydration — otherwise a late rehydrate
  // overwrites the merged remote progress with stale/empty local state.
  await waitForProgressHydration();
  if (downloaded && !force) {
    markStatsDisplayReady();
    return;
  }
  if (shouldAbortCloudHydration() || !(await isAuthenticated().catch(() => false))) return;

  // DeskFlow may have already downloaded cloud data into the v1 projection keys.
  // Import those into Zustand before merging remote rows.
  await bootstrapFromLocalProjection();
  if (shouldAbortCloudHydration() || !(await isAuthenticated().catch(() => false))) return;

  // Purge anything an admin invalidated server-side BEFORE merging/uploading
  // anything else this cycle — otherwise a stale local "completed" entry
  // gets merged back in below and re-uploaded by the scheduleSync() this
  // function triggers, undoing the correction. See progressInvalidations.ts.
  await purgeInvalidatedProgress().catch(() => false);
  if (shouldAbortCloudHydration() || !(await isAuthenticated().catch(() => false))) return;

  const [remoteProgress, remoteActivity] = await Promise.all([
    fetchProgress().catch(() => null),
    wasActivityFetched() || hasLocalActivityLedger()
      ? Promise.resolve([])
      : fetchActivityEvents().catch(() => null),
  ]);
  if (hasLocalActivityLedger() || (Array.isArray(remoteActivity) && remoteActivity.length > 0)) {
    markActivityFetched();
  }

  if (shouldAbortCloudHydration() || !(await isAuthenticated().catch(() => false))) {
    getGuestReset()?.clearGuestLocalProgress?.();
    resetDownloadState();
    markStatsDisplayReady();
    return;
  }

  const fetchFailed = remoteProgress === null && remoteActivity === null;
  if (!fetchFailed) {
    downloaded = true;
    cloudHydrated = true;

    if (pendingCloudSync) {
      pendingCloudSync = false;
      scheduleSync();
    }

    const { completedModules, progressHistory } = useProgressStore.getState();

    if (remoteProgress?.length || remoteActivity?.length) {
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
      const { userScores } = useUserStore.getState();
      const fromHistory = rebuildUserScoresFromHistory(nextHistory);
      const fromCompleted = rebuildUserScoresFromCompletedModules(mergedCompleted);
      useUserStore.setState({
        userScores: mergeUserScores(mergeUserScores(userScores, fromHistory), fromCompleted),
      });
    }
  }

  markStatsDisplayReady();
  if (cloudHydrated) {
    window.dispatchEvent(new CustomEvent('lp-cloud-hydrated'));
  }
}

async function refreshFromCloudIfNeeded({ force = false } = {}) {
  if (refreshingFromCloud) return;
  if (shouldAbortCloudHydration()) return;
  if (!cloudHydrated && !force) return;
  if (!force && Date.now() - lastVisibilityRefreshAt < VISIBILITY_REFRESH_MIN_MS) return;

  const authed = await isAuthenticated().catch(() => false);
  if (!authed || shouldAbortCloudHydration()) return;

  refreshingFromCloud = true;
  lastVisibilityRefreshAt = Date.now();
  try {
    await downloadOnLogin({ force: true });
  } finally {
    refreshingFromCloud = false;
  }
}

function setupMultiSessionHooks() {
  if (typeof window === 'undefined') return;

  if (typeof BroadcastChannel !== 'undefined' && !syncChannel) {
    try {
      syncChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
      syncChannel.onmessage = event => {
        const msg = event?.data;
        if (!msg || typeof msg !== 'object') return;
        if (msg.type === 'progress-local' || msg.type === 'cloud-refreshed') {
          void applyPeerLocalProjection();
          if (msg.type === 'cloud-refreshed') {
            void refreshFromCloudIfNeeded({ force: true });
          }
        }
      };
    } catch {
      syncChannel = null;
    }
  }

  const onVisible = () => {
    if (document.visibilityState && document.visibilityState !== 'visible') return;
    void refreshFromCloudIfNeeded();
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onVisible);
  window.addEventListener('online', () => {
    void refreshFromCloudIfNeeded({ force: true });
  });
  window.addEventListener('lp-sync-peer', () => {
    void applyPeerLocalProjection();
  });
  window.addEventListener('lp-guest-reset', () => {
    cancelPendingSync();
    resetDownloadState();
  });
  window.addEventListener('lp-explicit-logout', () => {
    cancelPendingSync();
    resetDownloadState();
  });
}

let initialized = false;

export function initSyncEngine(): void {
  if (initialized) return;
  initialized = true;

  setupMultiSessionHooks();
  useProgressStore.subscribe(() => {
    if (uploading) {
      needsReschedule = true;
      return;
    }
    scheduleSync();
  });

  // Same-origin DeskFlow may have populated v1 before FluentFlow mounts — import on cold start.
  void waitForProgressHydration().then(() => bootstrapFromLocalProjection());
}
