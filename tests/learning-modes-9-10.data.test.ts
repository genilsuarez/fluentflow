import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve, basename } from 'path';

// --- Helpers ---

const PUBLIC_DATA = resolve(__dirname, '../public/data');

interface RegistryEntry {
  id: string;
  name: string;
  learningMode: string;
  dataPath: string;
  level: string[];
  category: string;
  unit: number;
  prerequisites: string[];
  description: string;
  estimatedTime: number;
  difficulty: number;
}

function loadRegistry(): RegistryEntry[] {
  return JSON.parse(readFileSync(resolve(PUBLIC_DATA, 'learningModules.json'), 'utf-8'));
}

function loadDataFile(dataPath: string): any[] {
  const fullPath = resolve(PUBLIC_DATA, '..', 'public', dataPath);
  return JSON.parse(readFileSync(fullPath, 'utf-8'));
}

const TEXT_INPUT_MODES = ['transformation', 'word-formation', 'error-correction'];

/**
 * Feature: learning-modes-9-10, Property 5: JSON minimum item count
 * Validates: Requirements 10.2, 11.2, 13.1
 */
describe('Feature: learning-modes-9-10, Property 5: All text-input JSON files have >= 25 items', () => {
  const registry = loadRegistry();
  const textInputModules = registry.filter(m => TEXT_INPUT_MODES.includes(m.learningMode));

  it('has text-input modules to test', () => {
    expect(textInputModules.length).toBeGreaterThan(0);
  });

  textInputModules.forEach(mod => {
    it(`${mod.id} (${mod.learningMode}) has >= 25 items`, () => {
      const filePath = resolve(PUBLIC_DATA, '..', mod.dataPath);
      const data = JSON.parse(readFileSync(filePath, 'utf-8'));
      expect(data.length).toBeGreaterThanOrEqual(25);
    });
  });
});


/**
 * Feature: learning-modes-9-10, Property 6: JSON schema validation
 * Validates: Requirements 10.3, 11.3, 13.2
 */
describe('Feature: learning-modes-9-10, Property 6: All items have required fields per mode', () => {
  const registry = loadRegistry();

  const wordFormationModules = registry.filter(m => m.learningMode === 'word-formation');
  const errorCorrectionModules = registry.filter(m => m.learningMode === 'error-correction');
  const transformationModules = registry.filter(m => m.learningMode === 'transformation');

  wordFormationModules.forEach(mod => {
    it(`${mod.id}: all items have sentence, rootWord, correct (string), explanation`, () => {
      const filePath = resolve(PUBLIC_DATA, '..', mod.dataPath);
      const data = JSON.parse(readFileSync(filePath, 'utf-8'));
      data.forEach((item: any, idx: number) => {
        expect(typeof item.sentence, `item[${idx}].sentence`).toBe('string');
        expect(item.sentence.length, `item[${idx}].sentence non-empty`).toBeGreaterThan(0);
        expect(typeof item.rootWord, `item[${idx}].rootWord`).toBe('string');
        expect(item.rootWord.length, `item[${idx}].rootWord non-empty`).toBeGreaterThan(0);
        expect(typeof item.correct, `item[${idx}].correct`).toBe('string');
        expect(item.correct.length, `item[${idx}].correct non-empty`).toBeGreaterThan(0);
        expect(typeof item.explanation, `item[${idx}].explanation`).toBe('string');
        expect(item.explanation.length, `item[${idx}].explanation non-empty`).toBeGreaterThan(0);
      });
    });
  });

  errorCorrectionModules.forEach(mod => {
    it(`${mod.id}: all items have sentence, correct (non-empty array), explanation`, () => {
      const filePath = resolve(PUBLIC_DATA, '..', mod.dataPath);
      const data = JSON.parse(readFileSync(filePath, 'utf-8'));
      data.forEach((item: any, idx: number) => {
        expect(typeof item.sentence, `item[${idx}].sentence`).toBe('string');
        expect(item.sentence.length, `item[${idx}].sentence non-empty`).toBeGreaterThan(0);
        expect(Array.isArray(item.correct), `item[${idx}].correct is array`).toBe(true);
        expect(item.correct.length, `item[${idx}].correct non-empty array`).toBeGreaterThan(0);
        item.correct.forEach((c: any, ci: number) => {
          expect(typeof c, `item[${idx}].correct[${ci}]`).toBe('string');
        });
        expect(typeof item.explanation, `item[${idx}].explanation`).toBe('string');
        expect(item.explanation.length, `item[${idx}].explanation non-empty`).toBeGreaterThan(0);
      });
    });
  });

  transformationModules.forEach(mod => {
    it(`${mod.id}: all items have prompt, source, correct (non-empty array), explanation`, () => {
      const filePath = resolve(PUBLIC_DATA, '..', mod.dataPath);
      const data = JSON.parse(readFileSync(filePath, 'utf-8'));
      data.forEach((item: any, idx: number) => {
        expect(typeof item.prompt, `item[${idx}].prompt`).toBe('string');
        expect(item.prompt.length, `item[${idx}].prompt non-empty`).toBeGreaterThan(0);
        expect(typeof item.source, `item[${idx}].source`).toBe('string');
        expect(item.source.length, `item[${idx}].source non-empty`).toBeGreaterThan(0);
        expect(Array.isArray(item.correct), `item[${idx}].correct is array`).toBe(true);
        expect(item.correct.length, `item[${idx}].correct non-empty array`).toBeGreaterThan(0);
        expect(typeof item.explanation, `item[${idx}].explanation`).toBe('string');
        expect(item.explanation.length, `item[${idx}].explanation non-empty`).toBeGreaterThan(0);
      });
    });
  });
});

/**
 * Feature: learning-modes-9-10, Property 7: JSON file naming convention
 * Validates: Requirements 10.7, 11.7
 */
describe('Feature: learning-modes-9-10, Property 7: New data files follow naming convention', () => {
  const registry = loadRegistry();
  const LEVELS = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'];
  const NEW_MODES = ['word-formation', 'error-correction'];

  const newModeModules = registry.filter(m => NEW_MODES.includes(m.learningMode));

  newModeModules.forEach(mod => {
    it(`${mod.id}: filename matches {level}-{mode}-{slug}.json`, () => {
      const fileName = basename(mod.dataPath);
      const level = mod.level[0];
      expect(LEVELS).toContain(level);
      const pattern = new RegExp(`^${level}-${mod.learningMode}-[a-z0-9-]+\\.json$`);
      expect(fileName).toMatch(pattern);
    });
  });
});

/**
 * Feature: learning-modes-9-10, Property 8: Registry entry completeness
 * Validates: Requirements 12.2, 12.3, 12.4, 12.5, 14.5
 */
describe('Feature: learning-modes-9-10, Property 8: All registry entries have required fields and valid dataPaths', () => {
  const registry = loadRegistry();
  const REQUIRED_FIELDS = [
    'id', 'name', 'learningMode', 'dataPath', 'level',
    'category', 'unit', 'prerequisites', 'description',
    'estimatedTime', 'difficulty',
  ];

  it('every entry has all required fields', () => {
    registry.forEach(mod => {
      REQUIRED_FIELDS.forEach(field => {
        expect(mod, `${mod.id} missing ${field}`).toHaveProperty(field);
      });
    });
  });

  it('every entry dataPath points to an existing file', () => {
    registry.forEach(mod => {
      const filePath = resolve(PUBLIC_DATA, '..', mod.dataPath);
      expect(existsSync(filePath), `${mod.id}: ${mod.dataPath} does not exist`).toBe(true);
    });
  });

  it('word-formation entries have learningMode "word-formation"', () => {
    const wfModules = registry.filter(m => m.id.includes('word-formation'));
    wfModules.forEach(mod => {
      expect(mod.learningMode).toBe('word-formation');
    });
  });

  it('error-correction entries have learningMode "error-correction"', () => {
    const ecModules = registry.filter(m => m.id.includes('error-correction'));
    ecModules.forEach(mod => {
      expect(mod.learningMode).toBe('error-correction');
    });
  });
});


/**
 * Feature: learning-modes-9-10, Property 9: Module distribution matches target matrix
 * Validates: Requirements 14.1, 14.2, 14.3, 14.4
 */
describe('Feature: learning-modes-9-10, Property 9: Module distribution matches target matrix', () => {
  const registry = loadRegistry();
  const LEVELS = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'];

  it('each CEFR level has at least 40 modules', () => {
    LEVELS.forEach(level => {
      const count = registry.filter(m => m.level.includes(level)).length;
      expect(count, `${level} should have >= 40 modules, got ${count}`).toBeGreaterThanOrEqual(40);
    });
  });

  it('total module count is at least 240', () => {
    expect(registry.length).toBeGreaterThanOrEqual(240);
  });

  it('active-production mode totals meet or exceed targets', () => {
    const transformationCount = registry.filter(m => m.learningMode === 'transformation').length;
    const wordFormationCount = registry.filter(m => m.learningMode === 'word-formation').length;
    const errorCorrectionCount = registry.filter(m => m.learningMode === 'error-correction').length;
    const reorderingCount = registry.filter(m => m.learningMode === 'reordering').length;

    expect(transformationCount, 'transformation total').toBeGreaterThanOrEqual(16);
    expect(wordFormationCount, 'word-formation total').toBeGreaterThanOrEqual(17);
    expect(errorCorrectionCount, 'error-correction total').toBeGreaterThanOrEqual(16);
    expect(reorderingCount, 'reordering total').toBeGreaterThanOrEqual(12);
  });

  it('legacy recognition modes do not exceed their targets', () => {
    const readingCount = registry.filter(m => m.learningMode === 'reading').length;
    const completionCount = registry.filter(m => m.learningMode === 'completion').length;
    const flashcardCount = registry.filter(m => m.learningMode === 'flashcard').length;
    const quizCount = registry.filter(m => m.learningMode === 'quiz').length;

    expect(readingCount, 'reading').toBeLessThanOrEqual(32);
    expect(completionCount, 'completion').toBeLessThanOrEqual(37);
    expect(flashcardCount, 'flashcard').toBeLessThanOrEqual(32);
    expect(quizCount, 'quiz').toBeLessThanOrEqual(38);
  });
});

/**
 * Feature: learning-modes-9-10, Property 10: No duplicate exercises within files
 * Validates: Requirements 13.3
 */
describe('Feature: learning-modes-9-10, Property 10: No duplicate exercises within files', () => {
  const registry = loadRegistry();

  const transformationModules = registry.filter(m => m.learningMode === 'transformation');
  const wordFormationModules = registry.filter(m => m.learningMode === 'word-formation');
  const errorCorrectionModules = registry.filter(m => m.learningMode === 'error-correction');

  transformationModules.forEach(mod => {
    it(`${mod.id}: no duplicate (prompt, source) pairs`, () => {
      const filePath = resolve(PUBLIC_DATA, '..', mod.dataPath);
      const data = JSON.parse(readFileSync(filePath, 'utf-8'));
      const keys = data.map((item: any) => `${item.prompt}|||${item.source}`);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size, `${mod.id} has duplicate exercises`).toBe(keys.length);
    });
  });

  wordFormationModules.forEach(mod => {
    it(`${mod.id}: no duplicate (sentence, rootWord) pairs`, () => {
      const filePath = resolve(PUBLIC_DATA, '..', mod.dataPath);
      const data = JSON.parse(readFileSync(filePath, 'utf-8'));
      const keys = data.map((item: any) => `${item.sentence}|||${item.rootWord}`);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size, `${mod.id} has duplicate exercises`).toBe(keys.length);
    });
  });

  errorCorrectionModules.forEach(mod => {
    it(`${mod.id}: no duplicate sentences`, () => {
      const filePath = resolve(PUBLIC_DATA, '..', mod.dataPath);
      const data = JSON.parse(readFileSync(filePath, 'utf-8'));
      const sentences = data.map((item: any) => item.sentence);
      const uniqueSentences = new Set(sentences);
      expect(uniqueSentences.size, `${mod.id} has duplicate sentences`).toBe(sentences.length);
    });
  });
});

/**
 * Feature: learning-modes-9-10, Property 11: Prerequisite chains are valid DAGs
 * Validates: Requirements 14.6
 */
describe('Feature: learning-modes-9-10, Property 11: Prerequisite chains are valid', () => {
  const registry = loadRegistry();
  const moduleIds = new Set(registry.map(m => m.id));
  const LEVELS = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'];

  it('all prerequisite IDs reference existing modules', () => {
    registry.forEach(mod => {
      mod.prerequisites.forEach(prereq => {
        expect(moduleIds.has(prereq), `${mod.id} has dangling prerequisite: ${prereq}`).toBe(true);
      });
    });
  });

  it('prerequisite chains within each level form valid DAGs (no cycles)', () => {
    LEVELS.forEach(level => {
      const levelModules = registry.filter(m => m.level.includes(level));
      const levelIds = new Set(levelModules.map(m => m.id));

      // Build adjacency list (module -> modules that depend on it)
      const dependsOn = new Map<string, string[]>();
      levelModules.forEach(mod => {
        const levelPrereqs = mod.prerequisites.filter(p => levelIds.has(p));
        dependsOn.set(mod.id, levelPrereqs);
      });

      // Topological sort via DFS to detect cycles
      const visited = new Set<string>();
      const inStack = new Set<string>();

      function hasCycle(nodeId: string): boolean {
        if (inStack.has(nodeId)) return true;
        if (visited.has(nodeId)) return false;

        visited.add(nodeId);
        inStack.add(nodeId);

        const prereqs = dependsOn.get(nodeId) || [];
        for (const prereq of prereqs) {
          if (hasCycle(prereq)) return true;
        }

        inStack.delete(nodeId);
        return false;
      }

      levelModules.forEach(mod => {
        expect(hasCycle(mod.id), `Cycle detected involving ${mod.id} at level ${level}`).toBe(false);
      });
    });
  });
});
