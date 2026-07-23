// supabaseClient.ts — Typed Supabase wrapper for FluentFlow.
// Mirrors LearnBackend/client/lp-supabase.js (canonical vanilla wrapper used by
// DeskFlow/HubFlow/LyricFlow) so the sync semantics stay consistent across apps.
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export async function isAuthenticated(): Promise<boolean> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return !!session?.user;
}

export function onAuthStateChange(callback: Parameters<typeof supabase.auth.onAuthStateChange>[0]) {
  return supabase.auth.onAuthStateChange(callback);
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

export type SyncResult = { synced: true; count: number } | { synced: false; reason: string };

export async function syncProgress(
  content: Record<string, ProgressContentItem>
): Promise<SyncResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { synced: false, reason: 'not_authenticated' };

  const rows = Object.entries(content).map(([contentId, item]) => ({
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

  const { error } = await supabase
    .from('progress')
    .upsert(rows, { onConflict: 'user_id,app,content_id' });

  return error ? { synced: false, reason: error.message } : { synced: true, count: rows.length };
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

export async function fetchProgress(): Promise<RemoteProgressRow[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('progress')
    .select(
      'content_id, content_type, progress_pct, completed, completed_at, best_score_pct, attempts'
    )
    .eq('user_id', user.id)
    .eq('app', 'fluentflow');

  return error || !data ? [] : data;
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
