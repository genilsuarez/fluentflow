// LearnFlow Progression System — docs/to-do/learnflow-progression-system.md.
// FluentFlow is React/TS/Vite, so it can't import the vanilla lp-progress-summary.js
// through its normal bundled module graph. public/lp-progress-summary.js is the same
// canonical file used by DeskFlow/HubFlow/LyricFlow (synced via scripts/copy-shared.sh);
// it's loaded here at runtime via a browser-native dynamic import instead of being
// ported to TypeScript, so the level logic stays in one place.
import { updateCefrLevel } from './supabaseClient';

// FluentFlow deploys under a path prefix (/fluentflow/ locally and in prod),
// so the module URL must be base-aware — a hardcoded "/lp-progress-summary.js"
// resolves to the wrong app at the shared origin.
const LEVEL_MODULE_URL = `${import.meta.env.BASE_URL || '/'}lp-progress-summary.js`;

interface LevelAdvancementResult {
  advanced: boolean;
  level: string;
  previousLevel?: string;
  terminal?: boolean;
  breakdown?: { fluentflow: number; hubflow: number; lyricflow: number };
  error?: string;
}

interface LpProgressSummaryModule {
  checkLevelAdvancement: () => LevelAdvancementResult;
  LEVEL_ORDER: readonly string[];
}

let modulePromise: Promise<LpProgressSummaryModule | null> | null = null;

function loadModule(): Promise<LpProgressSummaryModule | null> {
  if (!modulePromise) {
    modulePromise = import(/* @vite-ignore */ LEVEL_MODULE_URL)
      .then(mod => mod as LpProgressSummaryModule)
      .catch(() => null);
  }
  return modulePromise;
}

/**
 * Reevalúa si lp-level debe subir. Se llama tras completar un módulo y tras
 * hidratar progreso desde la nube (el progreso de otro dispositivo puede
 * haber completado la parte que faltaba). Si avanza, persiste el nuevo
 * nivel en profiles (best-effort: si falla, se reintenta en la próxima
 * sesión autenticada).
 */
export async function checkLevelAdvancement(): Promise<void> {
  const mod = await loadModule();
  if (!mod) return;

  let result: LevelAdvancementResult;
  try {
    result = mod.checkLevelAdvancement();
  } catch {
    return;
  }
  if (!result.advanced) return;

  try {
    await updateCefrLevel(result.level);
  } catch {
    /* se reintenta en la próxima sesión autenticada */
  }
}

/**
 * Restaura lp-level desde profiles.cefr_level tras login. Nunca lo BAJA: si
 * el valor en la nube está más atrás que el local, se conserva el local
 * (ver § Reset parcial en el doc de diseño) — el nivel nunca retrocede.
 */
export async function restoreLevelFromProfile(
  cloudLevel: string | null | undefined
): Promise<void> {
  const mod = await loadModule();
  if (!mod || !cloudLevel || !mod.LEVEL_ORDER.includes(cloudLevel)) return;

  let localLevel = 'a1';
  try {
    localLevel = localStorage.getItem('lp-level') || 'a1';
  } catch {
    return;
  }
  if (mod.LEVEL_ORDER.indexOf(cloudLevel) <= mod.LEVEL_ORDER.indexOf(localLevel)) return;

  try {
    localStorage.setItem('lp-level', cloudLevel);
  } catch {
    /* localStorage no disponible */
  }
}
