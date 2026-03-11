import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CACHE_NAME,
  downloadLevels,
  deleteLevelCache,
  deleteAllCache,
  getCachedResponse,
  getLevelStorageInfo,
  getTotalCacheSize,
  verifyCacheIntegrity,
  formatStorageSize,
} from '../src/services/offlineManager';
import type { DownloadProgress } from '../src/services/offlineManager';

// Mock dependencies
vi.mock('../src/utils/pathUtils', () => ({
  getLearningModulesPath: () => 'http://localhost/data/learningModules.json',
  getAssetPath: (path: string) => `http://localhost/data/${path}`,
}));

vi.mock('../src/utils/logger', () => ({
  logDebug: vi.fn(),
  logError: vi.fn(),
}));

// --- Cache API mock ---
type CacheStore = Map<string, Response>;

function createMockCache(): Cache & { _store: CacheStore } {
  const store: CacheStore = new Map();
  return {
    _store: store,
    match: vi.fn(async (request: RequestInfo) => {
      const url = typeof request === 'string' ? request : (request as Request).url;
      const resp = store.get(url);
      return resp ? resp.clone() : undefined;
    }),
    put: vi.fn(async (request: RequestInfo, response: Response) => {
      const url = typeof request === 'string' ? request : (request as Request).url;
      store.set(url, response.clone());
    }),
    delete: vi.fn(async (request: RequestInfo) => {
      const url = typeof request === 'string' ? request : (request as Request).url;
      return store.delete(url);
    }),
    keys: vi.fn(async () => {
      return Array.from(store.keys()).map(url => new Request(url));
    }),
    add: vi.fn(),
    addAll: vi.fn(),
    matchAll: vi.fn(),
  } as unknown as Cache & { _store: CacheStore };
}

let mockCacheInstance: ReturnType<typeof createMockCache>;
const cacheInstances = new Map<string, ReturnType<typeof createMockCache>>();

function setupCachesMock() {
  cacheInstances.clear();
  mockCacheInstance = createMockCache();
  cacheInstances.set(CACHE_NAME, mockCacheInstance);

  const mockCaches = {
    open: vi.fn(async (name: string) => {
      if (!cacheInstances.has(name)) {
        cacheInstances.set(name, createMockCache());
      }
      return cacheInstances.get(name)!;
    }),
    delete: vi.fn(async (name: string) => {
      const existed = cacheInstances.has(name);
      if (existed) {
        cacheInstances.get(name)!._store.clear();
        cacheInstances.delete(name);
      }
      return existed;
    }),
    has: vi.fn(async (name: string) => cacheInstances.has(name)),
    keys: vi.fn(async () => Array.from(cacheInstances.keys())),
    match: vi.fn(),
  };

  Object.defineProperty(globalThis, 'caches', { value: mockCaches, writable: true });
}

// --- Test data ---
const mockModules = [
  {
    id: 'flashcard-basic-a1',
    name: 'Basic Vocabulary',
    learningMode: 'flashcard',
    level: ['a1'],
    category: 'Vocabulary',
    unit: 1,
    prerequisites: [],
    dataPath: 'data/a1/a1-flashcard-basic.json',
  },
  {
    id: 'quiz-grammar-a1',
    name: 'Grammar Quiz',
    learningMode: 'quiz',
    level: ['a1'],
    category: 'Grammar',
    unit: 1,
    prerequisites: [],
    dataPath: 'data/a1/a1-quiz-grammar.json',
  },
  {
    id: 'flashcard-intermediate-b1',
    name: 'Intermediate Vocabulary',
    learningMode: 'flashcard',
    level: ['b1'],
    category: 'Vocabulary',
    unit: 3,
    prerequisites: [],
    dataPath: 'data/b1/b1-flashcard-intermediate.json',
  },
];

function mockFetchSuccess() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('learningModules.json')) {
      return new Response(JSON.stringify(mockModules), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    // Return a small JSON response for any data file
    return new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
  return originalFetch;
}

describe('offlineManager', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    setupCachesMock();
    originalFetch = mockFetchSuccess();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('CACHE_NAME', () => {
    it('should be "fluentflow-offline-v5"', () => {
      expect(CACHE_NAME).toBe('fluentflow-offline-v5');
    });
  });

  describe('formatStorageSize', () => {
    it('should format bytes as KB when < 1 MB', () => {
      expect(formatStorageSize(1024)).toBe('1.0 KB');
      expect(formatStorageSize(512)).toBe('0.5 KB');
      expect(formatStorageSize(0)).toBe('0.0 KB');
    });

    it('should format bytes as MB when >= 1 MB', () => {
      expect(formatStorageSize(1024 * 1024)).toBe('1.0 MB');
      expect(formatStorageSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
    });

    it('should use 1 decimal place', () => {
      expect(formatStorageSize(1536)).toBe('1.5 KB');
      expect(formatStorageSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
    });
  });

  describe('downloadLevels', () => {
    it('should download all files for selected levels', async () => {
      const progressCalls: DownloadProgress[] = [];
      const result = await downloadLevels(['a1'], (p) => progressCalls.push({ ...p }));

      // a1 has 2 modules + learningModules.json = 3 files
      expect(result.total).toBe(3);
      expect(result.completed).toBe(3);
      expect(result.failed).toEqual([]);
    });

    it('should report monotonically increasing progress', async () => {
      const progressCalls: DownloadProgress[] = [];
      await downloadLevels(['a1'], (p) => progressCalls.push({ ...p }));

      // First call is initial (completed=0), then one per file
      expect(progressCalls[0].completed).toBe(0);
      for (let i = 1; i < progressCalls.length; i++) {
        expect(progressCalls[i].completed).toBeGreaterThanOrEqual(progressCalls[i - 1].completed);
      }
      // total is always the same
      const total = progressCalls[0].total;
      expect(progressCalls.every(p => p.total === total)).toBe(true);
    });

    it('should handle failed downloads and report them', async () => {
      globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('learningModules.json')) {
          return new Response(JSON.stringify(mockModules), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        // Fail the first data file always (all 3 attempts)
        if (url.includes('a1-flashcard-basic')) {
          throw new Error('Network error');
        }
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }) as typeof fetch;

      const result = await downloadLevels(['a1'], vi.fn());

      expect(result.failed.length).toBe(1);
      expect(result.failed[0]).toContain('a1-flashcard-basic');
      // completed should still equal total (failed files count as completed)
      expect(result.completed).toBe(result.total);
    });

    it('should cache learningModules.json along with level files', async () => {
      await downloadLevels(['a1'], vi.fn());

      const cache = await caches.open(CACHE_NAME);
      const modulesResponse = await cache.match('http://localhost/data/learningModules.json');
      expect(modulesResponse).toBeDefined();
    });

    it('should deduplicate URLs across levels', async () => {
      const progressCalls: DownloadProgress[] = [];
      await downloadLevels(['a1', 'b1'], (p) => progressCalls.push({ ...p }));

      // a1: 2 files, b1: 1 file, + learningModules.json = 4 unique files
      const lastProgress = progressCalls[progressCalls.length - 1];
      expect(lastProgress.total).toBe(4);
    });
  });

  describe('deleteLevelCache', () => {
    it('should delete only files for the specified level', async () => {
      // First download a1 and b1
      await downloadLevels(['a1', 'b1'], vi.fn());

      // Delete a1
      await deleteLevelCache('a1');

      const cache = await caches.open(CACHE_NAME);
      // a1 files should be gone
      const a1Response = await cache.match('http://localhost/data/a1/a1-flashcard-basic.json');
      expect(a1Response).toBeUndefined();

      // b1 files should still be there
      const b1Response = await cache.match('http://localhost/data/b1/b1-flashcard-intermediate.json');
      expect(b1Response).toBeDefined();
    });
  });

  describe('deleteAllCache', () => {
    it('should delete the entire cache', async () => {
      await downloadLevels(['a1'], vi.fn());
      await deleteAllCache();

      // Cache should be deleted
      const exists = await caches.has(CACHE_NAME);
      expect(exists).toBe(false);
    });
  });

  describe('getCachedResponse', () => {
    it('should return cached response when available', async () => {
      await downloadLevels(['a1'], vi.fn());

      const response = await getCachedResponse('http://localhost/data/learningModules.json');
      expect(response).toBeDefined();
    });

    it('should return undefined when not cached', async () => {
      const response = await getCachedResponse('http://localhost/data/nonexistent.json');
      expect(response).toBeUndefined();
    });
  });

  describe('getLevelStorageInfo', () => {
    it('should return info for downloaded levels only', async () => {
      await downloadLevels(['a1'], vi.fn());

      const info = await getLevelStorageInfo();
      expect(info.length).toBe(1);
      expect(info[0].level).toBe('a1');
      expect(info[0].moduleCount).toBe(2);
      expect(info[0].sizeBytes).toBeGreaterThanOrEqual(0);
    });

    it('should return empty array when nothing is cached', async () => {
      const info = await getLevelStorageInfo();
      expect(info).toEqual([]);
    });
  });

  describe('getTotalCacheSize', () => {
    it('should return sum of all level sizes', async () => {
      await downloadLevels(['a1', 'b1'], vi.fn());

      const totalSize = await getTotalCacheSize();
      const levelInfo = await getLevelStorageInfo();
      const expectedSum = levelInfo.reduce((sum, info) => sum + info.sizeBytes, 0);

      expect(totalSize).toBe(expectedSum);
    });

    it('should return 0 when nothing is cached', async () => {
      const totalSize = await getTotalCacheSize();
      expect(totalSize).toBe(0);
    });
  });

  describe('verifyCacheIntegrity', () => {
    it('should report all levels valid when all are cached', async () => {
      await downloadLevels(['a1', 'b1'], vi.fn());

      const result = await verifyCacheIntegrity(['a1', 'b1']);
      expect(result.valid).toBe(true);
      expect(result.missingLevels).toEqual([]);
    });

    it('should report missing levels when cache is cleared', async () => {
      await downloadLevels(['a1', 'b1'], vi.fn());
      await deleteAllCache();

      const result = await verifyCacheIntegrity(['a1', 'b1']);
      expect(result.valid).toBe(false);
      expect(result.missingLevels).toContain('a1');
      expect(result.missingLevels).toContain('b1');
    });

    it('should report only the missing level', async () => {
      await downloadLevels(['a1', 'b1'], vi.fn());
      await deleteLevelCache('a1');

      const result = await verifyCacheIntegrity(['a1', 'b1']);
      expect(result.valid).toBe(false);
      expect(result.missingLevels).toEqual(['a1']);
    });

    it('should return valid for empty downloaded levels', async () => {
      const result = await verifyCacheIntegrity([]);
      expect(result.valid).toBe(true);
      expect(result.missingLevels).toEqual([]);
    });
  });
});
