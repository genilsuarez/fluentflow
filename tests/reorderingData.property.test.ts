import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { ReorderingData } from '../src/types';

/**
 * Feature: reordering-mode, Property 1: Conformidad del esquema ReorderingData
 * Validates: Requirements 1.1, 1.2, 1.4
 */

// --- Arbitraries ---

const categoryArb = fc.constantFrom(
  'Vocabulary' as const,
  'Grammar' as const,
  'PhrasalVerbs' as const,
  'Idioms' as const,
  'Reading' as const,
  'Review' as const
);

const difficultyLevelArb = fc.constantFrom(
  'a1' as const,
  'a2' as const,
  'b1' as const,
  'b2' as const,
  'c1' as const,
  'c2' as const
);

const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0);

const wordArb = fc.stringMatching(/^[A-Za-z'-]{1,30}$/);

const wordsArb = fc.array(wordArb, { minLength: 2, maxLength: 20 });

const reorderingDataArb: fc.Arbitrary<ReorderingData> = fc.record({
  id: nonEmptyStringArb,
  sentence: nonEmptyStringArb,
  words: wordsArb,
  category: fc.option(categoryArb, { nil: undefined }),
  level: fc.option(difficultyLevelArb, { nil: undefined }),
  distractors: fc.option(fc.array(wordArb, { minLength: 1, maxLength: 5 }), { nil: undefined }),
  hint: fc.option(nonEmptyStringArb, { nil: undefined }),
  explanation: fc.option(nonEmptyStringArb, { nil: undefined }),
});

// --- Tests ---

describe('Feature: reordering-mode, Property 1: Conformidad del esquema ReorderingData', () => {
  it('every generated ReorderingData has required field `id` (non-empty string)', () => {
    fc.assert(
      fc.property(reorderingDataArb, (data) => {
        expect(typeof data.id).toBe('string');
        expect(data.id.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('every generated ReorderingData has required field `sentence` (non-empty string)', () => {
    fc.assert(
      fc.property(reorderingDataArb, (data) => {
        expect(typeof data.sentence).toBe('string');
        expect(data.sentence.trim().length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('every generated ReorderingData has required field `words` (array with >= 2 elements)', () => {
    fc.assert(
      fc.property(reorderingDataArb, (data) => {
        expect(Array.isArray(data.words)).toBe(true);
        expect(data.words.length).toBeGreaterThanOrEqual(2);
        data.words.forEach(w => {
          expect(typeof w).toBe('string');
        });
      }),
      { numRuns: 100 }
    );
  });

  it('optional fields are either undefined or valid when present', () => {
    fc.assert(
      fc.property(reorderingDataArb, (data) => {
        // distractors: undefined or string[]
        if (data.distractors !== undefined) {
          expect(Array.isArray(data.distractors)).toBe(true);
          data.distractors.forEach(d => {
            expect(typeof d).toBe('string');
          });
        }

        // hint: undefined or string
        if (data.hint !== undefined) {
          expect(typeof data.hint).toBe('string');
        }

        // explanation: undefined or string
        if (data.explanation !== undefined) {
          expect(typeof data.explanation).toBe('string');
        }

        // category: undefined or valid Category
        if (data.category !== undefined) {
          expect(['Vocabulary', 'Grammar', 'PhrasalVerbs', 'Idioms', 'Reading', 'Review']).toContain(data.category);
        }

        // level: undefined or valid DifficultyLevel
        if (data.level !== undefined) {
          expect(['a1', 'a2', 'b1', 'b2', 'c1', 'c2']).toContain(data.level);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('generated objects conform to the full ReorderingData schema', () => {
    fc.assert(
      fc.property(reorderingDataArb, (data) => {
        // Required fields exist
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('sentence');
        expect(data).toHaveProperty('words');

        // Required field types
        expect(typeof data.id).toBe('string');
        expect(typeof data.sentence).toBe('string');
        expect(Array.isArray(data.words)).toBe(true);

        // Required field constraints
        expect(data.id.length).toBeGreaterThan(0);
        expect(data.sentence.trim().length).toBeGreaterThan(0);
        expect(data.words.length).toBeGreaterThanOrEqual(2);

        // No unexpected required fields missing
        const requiredKeys = ['id', 'sentence', 'words'];
        requiredKeys.forEach(key => {
          expect(data[key as keyof ReorderingData]).toBeDefined();
        });
      }),
      { numRuns: 100 }
    );
  });
});
