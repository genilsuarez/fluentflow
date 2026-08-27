import { getLevelCatalogPath, getAssetPath } from '../utils/pathUtils';
import { ModuleNotAvailableOfflineError } from '../utils/secureHttp';
import { shuffleArray } from '../utils/randomUtils';
import { queryClient } from './queryClient';
import { LEVEL_ORDER } from './progressionService';
import type { LearningModule } from '../types';

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}

interface ModuleFilters {
  categories?: string[];
  level?: string;
  limit?: number;
}

/**
 * Fetch JSON. The Service Worker intercepts this request:
 * - Online: fetches from network and caches the response automatically.
 * - Offline: serves from cache, or returns 503 MODULE_NOT_AVAILABLE_OFFLINE.
 */
async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    if (response.status === 503) {
      try {
        const body = await response.json();
        if (body?.error === 'MODULE_NOT_AVAILABLE_OFFLINE') {
          throw new ModuleNotAvailableOfflineError();
        }
      } catch (e) {
        if (e instanceof ModuleNotAvailableOfflineError) throw e;
      }
    }
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

const LEVEL_TO_UNIT: Record<string, number> = { a1: 1, a2: 2, b1: 3, b2: 4, c1: 5, c2: 6 };

function enhanceModules(modules: LearningModule[]): LearningModule[] {
  return modules.map(module => {
    const lvl = Array.isArray(module.level) ? module.level[0] : module.level;
    return {
      ...module,
      unit: LEVEL_TO_UNIT[lvl] ?? module.unit ?? 1,
      estimatedTime: module.estimatedTime ?? 5,
      difficulty: module.difficulty ?? 3,
      tags: module.tags ?? [module.category],
    };
  });
}

/**
 * `lp-level` (localStorage) is the cross-app combined CEFR level — same
 * fallback/default as ProgressionService.getCombinedLevelIndex(), which is
 * the hard gate on what a module can ever unlock to. Nothing above this
 * index is reachable yet, so nothing above it needs to be in the FIRST
 * catalog fetch either.
 */
function getCombinedLevelIndex(): number {
  try {
    const stored = localStorage.getItem('lp-level') || 'a1';
    const idx = LEVEL_ORDER.indexOf(stored as (typeof LEVEL_ORDER)[number]);
    return idx === -1 ? 0 : idx;
  } catch {
    return 0;
  }
}

function fetchLevelCatalog(level: string): Promise<LearningModule[]> {
  return fetchJson<LearningModule[]>(getLevelCatalogPath(level));
}

// In-flight/resolved catalog shared across every fetchModules() caller in this
// session, so the progressive load below (and its background top-up) only
// ever runs once — repeat callers (fetchModuleData's fallback path, a second
// mount before React Query's own cache is warm, ...) get the same promise.
let modulesPromise: Promise<LearningModule[]> | null = null;

/**
 * Test-only escape hatch: clears the module-level catalog cache so each test
 * case gets a fresh fetchModules() call instead of the previous test's
 * cached promise.
 */
export function __resetModulesCacheForTests(): void {
  modulesPromise = null;
}

/**
 * Loads the module catalog progressively by CEFR level instead of the full
 * ~330-module file: modules above the user's current level are locked
 * (ProgressionService.hasReachedCombinedLevel) and unreachable anyway, so the
 * first paint only needs the current level and everything below it. Levels
 * beyond that load in the background and merge into the React Query cache
 * once ready, so search and locked-level previews still see everything —
 * just not before the first module the user can actually open is on screen.
 */
async function loadModulesProgressively(): Promise<LearningModule[]> {
  const combinedIndex = getCombinedLevelIndex();
  const neededLevels = LEVEL_ORDER.slice(0, combinedIndex + 1);
  const remainingLevels = LEVEL_ORDER.slice(combinedIndex + 1);

  const neededResults = await Promise.all(neededLevels.map(fetchLevelCatalog));
  const partial = enhanceModules(neededResults.flat());

  if (remainingLevels.length > 0) {
    Promise.all(remainingLevels.map(fetchLevelCatalog))
      .then(remainingResults => {
        const full = enhanceModules([...neededResults.flat(), ...remainingResults.flat()]);
        modulesPromise = Promise.resolve(full);
        queryClient.setQueryData(['modules'], full);
      })
      .catch(() => {
        // Non-critical: modules beyond the user's current level just stay
        // unavailable to search/preview until the next fetchModules() call.
      });
  }

  return partial;
}

/**
 * Fetch all available learning modules.
 */
export async function fetchModules(): Promise<ApiResponse<LearningModule[]>> {
  try {
    if (!modulesPromise) {
      modulesPromise = loadModulesProgressively();
    }
    const modules = await modulesPromise;
    return { data: modules, success: true };
  } catch (error) {
    modulesPromise = null; // allow the next call to retry
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { data: [], success: false, error: msg };
  }
}

/**
 * Fetch a specific module's data by ID.
 * Accepts an optional pre-fetched modules list to avoid redundant network requests
 * when the caller already has the list (e.g. from TanStack Query cache).
 */
export async function fetchModuleData(
  moduleId: string,
  cachedModules?: LearningModule[]
): Promise<ApiResponse<LearningModule>> {
  try {
    let modulesList: LearningModule[];

    if (cachedModules && cachedModules.length > 0) {
      modulesList = cachedModules;
    } else {
      const modulesRes = await fetchModules();
      if (!modulesRes.success) throw new Error('Failed to fetch modules list');
      modulesList = modulesRes.data;
    }

    const moduleInfo = modulesList.find((m: LearningModule) => m.id === moduleId);
    if (!moduleInfo) throw new Error(`Module ${moduleId} not found`);

    if (!moduleInfo.dataPath) {
      return { data: moduleInfo, success: true };
    }

    // Strip leading 'data/' since getAssetPath adds it
    const cleanPath = moduleInfo.dataPath.startsWith('data/')
      ? moduleInfo.dataPath.slice(5)
      : moduleInfo.dataPath;

    const raw = await fetchJson<unknown>(getAssetPath(cleanPath));

    // Support both { data: [...] } and plain array formats
    const items =
      raw !== null &&
      typeof raw === 'object' &&
      'data' in raw &&
      (raw as Record<string, unknown>).data !== null &&
      (raw as Record<string, unknown>).data !== undefined
        ? (raw as Record<string, unknown>).data
        : raw;

    const processedData = Array.isArray(items)
      ? items
      : typeof items === 'object' && items !== null
        ? [items]
        : [];

    return { data: { ...moduleInfo, data: processedData }, success: true };
  } catch (error) {
    // Re-throw offline errors so the UI can show the offline modal
    if (error instanceof ModuleNotAvailableOfflineError) throw error;
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { data: {} as LearningModule, success: false, error: msg };
  }
}

/**
 * Filter module data based on user settings.
 */
export function filterModuleData<
  T extends { category?: string; level?: string; word?: string; id?: string },
>(data: T[], filters: ModuleFilters, moduleId: string): T[] {
  if (!Array.isArray(data)) return [];

  let result = [...data];

  // Sorting modules: skip level/category filtering, balance by category
  if (moduleId.includes('sorting')) {
    if (filters.limit && filters.limit > 0 && result.length > filters.limit) {
      const byCategory: Record<string, T[]> = {};
      result.forEach(item => {
        const cat = (item as T & { category?: string }).category || 'default';
        (byCategory[cat] ??= []).push(item);
      });
      const cats = Object.keys(byCategory);
      const perCat = Math.ceil(filters.limit / cats.length);
      result = cats.flatMap(cat => byCategory[cat].slice(0, perCat)).slice(0, filters.limit);
    }
    return result;
  }

  if (filters.level && filters.level !== 'all') {
    result = result.filter(
      item => (item.level || 'b1').toLowerCase() === filters.level!.toLowerCase()
    );
  }

  if (filters.limit && filters.limit > 0 && result.length > filters.limit) {
    result = shuffleArray(result).slice(0, filters.limit);
  }

  return result;
}

// Compat: apiService object used in useModuleData
export const apiService = { filterModuleData };
