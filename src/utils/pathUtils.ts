/**
 * Utility functions for handling asset paths
 */

/// <reference types="vite/client" />

/**
 * Get the correct asset path based on the environment and base configuration
 * @param assetPath - The asset path relative to data directory
 * @returns The full URL path for the asset (always absolute with origin for cache consistency)
 */
export const getAssetPath = (assetPath: string): string => {
  // Remove leading slash or dot-slash if present
  const cleanPath = assetPath.replace(/^\.?\//, '');

  // Get base path from environment
  const basePath = import.meta.env.BASE_URL || '/';

  // Construct the full path
  let fullPath: string;
  if (cleanPath.startsWith('data/')) {
    // Path already includes data/ prefix, use as is
    fullPath = `${basePath}${cleanPath}`;
  } else {
    // Path doesn't include data/ prefix, add it
    fullPath = `${basePath}data/${cleanPath}`;
  }

  // ALWAYS use absolute URLs with origin for cache consistency
  // This ensures URLs stored in Cache API match URLs requested by fetch()
  if (typeof window !== 'undefined' && fullPath.startsWith('/')) {
    return `${window.location.origin}${fullPath}`;
  }

  return fullPath;
};

/**
 * Get the learning modules JSON path
 * @returns The full URL path for learningModules.json
 */
export const getLearningModulesPath = (): string => {
  return getAssetPath('learningModules.json');
};

/** Path to one CEFR level's slice of the catalog (see scripts/generate-level-catalogs.mjs). */
export const getLevelCatalogPath = (level: string): string => {
  return getAssetPath(`learningModules/${level}.json`);
};

/** Path to the per-level module-count summary (see scripts/generate-level-catalogs.mjs). */
export const getLevelCountsPath = (): string => {
  return getAssetPath('learningModules/counts.json');
};
