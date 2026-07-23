import { describe, it, expect } from 'vitest';
import {
  buildCefrStats,
  getCountedCompletionIds,
} from '../src/utils/progressionCounting';
import type { LearningModule } from '../src/types';

const modules: LearningModule[] = [
  {
    id: 'a1-only',
    name: 'A1 Module',
    learningMode: 'flashcard',
    level: ['a1'],
    category: 'Vocabulary',
    unit: 1,
    prerequisites: [],
    estimatedTime: 5,
    difficulty: 1,
  },
  {
    id: 'a2-valid',
    name: 'A2 Module',
    learningMode: 'flashcard',
    level: ['a2'],
    category: 'Vocabulary',
    unit: 2,
    prerequisites: [],
    estimatedTime: 5,
    difficulty: 2,
  },
  {
    id: 'b1-incomplete',
    name: 'B1 Module',
    learningMode: 'flashcard',
    level: ['b1'],
    category: 'Vocabulary',
    unit: 3,
    prerequisites: [],
    estimatedTime: 5,
    difficulty: 3,
  },
  {
    id: 'b2-skip',
    name: 'B2 Skip',
    learningMode: 'flashcard',
    level: ['b2'],
    category: 'Vocabulary',
    unit: 4,
    prerequisites: [],
    estimatedTime: 5,
    difficulty: 4,
  },
];

describe('progressionCounting', () => {
  it('excludes skip-ahead completions from counted totals', () => {
    const counted = getCountedCompletionIds(modules, [
      'a1-only',
      'a2-valid',
      'b2-skip',
      'stale-id',
    ]);
    expect(counted.size).toBe(2);
    expect(counted.has('b2-skip')).toBe(false);
    expect(counted.has('stale-id')).toBe(false);
  });

  it('keeps cefr stats aligned with counted completions', () => {
    const counted = getCountedCompletionIds(modules, ['a1-only', 'a2-valid', 'b2-skip']);
    const cefr = buildCefrStats(modules, counted);
    const unitSum = Object.values(cefr).reduce((sum, level) => sum + level.completedModules, 0);
    expect(counted.size).toBe(unitSum);
    expect(cefr.B2.completedModules).toBe(0);
  });
});
