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
  syncProgress,
  syncActivityEvents,
  fetchProgress,
  fetchActivityEvents,
  type ActivityEventInput,
  type ProgressContentItem,
  type RemoteProgressRow,
  type RemoteActivityRow,
} from './supabaseClient';
import { bootstrapFromLocalProjection } from './projectionBootstrap';

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

// Postgres/PostgREST devuelve timestamptz como "2026-07-16T00:00:00+00:00"
// (sin milisegundos, offset en vez de "Z"). progress-reader.js (DeskFlow) exige
// match exacto con Date#toISOString() para aceptar una fecha — sin normalizar,
// cualquier completedAt remoto invalida el documento derivado que lee DeskFlow.
function normalizeIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

// Mezcla filas remotas en completedModules sin retroceder progreso ya
// alcanzado localmente (favorece completado, mejor puntaje, más intentos).
function mergeRemoteProgress(
  local: Record<string, ModuleCompletion>,
  remote: RemoteProgressRow[]
): Record<string, ModuleCompletion> {
  const merged = { ...local };
  for (const row of remote) {
    if (!row.completed) continue; // completedModules solo trackea completados
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

let downloaded = false;

// Se llama una sola vez por sesión, justo después de autenticarse. No hay
// polling — el refresh normal ocurre vía scheduleSync() al completar algo.
async function downloadOnLogin() {
  if (downloaded) return;
  const authed = await isAuthenticated().catch(() => false);
  if (!authed) return;

  // Must wait for progress-storage rehydration — otherwise a late rehydrate
  // overwrites the merged remote progress with stale/empty local state.
  await waitForProgressHydration();
  if (downloaded) return;

  // DeskFlow may have already downloaded cloud data into the v1 projection keys.
  // Import those into Zustand before merging remote rows.
  await bootstrapFromLocalProjection();

  const [remoteProgress, remoteActivity] = await Promise.all([
    fetchProgress().catch(() => null),
    fetchActivityEvents().catch(() => null),
  ]);

  const { completedModules, progressHistory } = useProgressStore.getState();
  const hasLocalData =
    Object.keys(completedModules).length > 0 || progressHistory.length > 0;

  if (remoteProgress === null && remoteActivity === null) {
    if (hasLocalData) downloaded = true;
    return;
  }

  downloaded = true;
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

  if (remoteActivity?.length) {
    const { userScores } = useUserStore.getState();
    useUserStore.setState({
      userScores: mergeUserScores(userScores, rebuildUserScoresFromHistory(nextHistory)),
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

  onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      await downloadOnLogin();
      scheduleSync();
      return;
    }
    downloaded = false;
  });
  isAuthenticated()
    .then(async authed => {
      if (authed) {
        await downloadOnLogin();
        scheduleSync();
      }
    })
    .catch(() => {});
}
