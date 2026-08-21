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
  fetchSyncRevision,
  getUserId,
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
const REVISION_POLL_MS = 25_000;

// ── Cursor de revisión (migración 026): por USUARIO y por MOTOR ─────────────
//
// La clave era una sola global, `lp-sync-revision`, y este motor era el peor
// afectado por eso. Las 4 apps comparten origin (localhost:3000 en dev,
// genilsuarez.github.io en prod) y por lo tanto localStorage — pero NO
// comparten motor: éste solo pullea `fluentflow`, mientras HubFlow, LyricFlow
// y DeskFlow corren scripts/sync-engine.js, que pullea las 3 apps vanilla.
// Con la clave común, abrir FluentFlow escribía la revisión N como "ya vista"
// y las otras tres concluían `up_to_date` sin haber bajado NADA suyo: el
// dispositivo quedaba mostrando su copia local vieja de HubFlow por más veces
// que se forzara el sync.
//
// Además el contador remoto es por usuario, así que otra cuenta en el mismo
// navegador podía tener una revisión más baja y silenciar el pull para
// siempre. Namespacear por (userId, scope) resuelve las dos cosas: cada motor
// lleva su propia cuenta de hasta dónde bajó él para ese usuario. Pulls de
// más (una escritura de HubFlow también despierta a éste), nunca de menos.
const SYNC_REVISION_SCOPE = 'fluentflow';
const SYNC_REVISION_KEY_PREFIX = 'lp-sync-revision';
const LEGACY_SYNC_REVISION_KEY = 'lp-sync-revision';

function syncRevisionKey(userId: string): string {
  return `${SYNC_REVISION_KEY_PREFIX}:${userId}:${SYNC_REVISION_SCOPE}`;
}

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
let revisionPollTimer: ReturnType<typeof setInterval> | null = null;

async function performSync() {
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
}

function scheduleSync() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void performSync();
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
  // El cursor de revisión también: si sobrevive a un logout, la próxima cuenta
  // (o el próximo invitado que vuelve a loguearse) arranca comparando contra
  // un número que no le corresponde. Con el cursor namespaced por userId esto
  // ya casi no puede morder, pero borrarlo deja el arranque en frío en su
  // estado honesto: -1, "nunca chequeé nada".
  try {
    localStorage.removeItem(LEGACY_SYNC_REVISION_KEY);
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(`${SYNC_REVISION_KEY_PREFIX}:`)) localStorage.removeItem(key);
    }
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
// `complete` significa "bajé TODO lo que había que bajar, sin errores" — es
// lo único con lo que checkAndRefresh puede avanzar el cursor de revisión sin
// arriesgarse a saltear un cambio del peer. No confundir con `cloudHydrated`,
// que solo dice "ya puedo pintar algo" y queda en true incluso con un pull a
// medias. Toda salida temprana de acá es, por definición, incompleta.
type DownloadResult = { downloaded: boolean; complete: boolean };
const INCOMPLETE: DownloadResult = { downloaded: false, complete: false };

async function downloadOnLogin({ force = false } = {}): Promise<DownloadResult> {
  if (downloaded && !force) return INCOMPLETE;
  if (shouldAbortCloudHydration()) return INCOMPLETE;
  const authed = await isAuthenticated().catch(() => false);
  if (!authed || shouldAbortCloudHydration()) return INCOMPLETE;

  // Must wait for progress-storage rehydration — otherwise a late rehydrate
  // overwrites the merged remote progress with stale/empty local state.
  await waitForProgressHydration();
  if (downloaded && !force) {
    markStatsDisplayReady();
    return INCOMPLETE;
  }
  if (shouldAbortCloudHydration() || !(await isAuthenticated().catch(() => false)))
    return INCOMPLETE;

  // DeskFlow may have already downloaded cloud data into the v1 projection keys.
  // Import those into Zustand before merging remote rows.
  await bootstrapFromLocalProjection();
  if (shouldAbortCloudHydration() || !(await isAuthenticated().catch(() => false)))
    return INCOMPLETE;

  // Purge anything an admin invalidated server-side BEFORE merging/uploading
  // anything else this cycle — otherwise a stale local "completed" entry
  // gets merged back in below and re-uploaded by the scheduleSync() this
  // function triggers, undoing the correction. See progressInvalidations.ts.
  await purgeInvalidatedProgress().catch(() => false);
  if (shouldAbortCloudHydration() || !(await isAuthenticated().catch(() => false)))
    return INCOMPLETE;

  // Antes el gate era `wasActivityFetched() || hasLocalActivityLedger()`:
  // como hasLocalActivityLedger() es casi siempre true para un usuario
  // activo, el fetch remoto se saltaba para siempre, no solo dentro de la
  // misma sesión — actividad hecha en otro dispositivo nunca llegaba acá.
  // Solo wasActivityFetched() (sessionStorage, se resetea por pestaña/reload)
  // es el gate correcto — mismo fix que scripts/sync-engine.js.
  const [remoteProgress, remoteActivity] = await Promise.all([
    fetchProgress().catch(() => null),
    wasActivityFetched() ? Promise.resolve([]) : fetchActivityEvents().catch(() => null),
  ]);
  if (hasLocalActivityLedger() || (Array.isArray(remoteActivity) && remoteActivity.length > 0)) {
    markActivityFetched();
  }

  if (shouldAbortCloudHydration() || !(await isAuthenticated().catch(() => false))) {
    getGuestReset()?.clearGuestLocalProgress?.();
    resetDownloadState();
    markStatsDisplayReady();
    return INCOMPLETE;
  }

  const fetchFailed = remoteProgress === null && remoteActivity === null;
  // Ojo con la asimetría: `fetchFailed` exige que fallen LAS DOS consultas
  // para dar el pull por fallido (eso decide si se hidrata la UI, y ahí está
  // bien ser permisivo). Para el cursor hace falta el criterio estricto: si
  // CUALQUIERA de las dos volvió null, hay datos que no bajaron y la revisión
  // no se puede dar por vista. `remoteActivity` es [] —no null— cuando el
  // fetch se saltea por wasActivityFetched(), así que eso sigue contando como
  // completo.
  const complete = remoteProgress !== null && remoteActivity !== null;
  const hadChanges = !!(remoteProgress?.length || remoteActivity?.length);
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
  return { downloaded: hadChanges, complete };
}

async function refreshFromCloudIfNeeded({ force = false } = {}): Promise<DownloadResult> {
  if (refreshingFromCloud) return INCOMPLETE;
  if (shouldAbortCloudHydration()) return INCOMPLETE;
  if (!cloudHydrated && !force) return INCOMPLETE;
  if (!force && Date.now() - lastVisibilityRefreshAt < VISIBILITY_REFRESH_MIN_MS) {
    return INCOMPLETE;
  }

  const authed = await isAuthenticated().catch(() => false);
  if (!authed || shouldAbortCloudHydration()) return INCOMPLETE;

  refreshingFromCloud = true;
  lastVisibilityRefreshAt = Date.now();
  try {
    return (await downloadOnLogin({ force: true })) ?? INCOMPLETE;
  } finally {
    refreshingFromCloud = false;
  }
}

// -1 (no 0) como default: "nunca chequeado" tiene que ser distinguible de
// "la última revisión vista fue 0" — ver la misma nota en scripts/sync-engine.js.
// Datos de progreso escritos antes de la migración 026 nunca bumpearon
// sync_cursor, así que un usuario con progreso real puede tener revision=0
// ahí; con 0 como sentinel de "nunca chequeado" el dispositivo concluye
// falsamente "ya estoy al día" y no pullea nunca.
function readLastSeenRevision(userId: string): number {
  try {
    // La clave global vieja pudo haberla escrito el motor vanilla (que no
    // pullea fluentflow) o una cuenta distinta — su valor no dice nada sobre
    // lo que ESTE motor bajó. Se descarta, no se migra.
    localStorage.removeItem(LEGACY_SYNC_REVISION_KEY);
    const raw = localStorage.getItem(syncRevisionKey(userId));
    if (raw === null) return -1;
    const n = Number(raw);
    return Number.isFinite(n) ? n : -1;
  } catch {
    return -1;
  }
}

function writeLastSeenRevision(userId: string, revision: number): void {
  try {
    localStorage.setItem(syncRevisionKey(userId), String(revision));
  } catch {
    /* localStorage no disponible */
  }
}

/**
 * Gate barato delante de refreshFromCloudIfNeeded() (migración 026 de
 * LearnBackend, sync_cursor): compara un solo entero contra el último visto
 * antes de pullear progress/activity_events completos. Reemplaza el mismo
 * gate en la copia canónica de HubFlow/LyricFlow/DeskFlow (scripts/sync-engine.js)
 * — ver esa nota para el porqué (bug de 5-navegadores-5-porcentajes).
 *
 * force:true se salta la comparación pero de todos modos registra la
 * revisión post-pull. Si fetchSyncRevision() falla, cae al comportamiento
 * de siempre (refreshFromCloudIfNeeded con su propio throttle).
 *
 * INVARIANTE: la revisión solo se registra si el pull terminó COMPLETO. Antes
 * se escribía incondicionalmente — incluso cuando refreshFromCloudIfNeeded
 * cortaba de entrada por throttle, por `refreshingFromCloud`, o cuando el
 * fetch devolvía null. Cada uno de esos casos quemaba la revisión: el
 * dispositivo pasaba a responder `up_to_date` y esa escritura del peer no se
 * volvía a pedir nunca más.
 */
async function checkAndRefresh({ force = false } = {}): Promise<DownloadResult> {
  const userId = await getUserId().catch(() => null);

  if (force) {
    const result = await refreshFromCloudIfNeeded({ force: true });
    if (!userId || !result.complete) return result;
    const revision = await fetchSyncRevision();
    if (revision !== null) writeLastSeenRevision(userId, revision);
    return result;
  }

  // Sin userId no hay cursor con el que comparar (sesión en carrera): pullear
  // de más es siempre preferible a saltarse un cambio real.
  if (!userId) return refreshFromCloudIfNeeded({ force: true });

  const revision = await fetchSyncRevision();
  if (revision === null) return refreshFromCloudIfNeeded();
  if (revision <= readLastSeenRevision(userId)) return { downloaded: false, complete: true };

  const result = await refreshFromCloudIfNeeded({ force: true });
  if (result.complete) writeLastSeenRevision(userId, revision);
  return result;
}

// Pull-merge-push manual desde el panel "Desarrollador" en Ajustes — para
// verificar sync multi-dispositivo sin esperar al próximo visibility/focus.
export async function forceSync(): Promise<{ pull: { downloaded: boolean } }> {
  const pull = await checkAndRefresh({ force: true });
  await performSync();
  return { pull };
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
            void checkAndRefresh({ force: true });
          }
        }
      };
    } catch {
      syncChannel = null;
    }
  }

  const onVisible = () => {
    if (document.visibilityState && document.visibilityState !== 'visible') return;
    void checkAndRefresh();
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onVisible);
  window.addEventListener('online', () => {
    void checkAndRefresh({ force: true });
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

  if (!revisionPollTimer) {
    revisionPollTimer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void checkAndRefresh();
    }, REVISION_POLL_MS);
  }
}

let initialized = false;

export function initSyncEngine(): void {
  if (initialized) return;
  initialized = true;

  window.lpForceSync = forceSync;
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
