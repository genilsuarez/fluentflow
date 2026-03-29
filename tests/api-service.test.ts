import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchModules, fetchModuleData, filterModuleData, apiService } from '../src/services/api';
import { ModuleNotAvailableOfflineError } from '../src/utils/secureHttp';

vi.mock('../src/utils/pathUtils', () => ({
  getLearningModulesPath: () => 'http://localhost/data/learningModules.json',
  getAssetPath: (path: string) => `http://localhost/data/${path}`,
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
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.clearAllMocks();
});

describe('API Service Integration Tests', () => {
  describe('fetchModules', () => {
    it('should fetch and enhance modules successfully', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockModules), { status: 200 })
      ) as typeof fetch;

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

    it('should call fetch each time (React Query handles caching)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockModules), { status: 200 })
      ) as typeof fetch;

      await fetchModules();
      await fetchModules();

      // No memory cache — fetch is called each time
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
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

      globalThis.fetch = vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify(moduleWithPath), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(moduleData), { status: 200 })) as typeof fetch;

      const result = await fetchModuleData('test-module-1');

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('test-module-1');
      expect(result.data.data).toEqual(moduleData);
    });

    it('should handle module not found', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockModules), { status: 200 })
      ) as typeof fetch;

      const result = await fetchModuleData('non-existent-module');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Module non-existent-module not found');
    });

    it('should handle module without dataPath', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockModules), { status: 200 })
      ) as typeof fetch;

      const result = await fetchModuleData('test-module-1');

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('test-module-1');
      expect(result.data.data).toBeUndefined();
      // Only one fetch call (modules list), no second call for data
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('should throw ModuleNotAvailableOfflineError on SW 503', async () => {
      const swResponse = new Response(
        JSON.stringify({ error: 'MODULE_NOT_AVAILABLE_OFFLINE' }),
        { status: 503 }
      );
      const moduleWithPath = [{ ...mockModules[0], dataPath: 'data/a1/test.json' }];

      globalThis.fetch = vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify(moduleWithPath), { status: 200 }))
        .mockResolvedValueOnce(swResponse) as typeof fetch;

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
