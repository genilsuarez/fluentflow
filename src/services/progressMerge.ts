import type { ModuleCompletion, ProgressEntry } from '../stores/progressStore';
import type { ModuleScore } from '../types';
import type { RemoteActivityRow, RemoteProgressRow } from './supabaseClient';

/** Normalize Postgres/PostgREST timestamptz to ISO UTC (DeskFlow progress-reader expects .toISOString()). */
export function normalizeIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** Merge remote progress rows into completedModules without regressing local state. */
export function mergeRemoteProgress(
  local: Record<string, ModuleCompletion>,
  remote: RemoteProgressRow[]
): Record<string, ModuleCompletion> {
  const merged = { ...local };
  for (const row of remote) {
    if (!row.completed) continue;
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

/** Merge remote activity rows into the progress history ledger (dedupe by runId). */
export function mergeRemoteActivityHistory(
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

export function entryScorePct(entry: ProgressEntry): number {
  if (entry.totalQuestions > 0) {
    return Math.round((entry.correctAnswers / entry.totalQuestions) * 100);
  }
  return Math.max(0, Math.min(100, entry.score));
}

export function rebuildUserScoresFromHistory(
  history: ProgressEntry[]
): Record<string, ModuleScore> {
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

export function mergeUserScores(
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
