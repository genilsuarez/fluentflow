const STATS_DEFERRAL_TIMEOUT_MS = 8000;
const STATS_READY_EVENT = 'lp-stats-ready';

function hasStoredSupabaseSession(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !/^sb-.+-auth-token$/.test(key)) continue;
      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      if (parsed?.access_token || parsed?.currentSession?.access_token) return true;
    }
  } catch {
    /* noop */
  }
  return false;
}

function setStatsSyncingAttribute(syncing: boolean): void {
  if (typeof document === 'undefined') return;
  if (syncing) document.documentElement.dataset.statsSyncing = 'true';
  else document.documentElement.removeAttribute('data-stats-syncing');
}

let statsDisplayReady = !hasStoredSupabaseSession();
let statsDeferralTimer: number | null = null;
let statsRevealPending = false;

function scheduleStatsDeferralTimeout(): void {
  if (statsDeferralTimer || typeof window === 'undefined') return;
  statsDeferralTimer = window.setTimeout(() => {
    statsDeferralTimer = null;
    markStatsDisplayReady();
  }, STATS_DEFERRAL_TIMEOUT_MS);
}

export function beginStatsDeferral(): void {
  if (!hasStoredSupabaseSession()) return;
  statsDisplayReady = false;
  setStatsSyncingAttribute(true);
  scheduleStatsDeferralTimeout();
}

export function shouldDeferStatsDisplay(): boolean {
  return !statsDisplayReady;
}

function readActivityDoc(): { events?: unknown[] } | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const parsed = JSON.parse(localStorage.getItem('learnflow:activity:fluentflow:v1') || 'null');
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function readProgressHistoryLength(): number {
  if (typeof localStorage === 'undefined') return 0;
  try {
    const parsed = JSON.parse(localStorage.getItem('progress-storage') || 'null');
    const history = parsed?.state?.progressHistory;
    return Array.isArray(history) ? history.length : 0;
  } catch {
    return 0;
  }
}

/** True when recent-activity data already lives in localStorage. */
export function hasLocalActivityLedger(): boolean {
  const events = readActivityDoc()?.events;
  if (Array.isArray(events) && events.length > 0) return true;
  return readProgressHistoryLength() > 0;
}

/** Defer recent-activity UI only until the first cloud fetch (if no local cache). */
export function shouldDeferActivityDisplay(): boolean {
  return shouldDeferStatsDisplay() && !hasLocalActivityLedger();
}

export function consumeStatsRevealAnimation(): boolean {
  const animate = statsRevealPending;
  statsRevealPending = false;
  return animate;
}

export function markStatsDisplayReady(): void {
  if (statsDisplayReady) return;
  const wasDeferring = !statsDisplayReady;
  statsDisplayReady = true;
  if (wasDeferring && hasStoredSupabaseSession()) {
    statsRevealPending = true;
  }
  if (statsDeferralTimer) {
    clearTimeout(statsDeferralTimer);
    statsDeferralTimer = null;
  }
  setStatsSyncingAttribute(false);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(STATS_READY_EVENT, { detail: { animate: statsRevealPending } })
    );
  }
}

if (shouldDeferStatsDisplay()) {
  setStatsSyncingAttribute(true);
  scheduleStatsDeferralTimeout();
}
