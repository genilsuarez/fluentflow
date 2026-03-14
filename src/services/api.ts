import { secureJsonFetch, validateUrl } from '../utils/secureHttp';
import { getLearningModulesPath, getAssetPath } from '../utils/pathUtils';
import { logError, logDebug } from '../utils/logger';
import type { LearningModule } from '../types';

/**
 * Normalize a URL the same way the Service Worker does:
 * remove query params, hash, and trailing slash.
 */
function normalizeUrlForCache(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.hash = '';
    parsed.pathname = parsed.pathname.replace(/\/$/, '');
    return parsed.href;
  } catch {
    return url;
  }
}

/**
 * API Service Layer - Abstracts all API calls and data fetching logic
 *
 * CACHE ARCHITECTURE (3 niveles):
 *
 * 1. MEMORY CACHE (ApiService.cache)
 *    - TTL: 5 minutos
 *    - Propósito: Respuestas instantáneas durante la sesión activa
 *    - Scope: Solo en memoria, se pierde al recargar
 *
 * 2. REACT QUERY CACHE (TanStack Query)
 *    - staleTime: 10-15 minutos
 *    - Propósito: Gestión de estado de queries, deduplicación, refetch automático
 *    - Scope: Sesión activa, con opciones de persistencia
 *
 * 3. PERSISTENT CACHE (Service Worker + Cache API)
 *    - TTL: Indefinido (hasta que usuario borre o se actualice versión)
 *    - Propósito: Modo offline, disponibilidad sin red
 *    - Scope: Persistente entre sesiones, sobrevive recargas
 *    - Estrategia: Network-first con fallback a cache
 *
 * FLUJO DE DATOS (ONLINE-FIRST):
 * Online: Memory → Network → Memory Cache (actualiza) → Service Worker cachea automáticamente
 * Offline: Memory → Cache API → Memory Cache (actualiza)
 */

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

class ApiService {
  private cache = new Map<string, { data: unknown; timestamp: number }>();
  // Memory cache TTL aligned with TanStack Query staleTime (10 min) so they
  // expire together and avoid unnecessary network re-fetches between layers.
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  /**
   * Generic cache management
   */
  private getCacheKey(endpoint: string, params?: Record<string, unknown>): string {
    return `${endpoint}${params ? JSON.stringify(params) : ''}`;
  }

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data as T;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: unknown): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Fetch all available learning modules
   * Strategy: Memory → Network → Cache API (online-first for fresh data)
   */
  async fetchModules(): Promise<ApiResponse<LearningModule[]>> {
    const cacheKey = this.getCacheKey('modules');

    // 1. Try Memory Cache first (fastest)
    const cached = this.getFromCache<LearningModule[]>(cacheKey);
    if (cached) {
      logDebug('Returning memory cached modules', { count: cached.length }, 'ApiService');
      return { data: cached, success: true };
    }

    const modulesUrl = getLearningModulesPath();

    // 2. Try Network first (online-first strategy)
    try {
      const validatedUrl = validateUrl(modulesUrl);
      const modules = await secureJsonFetch<LearningModule[]>(validatedUrl);

      // Enhance modules with default values
      const enhancedModules = modules.map((module: LearningModule) => ({
        ...module,
        estimatedTime: module.estimatedTime ?? 5,
        difficulty: module.difficulty ?? 3,
        tags: module.tags ?? [module.category],
      }));

      this.setCache(cacheKey, enhancedModules);
      logDebug('Fetched modules from network', { count: enhancedModules.length }, 'ApiService');

      return { data: enhancedModules, success: true };
    } catch (networkError) {
      logDebug('Network fetch failed, trying Cache API', { error: networkError }, 'ApiService');

      // 3. Fallback to Cache API if network fails (offline support)
      try {
        const cache = await caches.open('fluentflow-offline-v5');
        // Normalize URL to match how SW stores it (no query params, no trailing slash)
        const normalizedUrl = normalizeUrlForCache(modulesUrl);
        const cacheResponse = (await cache.match(normalizedUrl)) ?? (await cache.match(modulesUrl));

        if (cacheResponse) {
          const modules = await cacheResponse.json();

          // Enhance modules with default values
          const enhancedModules = modules.map((module: LearningModule) => ({
            ...module,
            estimatedTime: module.estimatedTime ?? 5,
            difficulty: module.difficulty ?? 3,
            tags: module.tags ?? [module.category],
          }));

          this.setCache(cacheKey, enhancedModules);
          logDebug(
            'Returning Cache API modules (offline)',
            { count: enhancedModules.length },
            'ApiService'
          );
          return { data: enhancedModules, success: true };
        }
      } catch (cacheError) {
        logDebug('Cache API lookup failed', { error: cacheError }, 'ApiService');
      }

      // 4. Both network and cache failed
      const errorMessage = networkError instanceof Error ? networkError.message : 'Unknown error';
      logError('Failed to fetch modules from all sources', { error: errorMessage }, 'ApiService');
      return { data: [], success: false, error: errorMessage };
    }
  }

  /**
   * Fetch specific module with its data
   * Strategy: network-first with Cache API fallback for offline support
   */
  /**
   * Fetch specific module with its data
   * Strategy: Metadata from learningModules.json (already loaded), data lazy-loaded on demand
   */
  async fetchModuleData(moduleId: string): Promise<ApiResponse<LearningModule>> {
    const cacheKey = this.getCacheKey('module', { moduleId });
    const cached = this.getFromCache<LearningModule>(cacheKey);

    if (cached) {
      logDebug('Returning cached module data', { moduleId }, 'ApiService');
      return { data: cached, success: true };
    }

    try {
      // Get module metadata from learningModules.json (already cached)
      const modulesResponse = await this.fetchModules();
      if (!modulesResponse.success) {
        throw new Error('Failed to fetch modules list');
      }

      const moduleInfo = modulesResponse.data.find(m => m.id === moduleId);
      if (!moduleInfo) {
        throw new Error(`Module ${moduleId} not found`);
      }

      // Module metadata is already complete in learningModules.json
      // Only fetch actual data if dataPath exists
      let moduleData: LearningModule = { ...moduleInfo };

      if (moduleInfo.dataPath) {
        // Handle dataPath that may already include 'data/' prefix
        const cleanDataPath = moduleInfo.dataPath.startsWith('data/')
          ? moduleInfo.dataPath.substring(5) // Remove 'data/' prefix
          : moduleInfo.dataPath;
        const dataUrl = validateUrl(getAssetPath(cleanDataPath));

        // Lazy load actual module data (questions, flashcards, etc.)
        let data: any;
        try {
          data = await secureJsonFetch(dataUrl);
        } catch (networkErr) {
          // Fallback to Cache API (offline support)
          logDebug('Network failed for module data, trying Cache API', { moduleId }, 'ApiService');
          const cache = await caches.open('fluentflow-offline-v5');
          const normalizedUrl = normalizeUrlForCache(dataUrl);
          const cached = (await cache.match(normalizedUrl)) ?? (await cache.match(dataUrl));
          if (cached) {
            data = await cached.json();
            logDebug('Serving module data from Cache API', { moduleId }, 'ApiService');
          } else {
            throw networkErr; // re-throw if nothing in cache
          }
        }

        // Handle different data formats:
        // - Arrays (flashcard, quiz, etc.): use as-is
        // - Objects with .data property (reading mode): extract it
        // - Plain objects: wrap in array for consistent access
        // NOTE: use explicit null/undefined check — data.data could be 0, false, or ""
        let processedData = data.data !== null && data.data !== undefined ? data.data : data;
        if (
          !Array.isArray(processedData) &&
          typeof processedData === 'object' &&
          processedData !== null
        ) {
          processedData = [processedData];
        }

        moduleData = {
          ...moduleInfo, // Metadata from learningModules.json (estimatedTime, difficulty, tags)
          data: processedData, // Actual content from individual file
        };
      }

      this.setCache(cacheKey, moduleData);
      logDebug('Fetched module data successfully', { moduleId }, 'ApiService');

      return { data: moduleData, success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logError('Failed to fetch module data', { moduleId, error: errorMessage }, 'ApiService');
      return { data: {} as LearningModule, success: false, error: errorMessage };
    }
  }

  /**
   * Filter module data based on user settings
   */
  filterModuleData<T extends { category?: string; level?: string; word?: string; id?: string }>(
    data: T[],
    filters: ModuleFilters,
    moduleId: string
  ): T[] {
    if (!Array.isArray(data)) {
      logDebug('No data to filter', { moduleId }, 'ApiService');
      return [];
    }

    let filteredData = [...data];

    // Special handling for sorting modules - they need all data for category selection
    if (moduleId.includes('sorting')) {
      logDebug('Applying minimal filtering for sorting module', { moduleId }, 'ApiService');

      // For sorting modules, don't filter by level or categories
      // because the sorting component needs access to all categories and their items
      // The module itself is already level-appropriate based on its placement in the curriculum

      // Apply limit with balanced category selection if specified
      if (filters.limit && filters.limit > 0 && filteredData.length > filters.limit) {
        // Group by category first to ensure balanced selection
        const itemsByCategory: Record<string, any[]> = {};
        filteredData.forEach(item => {
          const category = item.category || 'default';
          if (!itemsByCategory[category]) {
            itemsByCategory[category] = [];
          }
          itemsByCategory[category].push(item);
        });

        const categories = Object.keys(itemsByCategory);
        const itemsPerCategory = Math.ceil(filters.limit / categories.length);

        let balancedData: any[] = [];
        categories.forEach(category => {
          const categoryItems = itemsByCategory[category].slice(0, itemsPerCategory);
          balancedData.push(...categoryItems);
        });

        // If we still need more items, add remaining ones
        if (balancedData.length < filters.limit) {
          const usedItems = new Set(
            balancedData.map(item => item.word || item.id || JSON.stringify(item))
          );
          const remainingItems = filteredData.filter(
            item => !usedItems.has(item.word || item.id || JSON.stringify(item))
          );
          const additionalItems = remainingItems.slice(0, filters.limit - balancedData.length);
          balancedData.push(...additionalItems);
        }

        filteredData = balancedData.slice(0, filters.limit);
      }

      return filteredData;
    }

    // Normal filtering for other modes
    // Filter by categories
    if (filters.categories && filters.categories.length > 0) {
      filteredData = filteredData.filter(item => {
        const itemCategory = item.category || this.getCategoryFromId(moduleId);
        return filters.categories!.includes(itemCategory);
      });
    }

    // Filter by level
    if (filters.level && filters.level !== 'all') {
      filteredData = filteredData.filter(item => {
        const itemLevel = item.level || 'b1';
        return itemLevel.toLowerCase() === filters.level!.toLowerCase();
      });
    }

    // Apply limit
    if (filters.limit && filters.limit > 0) {
      filteredData = filteredData.slice(0, filters.limit);
    }

    logDebug(
      'Filtered module data',
      {
        moduleId,
        originalCount: data.length,
        filteredCount: filteredData.length,
        filters,
      },
      'ApiService'
    );

    return filteredData;
  }

  /**
   * Helper to determine category from module ID
   */
  private getCategoryFromId(moduleId: string): string {
    if (
      moduleId.includes('grammar') ||
      moduleId.includes('conditional') ||
      moduleId.includes('participle')
    ) {
      return 'Grammar';
    }
    if (moduleId.includes('phrasal')) {
      return 'PhrasalVerbs';
    }
    if (moduleId.includes('idiom')) {
      return 'Idioms';
    }
    return 'Vocabulary';
  }

  /**
   * Clear cache (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.cache.clear();
    logDebug('API cache cleared', undefined, 'ApiService');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Export singleton instance - lazy initialization to avoid module loading issues
let _apiService: ApiService | null = null;
const getApiService = () => {
  if (!_apiService) {
    _apiService = new ApiService();
  }
  return _apiService;
};

export const apiService = {
  fetchModules: () => getApiService().fetchModules(),
  fetchModuleData: (moduleId: string) => getApiService().fetchModuleData(moduleId),
  filterModuleData: <T extends { category?: string; level?: string; word?: string; id?: string }>(
    data: T[],
    filters: ModuleFilters,
    moduleId: string
  ) => getApiService().filterModuleData(data, filters, moduleId),
  clearCache: () => getApiService().clearCache(),
  getCacheStats: () => getApiService().getCacheStats(),
};

// Export convenience functions
export const fetchModules = () => apiService.fetchModules();
export const fetchModuleData = (moduleId: string) => apiService.fetchModuleData(moduleId);
export const filterModuleData = <
  T extends { category?: string; level?: string; word?: string; id?: string },
>(
  data: T[],
  filters: ModuleFilters,
  moduleId: string
) => apiService.filterModuleData(data, filters, moduleId);
