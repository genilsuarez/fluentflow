// progressInvalidations.ts — Purga local de progreso invalidado server-side
// (LearnBackend migración 024, progress_invalidations).
//
// Cuando un admin corrige progreso erróneo, borra las filas de `progress` y
// registra una invalidación en el ledger. Un trigger en Supabase evita que
// esa fila se re-suba (bloquea la resurrección server-side), pero el
// localStorage de este dispositivo puede seguir mostrando el checkmark
// viejo hasta que se entera de la invalidación y se purga solo. Eso es lo
// que hace este módulo: se llama al principio de cada ciclo de descarga
// (downloadOnLogin en syncEngine.ts), ANTES de mezclar/subir nada, así nunca
// hay ventana para que el dato viejo vuelva a subirse.
//
// Cursor por dispositivo en localStorage (`lp-invalidations-seen:fluentflow`)
// para no re-pedir invalidaciones ya procesadas en cada ciclo.
import {
  useProgressStore,
  type ModuleCompletion,
  type ProgressEntry,
} from '../stores/progressStore';
import { fetchInvalidations } from './supabaseClient';

const CURSOR_KEY = 'lp-invalidations-seen:fluentflow';
const PROGRESS_KEY = 'learnflow:progress:fluentflow:v1';
const ACTIVITY_KEY = 'learnflow:activity:fluentflow:v1';

function readCursor(): string {
  try {
    return localStorage.getItem(CURSOR_KEY) || '1970-01-01T00:00:00.000Z';
  } catch {
    return '1970-01-01T00:00:00.000Z';
  }
}

function writeCursor(value: string): void {
  try {
    localStorage.setItem(CURSOR_KEY, value);
  } catch {
    /* noop */
  }
}

function purgeDerivedDocs(ids: Set<string> | null): void {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { content?: Record<string, unknown> };
      if (parsed?.content) {
        if (ids === null) {
          parsed.content = {};
        } else {
          for (const id of ids) delete parsed.content[id];
        }
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(parsed));
      }
    }
  } catch {
    /* noop */
  }

  try {
    const raw = localStorage.getItem(ACTIVITY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { events?: Array<{ contentId?: string }> };
      if (Array.isArray(parsed?.events)) {
        parsed.events =
          ids === null ? [] : parsed.events.filter(event => !ids.has(event?.contentId || ''));
        localStorage.setItem(ACTIVITY_KEY, JSON.stringify(parsed));
      }
    }
  } catch {
    /* noop */
  }
}

/**
 * Consulta el ledger de invalidaciones y, si hay novedades, purga los
 * content_ids afectados (o todo, si alguna invalidación es "toda la app")
 * de `progress-storage` (Zustand) y de los documentos derivados. Devuelve
 * true si purgó algo.
 */
export async function purgeInvalidatedProgress(): Promise<boolean> {
  const since = readCursor();
  const invalidations = await fetchInvalidations(since).catch(() => null);
  if (!invalidations || !invalidations.length) return false;

  const wholeApp = invalidations.some(inv => !inv.content_id);
  const ids = wholeApp
    ? null
    : new Set(invalidations.map(inv => inv.content_id).filter((id): id is string => !!id));

  const { completedModules, progressHistory } = useProgressStore.getState();

  let changed = false;
  let nextCompleted: Record<string, ModuleCompletion> = completedModules;
  let nextHistory: ProgressEntry[] = progressHistory;

  if (wholeApp) {
    if (Object.keys(completedModules).length) {
      nextCompleted = {};
      changed = true;
    }
    if (progressHistory.length) {
      nextHistory = [];
      changed = true;
    }
  } else if (ids && ids.size) {
    const filteredEntries = Object.entries(completedModules).filter(([id]) => !ids.has(id));
    if (filteredEntries.length !== Object.keys(completedModules).length) {
      nextCompleted = Object.fromEntries(filteredEntries);
      changed = true;
    }
    const filteredHistory = progressHistory.filter(entry => !ids.has(entry.moduleId || ''));
    if (filteredHistory.length !== progressHistory.length) {
      nextHistory = filteredHistory;
      changed = true;
    }
  }

  if (changed) {
    useProgressStore.setState({ completedModules: nextCompleted, progressHistory: nextHistory });
    purgeDerivedDocs(ids);
  }

  const latest = invalidations.reduce(
    (max, inv) => (inv.invalidated_at > max ? inv.invalidated_at : max),
    since
  );
  writeCursor(latest);

  return changed;
}
