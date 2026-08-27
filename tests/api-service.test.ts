import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  fetchModules,
  fetchModuleData,
  filterModuleData,
  apiService,
  __resetModulesCacheForTests,
} from '../src/services/api';
import { ModuleNotAvailableOfflineError } from '../src/utils/secureHttp';

vi.mock('../src/utils/pathUtils', () => ({
  getAssetPath: (path: string) => `http://localhost/data/${path}`,
  getLevelCatalogPath: (level: string) => `http://localhost/data/learningModules/${level}.json`,
}));

vi.mock('../src/utils/logger', () => ({
  logError: vi.fn(),
  logDebug: vi.fn(),
}));

const mockModules = [
  {
    id: 'test-module-1',
    name: 'Test Module 1',
    learningMode: 'flashcard',
    level: ['a1'],
    category: 'Vocabulary',
    unit: 1,
    prerequisites: [],
    // no estimatedTime, difficulty, tags — should get defaults
  },
  {
    id: 'test-module-2',
    name: 'Test Module 2',
    learningMode: 'quiz',
    level: ['a2'],
    category: 'Grammar',
    unit: 2,
    prerequisites: ['test-module-1'],
    estimatedTime: 10,
    difficulty: 4,
    tags: ['custom'],
  },
];

let originalFetch: typeof fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  // No `localStorage` in this suite's node test environment — getCombinedLevelIndex()
  // catches that and falls back to 'a1' (index 0), which is what these tests assume.
  __resetModulesCacheForTests();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  __resetModulesCacheForTests();
  vi.clearAllMocks();
});

/**
 * fetchModules() now loads the catalog progressively by CEFR level: the
 * caller's current level (here 'a1', combinedIndex 0) is fetched and
 * awaited, while every other level is prefetched in the background and
 * merged in later. Tests only need the 'a1' response to resolve correctly —
 * a URL-aware mock keeps the background prefetch calls from stealing queued
 * `mockResolvedValueOnce` responses meant for the awaited call.
 */
function mockCatalogFetch(
  a1Response: unknown,
  extraHandler?: (url: string) => Response | undefined
) {
  globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (extraHandler) {
      const extra = extraHandler(url);
      if (extra) return Promise.resolve(extra);
    }
    if (url.includes('/learningModules/a1.json')) {
      return Promise.resolve(new Response(JSON.stringify(a1Response), { status: 200 }));
    }
    // Background prefetch for other levels — irrelevant to the assertions.
    return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
  }) as typeof fetch;
}

describe('API Service Integration Tests', () => {
  describe('fetchModules', () => {
    it('should fetch and enhance modules successfully', async () => {
      mockCatalogFetch(mockModules);

      const result = await fetchModules();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      // Default values applied
      expect(result.data[0].estimatedTime).toBe(5);
      expect(result.data[0].difficulty).toBe(3);
      expect(result.data[0].tags).toEqual(['Vocabulary']);
      // Original values preserved
      expect(result.data[1].estimatedTime).toBe(10);
      expect(result.data[1].difficulty).toBe(4);
      expect(result.data[1].tags).toEqual(['custom']);
    });

    it('should handle fetch errors gracefully', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as typeof fetch;

      const result = await fetchModules();

      expect(result.success).toBe(false);
      expect(result.data).toEqual([]);
      expect(result.error).toBe('Network error');
    });

    it('should reuse the in-flight/resolved catalog across calls in the same session', async () => {
      mockCatalogFetch(mockModules);

      await fetchModules();
      const fetchCallsAfterFirst = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
      await fetchModules();

      // Module-level cache: the second call reuses the first's promise
      // instead of issuing new requests.
      expect(globalThis.fetch as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(
        fetchCallsAfterFirst
      );
    });
  });

  describe('fetchModuleData', () => {
    it('should fetch module with data successfully', async () => {
      const moduleWithPath = [
        {
          ...mockModules[0],
          dataPath: 'data/a1/test-flashcard.json',
        },
      ];
      const moduleData = [{ en: 'hello', es: 'hola' }];

      mockCatalogFetch(moduleWithPath, url =>
        url.includes('/data/a1/test-flashcard.json')
          ? new Response(JSON.stringify(moduleData), { status: 200 })
          : undefined
      );

      const result = await fetchModuleData('test-module-1');

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('test-module-1');
      expect(result.data.data).toEqual(moduleData);
    });

    it('should handle module not found', async () => {
      mockCatalogFetch(mockModules);

      const result = await fetchModuleData('non-existent-module');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Module non-existent-module not found');
    });

    it('should handle module without dataPath', async () => {
      mockCatalogFetch(mockModules);

      const result = await fetchModuleData('test-module-1');

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('test-module-1');
      expect(result.data.data).toBeUndefined();
    });

    it('should throw ModuleNotAvailableOfflineError on SW 503', async () => {
      const swResponse = new Response(JSON.stringify({ error: 'MODULE_NOT_AVAILABLE_OFFLINE' }), {
        status: 503,
      });
      const moduleWithPath = [{ ...mockModules[0], dataPath: 'data/a1/test.json' }];

      mockCatalogFetch(moduleWithPath, url =>
        url.includes('/data/a1/test.json') ? swResponse : undefined
      );

      await expect(fetchModuleData('test-module-1')).rejects.toThrow(
        ModuleNotAvailableOfflineError
      );
    });
  });

  describe('filterModuleData', () => {
    const mockData = [
      { category: 'Vocabulary', level: 'a1', text: 'Item 1' },
      { category: 'Grammar', level: 'a1', text: 'Item 2' },
      { category: 'Vocabulary', level: 'b1', text: 'Item 3' },
      { category: 'PhrasalVerbs', level: 'b1', text: 'Item 4' },
    ];

    it('should not filter by categories (category filtering removed per Req 6.1)', () => {
      const result = filterModuleData(mockData, { categories: ['Vocabulary'] }, 'test-module');
      // filterModuleData no longer filters by category — all items are returned
      expect(result).toHaveLength(4);
    });

    it('should filter by level', () => {
      const result = filterModuleData(mockData, { level: 'a1' }, 'test-module');
      expect(result).toHaveLength(2);
      expect(result.every(item => item.level === 'a1')).toBe(true);
    });

    it('should apply limit', () => {
      const result = filterModuleData(mockData, { limit: 2 }, 'test-module');
      expect(result).toHaveLength(2);
    });

    it('should handle empty data', () => {
      const result = filterModuleData([], { categories: ['Vocabulary'] }, 'test-module');
      expect(result).toEqual([]);
    });

    it('should handle non-array data', () => {
      const result = filterModuleData(null as any, { categories: ['Vocabulary'] }, 'test-module');
      expect(result).toEqual([]);
    });
  });

  describe('apiService compat object', () => {
    it('should expose filterModuleData', () => {
      const data = [{ category: 'Vocabulary', level: 'a1' }];
      const result = apiService.filterModuleData(data, { categories: ['Vocabulary'] }, 'test');
      expect(result).toHaveLength(1);
    });
  });
});
