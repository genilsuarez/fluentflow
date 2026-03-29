import { getLearningModulesPath, getAssetPath } from '../utils/pathUtils';
import { ModuleNotAvailableOfflineError } from '../utils/secureHttp';
import { shuffleArray } from '../utils/randomUtils';
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

function enhanceModules(modules: LearningModule[]): LearningModule[] {
  return modules.map(module => ({
    ...module,
    estimatedTime: module.estimatedTime ?? 5,
    difficulty: module.difficulty ?? 3,
    tags: module.tags ?? [module.category],
  }));
}

/**
 * Fetch all available learning modules.
 */
export async function fetchModules(): Promise<ApiResponse<LearningModule[]>> {
  try {
    const modules = await fetchJson<LearningModule[]>(getLearningModulesPath());
    return { data: enhanceModules(modules), success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { data: [], success: false, error: msg };
  }
}

/**
 * Fetch a specific module's data by ID.
 */
export async function fetchModuleData(moduleId: string): Promise<ApiResponse<LearningModule>> {
  try {
    const modulesRes = await fetchModules();
    if (!modulesRes.success) throw new Error('Failed to fetch modules list');

    const moduleInfo = modulesRes.data.find((m: LearningModule) => m.id === moduleId);
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
