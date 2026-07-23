// syncEngine.ts — Subscribes to progressStore and uploads to Supabase when
// authenticated. No login UI here: FluentFlow shares the Supabase session via
// localStorage with DeskFlow/HubFlow/LyricFlow on the same origin (production),
// same as it already does for the lp-user identity key (see userStore.ts).
import {
  useProgressStore,
  waitForProgressHydration,
  type ProgressEntry,
  type ModuleCompletion,
} from '../stores/progressStore';
import {
  isAuthenticated,
  onAuthStateChange,
  syncProgress,
  syncActivityEvents,
  fetchProgress,
  type ActivityEventInput,
  type ProgressContentItem,
  type RemoteProgressRow,
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

  const remote = await fetchProgress().catch(() => null);
  if (remote === null) return;

  downloaded = true;
  if (!remote.length) return;

  const { completedModules } = useProgressStore.getState();
  const merged = mergeRemoteProgress(completedModules, remote);
  useProgressStore.setState({ completedModules: merged });
}

let initialized = false;

export function initSyncEngine(): void {
  if (initialized) return;
  initialized = true;

  useProgressStore.subscribe(() => scheduleSync());
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
