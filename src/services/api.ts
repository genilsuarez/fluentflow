import { secureJsonFetch, validateUrl } from '../utils/secureHttp';
import { getLearningModulesPath, getAssetPath } from '../utils/pathUtils';
import { logError, logDebug } from '../utils/logger';
import type { LearningModule } from '../types';

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
 * FLUJO DE DATOS:
 * Online: Memory → Network → SW Cache (actualiza) → Memory Cache (actualiza)
 * Offline: Memory → SW Cache → Memory Cache (actualiza)
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
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
   * Strategy: Memory → Cache API → Network (offline-first for reliability)
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

    // 2. Try Cache API directly (offline support without network)
    try {
      const cache = await caches.open('fluentflow-offline-v5');
      const cacheResponse = await cache.match(modulesUrl);

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
        logDebug('Returning Cache API modules', { count: enhancedModules.length }, 'ApiService');
        return { data: enhancedModules, success: true };
      }
    } catch (error) {
      logDebug('Cache API lookup failed, trying network', { error }, 'ApiService');
    }

    // 3. Try network as last resort
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
        const data = await secureJsonFetch(dataUrl);

        // Handle different data formats:
        // - Arrays (flashcard, quiz, etc.): use as-is
        // - Objects (reading mode): wrap in array for consistent access
        let processedData = data.data || data;
        if (!Array.isArray(processedData) && typeof processedData === 'object') {
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
