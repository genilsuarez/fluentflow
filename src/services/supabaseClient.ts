// supabaseClient.ts — Typed Supabase wrapper for FluentFlow.
// Mirrors LearnBackend/client/lp-supabase.js (canonical vanilla wrapper used by
// DeskFlow/HubFlow/LyricFlow) so the sync semantics stay consistent across apps.
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** True when the URL still carries OAuth callback params (hash or query). */
export function isOAuthReturnUrl(urlLike?: string): boolean {
  const href = urlLike ?? (typeof window !== 'undefined' ? window.location.href : '');
  return /(^|[#?&])(access_token|refresh_token|code|error_description)=/.test(href);
}

/** Strip OAuth tokens from the address bar after Supabase consumes them. */
export function cleanAuthParamsFromUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const url = new URL(window.location.href);
  const hadHashAuth = /(^|&)(access_token|refresh_token|type)=/.test(url.hash.replace(/^#/, ''));
  const hadQueryAuth =
    url.searchParams.has('code') ||
    url.searchParams.has('error') ||
    url.searchParams.has('error_description');
  if (!hadHashAuth && !hadQueryAuth) return false;

  if (hadHashAuth) url.hash = '';
  url.searchParams.delete('code');
  url.searchParams.delete('error');
  url.searchParams.delete('error_description');
  const next = url.pathname + url.search + url.hash;
  window.history.replaceState(window.history.state, '', next);
  return true;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // PKCE (A.3.1, docs/auditoria-y-plan.md) — previamente 'implicit', porque
    // signInWithOAuth() normal hace un await (hashear el code challenge con
    // SHA-256) entre el tap y window.location.assign(), y ese salto async
    // hace que WebKit (Safari/Chrome iOS) descarte el redirect en silencio.
    // beginGoogleOAuthRedirect() de abajo arma el challenge PKCE a mano con
    // método 'plain' (challenge === verifier, sin hash) para que todo el
    // camino siga siendo síncrono dentro del gesto del usuario, sin volver a
    // 'implicit'. Pendiente de confirmar en dispositivo iOS real.
    flowType: 'pkce',
  },
});

export async function isAuthenticated(): Promise<boolean> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return !!session?.user;
}

export function getSession() {
  return supabase.auth.getSession();
}

/**
 * Genera un code_verifier de PKCE (RFC 7636: 43-128 chars, alfabeto
 * URL-safe) de forma SÍNCRONA — crypto.getRandomValues no hace await, a
 * diferencia de crypto.subtle.digest (que sí, y es lo que rompe el redirect
 * en WebKit si se usa el challenge S256 por defecto del SDK).
 */
function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Réplica la key de storage que @supabase/auth-js usa para el code_verifier
 * (`${storageKey}-code-verifier`, storageKey default `sb-<project-ref>-auth-
 * token`). No es API pública documentada — verificado leyendo
 * @supabase/auth-js en node_modules (GoTrueClient.js, _exchangeCodeForSession
 * y el default de SupabaseClient), no la documentación. Puede cambiar en un
 * bump de versión sin aviso — ver A.3.1 en docs/auditoria-y-plan.md.
 */
function pkceVerifierStorageKey(): string {
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
  return `sb-${projectRef}-auth-token-code-verifier`;
}

export function buildGoogleOAuthUrl(redirectTo?: string, codeChallenge?: string) {
  const target =
    redirectTo || window.location.origin + window.location.pathname + window.location.search;
  const params = new URLSearchParams({ provider: 'google', redirect_to: target });
  if (codeChallenge) {
    // Método 'plain' (challenge === verifier, sin hash S256) — el mismo
    // fallback que usa @supabase/auth-js cuando crypto.subtle no está
    // disponible. Más débil que S256, pero sigue protegiendo contra
    // interceptación del `code` de vuelta (sin el verifier, es inútil) y
    // deja todo el camino de ida síncrono.
    params.set('code_challenge', codeChallenge);
    params.set('code_challenge_method', 'plain');
  }
  return `${supabaseUrl}/auth/v1/authorize?${params.toString()}`;
}

/** Synchronous redirect — must stay in the user-gesture call stack (iOS WebKit). */
export function beginGoogleOAuthRedirect(redirectTo?: string) {
  const codeVerifier = generateCodeVerifier();
  try {
    window.localStorage.setItem(pkceVerifierStorageKey(), codeVerifier);
  } catch {
    // localStorage no disponible (modo privado estricto, cuota) — el
    // redirect igual sigue; exchangeCodeForSession() fallará al volver con
    // AuthPKCECodeVerifierMissingError, mismo resultado que hoy en ese caso.
  }
  window.location.assign(buildGoogleOAuthUrl(redirectTo, codeVerifier));
}

export function signInWithGoogle() {
  beginGoogleOAuthRedirect();
  return Promise.resolve({ data: { provider: 'google' }, error: null });
}

export function signInWithMagicLink(email: string) {
  return supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin + window.location.pathname + window.location.search,
    },
  });
}

export function signOut() {
  return supabase.auth.signOut();
}

export function onAuthStateChange(callback: Parameters<typeof supabase.auth.onAuthStateChange>[0]) {
  return supabase.auth.onAuthStateChange(callback);
}

export interface UserProfile {
  id: string;
  name: string;
  avatar_url?: string | null;
  cefr_level?: string | null;
}

export async function fetchProfile(): Promise<UserProfile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  return data;
}

export async function updateProfile(updates: Partial<Pick<UserProfile, 'name' | 'avatar_url'>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'not_authenticated' as const };

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, ...updates }, { onConflict: 'id' });

  return { error: error?.message || null };
}

export async function updateCefrLevel(level: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'not_authenticated' as const };

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, cefr_level: level }, { onConflict: 'id' });

  return { error: error?.message || null };
}

export interface ProgressContentItem {
  contentType: string;
  progressPct: number;
  completed: boolean;
  completedAt: string | null;
  bestScorePct: number | null;
  lastScorePct: number | null;
  attempts: number;
  activities?: Record<string, unknown>;
}

export type SyncResult =
  | { synced: true; count: number; via?: string; reason?: string }
  | { synced: false; reason: string };

export async function syncProgress(
  content: Record<string, ProgressContentItem>
): Promise<SyncResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { synced: false, reason: 'not_authenticated' };

  const rows = Object.entries(content)
    .filter(([, item]) => item.completed || item.attempts > 0 || item.progressPct > 0)
    .map(([contentId, item]) => ({
      user_id: user.id,
      app: 'fluentflow',
      content_id: contentId,
      content_type: item.contentType,
      progress_pct: item.progressPct,
      completed: item.completed,
      completed_at: item.completedAt,
      best_score_pct: item.bestScorePct,
      last_score_pct: item.lastScorePct,
      attempts: item.attempts,
      activities: item.activities ?? {},
      synced_at: new Date().toISOString(),
    }));

  if (!rows.length) return { synced: true, count: 0, reason: 'nothing_to_sync' };

  const { data, error: rpcError } = await supabase.rpc('upsert_progress_merge', {
    p_rows: rows,
  });

  if (!rpcError) {
    return {
      synced: true,
      count: typeof data === 'number' ? data : rows.length,
      via: 'merge_rpc',
    };
  }

  const message = rpcError.message || '';
  const rpcMissing = /could not find the function|function .* does not exist|PGRST202|404/i.test(
    message
  );
  if (!rpcMissing) return { synced: false, reason: message };

  const { error } = await supabase
    .from('progress')
    .upsert(rows, { onConflict: 'user_id,app,content_id' });

  return error
    ? { synced: false, reason: error.message }
    : { synced: true, count: rows.length, via: 'upsert_fallback' };
}

export interface RemoteProgressRow {
  content_id: string;
  content_type: string;
  progress_pct: number;
  completed: boolean;
  completed_at: string | null;
  best_score_pct: number | null;
  attempts: number;
}

export async function fetchProgress(): Promise<RemoteProgressRow[] | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return [];

  const { data, error } = await supabase
    .from('progress')
    .select(
      'content_id, content_type, progress_pct, completed, completed_at, best_score_pct, attempts'
    )
    .eq('user_id', session.user.id)
    .eq('app', 'fluentflow');

  if (error) return null;
  return data ?? [];
}

export interface RemoteActivityRow {
  event_id: string;
  run_id: string;
  content_id: string;
  title: string | null;
  activity: string;
  event_type: string;
  occurred_at: string;
  score_pct: number | null;
  passed: boolean | null;
  duration_ms: number | null;
  metrics: Record<string, unknown> | null;
}

export async function fetchActivityEvents(): Promise<RemoteActivityRow[] | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return [];

  const { data, error } = await supabase
    .from('activity_events')
    .select(
      'event_id, run_id, content_id, title, activity, event_type, occurred_at, score_pct, passed, duration_ms, metrics'
    )
    .eq('user_id', session.user.id)
    .eq('app', 'fluentflow')
    .order('occurred_at', { ascending: false })
    .limit(200);

  if (error) return null;
  return data ?? [];
}

export interface RemoteInvalidationRow {
  content_id: string | null;
  invalidated_at: string;
}

/**
 * Invalidaciones de progreso más nuevas que `sinceIso` (migración 024 de
 * LearnBackend). El cliente las usa para purgar su propio localStorage antes
 * de sincronizar, así nunca re-sube un "completado" que un admin acaba de
 * corregir. `content_id: null` significa "toda la app".
 */
export async function fetchInvalidations(
  sinceIso: string
): Promise<RemoteInvalidationRow[] | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return [];

  const { data, error } = await supabase
    .from('progress_invalidations')
    .select('content_id, invalidated_at')
    .eq('user_id', session.user.id)
    .eq('app', 'fluentflow')
    .gt('invalidated_at', sinceIso);

  if (error) return null;
  return data ?? [];
}

export interface ActivityEventInput {
  eventId: string;
  runId: string;
  contentId: string;
  title?: string;
  activity: string;
  eventType?: string;
  occurredAt: string;
  scorePct?: number | null;
  passed?: boolean | null;
  durationMs?: number | null;
  metrics?: Record<string, unknown>;
}

export async function syncActivityEvents(events: ActivityEventInput[]): Promise<SyncResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { synced: false, reason: 'not_authenticated' };

  const rows = events.map(event => ({
    user_id: user.id,
    event_id: event.eventId,
    run_id: event.runId,
    app: 'fluentflow',
    content_id: event.contentId,
    title: event.title || event.contentId,
    activity: event.activity,
    event_type: event.eventType || 'attempt_completed',
    occurred_at: event.occurredAt,
    score_pct: event.scorePct ?? null,
    passed: event.passed ?? null,
    duration_ms: event.durationMs ?? null,
    metrics: event.metrics || {},
  }));

  const { error } = await supabase
    .from('activity_events')
    .upsert(rows, { onConflict: 'user_id,event_id', ignoreDuplicates: true });

  if (error) return { synced: false, reason: error.message };

  // Best-effort: fails silently until migration 005_streaks.sql is applied.
  await supabase.rpc('update_streak', { p_user_id: user.id });

  return { synced: true, count: rows.length };
}
