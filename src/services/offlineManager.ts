/**
 * Offline Manager Service
 *
 * Pure service (no React) that encapsulates all Cache API logic
 * for downloading, storing, and managing offline content.
 * Functions exported individually for tree-shaking.
 */

import { getLearningModulesPath, getAssetPath } from '../utils/pathUtils';
import { logDebug, logError } from '../utils/logger';
import type { LearningModule } from '../types';

// Must match the CACHE_NAME in public/sw.js
export const CACHE_NAME = 'fluentflow-v1';
export const ASSETS_CACHE = 'fluentflow-v1'; // unified cache

export interface DownloadProgress {
  total: number;
  completed: number;
  failed: string[]; // URLs that failed after all retries
}

export interface LevelStorageInfo {
  level: string;
  moduleCount: number;
  sizeBytes: number;
}

/**
 * Fetch with retries: 1 original attempt + 2 retries with backoff (1s, 2s)
 */
async function fetchWithRetries(url: string, maxRetries = 2): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logDebug(
        `Fetch attempt ${attempt + 1} failed for ${url}`,
        { error: lastError.message },
        'OfflineManager'
      );

      // Wait with backoff before retrying (1s, 2s)
      if (attempt < maxRetries) {
        const delay = (attempt + 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${url}`);
}

/**
 * Get modules from learningModules.json, either from network or cache
 */
async function fetchModulesList(): Promise<LearningModule[]> {
  const modulesUrl = getLearningModulesPath();

  try {
    const response = await fetch(modulesUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch {
    // Fallback to cached version if available
    const cachedResponse = await getCachedResponse(modulesUrl);
    if (cachedResponse) {
      return await cachedResponse.json();
    }
    throw new Error('Cannot fetch learningModules.json and no cached version available');
  }
}

/**
 * Resolve a module's dataPath to a full URL suitable for caching
 */
function resolveDataPath(dataPath: string): string {
  const cleanDataPath = dataPath.startsWith('data/')
    ? dataPath.substring(5) // Remove 'data/' prefix
    : dataPath;
  return getAssetPath(cleanDataPath);
}

/**
 * Get all URLs that should be cached for a given set of levels and categories
 */
async function getUrlsForLevels(
  levels: string[],
  categories: string[],
  allModules: LearningModule[]
): Promise<Map<string, string[]>> {
  const urlsByLevel = new Map<string, string[]>();

  for (const targetLevel of levels) {
    const modulesForLevel = allModules.filter(m => {
      const moduleLevels = Array.isArray(m.level) ? m.level : [m.level];
      const hasLevel = moduleLevels.includes(targetLevel as any);

      // If no categories selected, include all modules for this level
      if (categories.length === 0) {
        return hasLevel;
      }

      // If categories selected, also filter by category
      return hasLevel && m.category && categories.includes(m.category);
    });

    const urls = modulesForLevel.filter(m => m.dataPath).map(m => resolveDataPath(m.dataPath!));

    urlsByLevel.set(targetLevel, urls);
  }

  return urlsByLevel;
}

/**
 * Download content for the specified CEFR levels and categories into the Cache API.
 *
 * - Fetches learningModules.json, filters by level and category
 * - Downloads each file sequentially with retries (1 original + 2 retries, backoff 1s/2s)
 * - Calls onProgress with monotonically increasing completed count
 *
 * NOTE: JS/CSS assets are NOT pre-cached. Browser's native HTTP cache handles them.
 * This prevents issues with stale cached assets after new deployments with different hashes.
 */
export async function downloadLevels(
  levels: string[],
  onProgress: (progress: DownloadProgress) => void,
  categories: string[] = []
): Promise<DownloadProgress> {
  const allModules = await fetchModulesList();
  const urlsByLevel = await getUrlsForLevels(levels, categories, allModules);

  // Collect all unique URLs to download
  const allUrls: string[] = [];
  for (const urls of urlsByLevel.values()) {
    for (const url of urls) {
      if (!allUrls.includes(url)) {
        allUrls.push(url);
      }
    }
  }

  // Also cache learningModules.json itself
  const modulesUrl = getLearningModulesPath();
  if (!allUrls.includes(modulesUrl)) {
    allUrls.unshift(modulesUrl);
  }

  const total = allUrls.length;
  const failed: string[] = [];
  let completed = 0;

  // Report initial progress
  onProgress({ total, completed, failed: [] });

  const cache = await caches.open(CACHE_NAME);

  // Download sequentially
  for (const url of allUrls) {
    try {
      const response = await fetchWithRetries(url);
      // Store with the same URL the SW uses (no normalization needed)
      await cache.put(url, response);
      completed++;
      logDebug('Downloaded and cached', { url }, 'OfflineManager');
    } catch (error) {
      console.error('[OfflineManager] ❌ Failed:', url, error);
      failed.push(url);
      completed++;
      logError(
        `Failed to download ${url} after all retries`,
        { error: error instanceof Error ? error.message : String(error) },
        'OfflineManager'
      );
    }

    // Monotonically increasing progress callback
    onProgress({ total, completed, failed: [...failed] });
  }

  logDebug('Download complete', { total, completed, failedCount: failed.length }, 'OfflineManager');

  return { total, completed, failed };
}

/**
 * Delete all cached files for a specific CEFR level.
 * Only removes files belonging to that level; other levels remain intact.
 */
export async function deleteLevelCache(level: string): Promise<void> {
  const allModules = await fetchModulesList();
  const urlsByLevel = await getUrlsForLevels([level], [], allModules);
  const urlsToDelete = urlsByLevel.get(level) ?? [];

  const cache = await caches.open(CACHE_NAME);

  for (const url of urlsToDelete) {
    await cache.delete(url);
  }

  logDebug(`Deleted cache for level ${level}`, { urlCount: urlsToDelete.length }, 'OfflineManager');
}

/**
 * Delete the entire offline cache (both data and assets).
 */
export async function deleteAllCache(): Promise<void> {
  await Promise.all([caches.delete(CACHE_NAME), caches.delete(ASSETS_CACHE)]);
  logDebug('Deleted all offline cache', undefined, 'OfflineManager');
}

/**
 * Get a cached response by URL from the offline cache.
 */
export async function getCachedResponse(url: string): Promise<Response | undefined> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(url);
    return response ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Get storage info for each downloaded level.
 * Returns an array of LevelStorageInfo with level name, module count, and size in bytes.
 */
export async function getLevelStorageInfo(): Promise<LevelStorageInfo[]> {
  let allModules: LearningModule[];
  try {
    allModules = await fetchModulesList();
  } catch {
    return [];
  }

  const levels = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'];
  const result: LevelStorageInfo[] = [];
  const cache = await caches.open(CACHE_NAME);

  for (const level of levels) {
    // Only count modules where this is the PRIMARY level (first in array)
    // This prevents showing levels incorrectly due to cache corruption or multi-level modules
    const modulesForLevel = allModules.filter(m => {
      const moduleLevels = Array.isArray(m.level) ? m.level : [m.level];
      return moduleLevels[0] === level;
    });

    const urlsForLevel = modulesForLevel
      .filter(m => m.dataPath)
      .map(m => resolveDataPath(m.dataPath!));

    let moduleCount = 0;
    let sizeBytes = 0;

    for (const url of urlsForLevel) {
      const response = await cache.match(url);
      if (response) {
        moduleCount++;
        const blob = await response.clone().blob();
        sizeBytes += blob.size;
      }
    }

    if (moduleCount > 0) {
      result.push({ level, moduleCount, sizeBytes });
    }
  }

  return result;
}

/**
 * Get the total size of all cached offline content in bytes.
 */
export async function getTotalCacheSize(): Promise<number> {
  const levelInfo = await getLevelStorageInfo();
  return levelInfo.reduce((sum, info) => sum + info.sizeBytes, 0);
}

/**
 * Verify that cached content is still available for the given downloaded levels.
 * Returns which levels are valid, missing, or partially cached.
 */
export async function verifyCacheIntegrity(
  downloadedLevels: string[]
): Promise<{ valid: boolean; missingLevels: string[]; partialLevels: string[] }> {
  let allModules: LearningModule[];
  try {
    allModules = await fetchModulesList();
  } catch {
    // If we can't even get the modules list, all levels are missing
    return { valid: false, missingLevels: [...downloadedLevels], partialLevels: [] };
  }

  const cache = await caches.open(CACHE_NAME);
  const missingLevels: string[] = [];
  const partialLevels: string[] = [];

  for (const level of downloadedLevels) {
    const modulesForLevel = allModules.filter(m => {
      const moduleLevels = Array.isArray(m.level) ? m.level : [m.level];
      return moduleLevels.includes(level as any);
    });

    const urlsForLevel = modulesForLevel
      .filter(m => m.dataPath)
      .map(m => resolveDataPath(m.dataPath!));

    if (urlsForLevel.length === 0) {
      continue;
    }

    // Count how many files are actually cached
    let cachedCount = 0;
    for (const url of urlsForLevel) {
      const response = await cache.match(url);
      if (response) {
        cachedCount++;
      }
    }

    const completeness = cachedCount / urlsForLevel.length;

    if (completeness === 0) {
      // No files cached at all
      missingLevels.push(level);
    } else if (completeness < 0.9) {
      // Less than 90% cached - considered partial
      partialLevels.push(level);
      logDebug(
        `Level ${level} partially cached`,
        {
          cached: cachedCount,
          total: urlsForLevel.length,
          completeness: `${(completeness * 100).toFixed(1)}%`,
        },
        'OfflineManager'
      );
    }
    // else: completeness >= 0.9 - level is OK
  }

  return {
    valid: missingLevels.length === 0 && partialLevels.length === 0,
    missingLevels,
    partialLevels,
  };
}

/**
 * Format a byte count into a human-readable string.
 * Returns "X.Y KB" if < 1 MB, or "X.Y MB" if >= 1 MB, with 1 decimal place.
 */
export function formatStorageSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
