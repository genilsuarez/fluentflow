import { describe, it, expect } from 'vitest';
import {
  validateReordering,
  prepareWords,
  shuffleDeterministic,
  moveWord,
  insertWordAt,
  removeWord,
} from '../src/components/learning/reorderingUtils';

describe('validateReordering', () => {
  it('returns correct when arrays match exactly', () => {
    const result = validateReordering(['The', 'cat', 'sits'], ['The', 'cat', 'sits']);
    expect(result.isCorrect).toBe(true);
    expect(result.incorrectPositions).toEqual([]);
  });

  it('returns incorrect positions when words are swapped', () => {
    const result = validateReordering(['cat', 'The', 'sits'], ['The', 'cat', 'sits']);
    expect(result.isCorrect).toBe(false);
    expect(result.incorrectPositions).toEqual([0, 1]);
  });

  it('marks all positions incorrect when lengths differ', () => {
    const result = validateReordering(['The', 'cat'], ['The', 'cat', 'sits']);
    expect(result.isCorrect).toBe(false);
    expect(result.incorrectPositions).toEqual([0, 1]);
  });

  it('marks all positions incorrect when user has extra words (distractors)', () => {
    const result = validateReordering(['The', 'cat', 'sits', 'was'], ['The', 'cat', 'sits']);
    expect(result.isCorrect).toBe(false);
    expect(result.incorrectPositions).toEqual([0, 1, 2, 3]);
  });

  it('is case-sensitive', () => {
    const result = validateReordering(['the', 'Cat'], ['The', 'cat']);
    expect(result.isCorrect).toBe(false);
    expect(result.incorrectPositions).toEqual([0, 1]);
  });

  it('handles empty arrays', () => {
    const result = validateReordering([], []);
    expect(result.isCorrect).toBe(true);
    expect(result.incorrectPositions).toEqual([]);
  });

  it('handles single element arrays', () => {
    const result = validateReordering(['hello'], ['hello']);
    expect(result.isCorrect).toBe(true);
    expect(result.incorrectPositions).toEqual([]);
  });
});

describe('prepareWords', () => {
  it('merges words and distractors', () => {
    const result = prepareWords(['a', 'b'], ['c', 'd'], false);
    expect(result).toHaveLength(4);
    expect(result.sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('works without distractors', () => {
    const result = prepareWords(['a', 'b', 'c'], undefined, false);
    expect(result).toHaveLength(3);
    expect(result.sort()).toEqual(['a', 'b', 'c']);
  });

  it('uses shuffleDeterministic when randomize is false', () => {
    const words = ['The', 'cat', 'sits'];
    const result = prepareWords(words, undefined, false);
    expect(result).toHaveLength(3);
    // Deterministic: should be the same every time
    const result2 = prepareWords(words, undefined, false);
    expect(result).toEqual(result2);
  });

  it('defaults to random shuffle', () => {
    const words = ['a', 'b', 'c', 'd', 'e'];
    const result = prepareWords(words);
    expect(result).toHaveLength(5);
    expect(result.sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});

describe('shuffleDeterministic', () => {
  it('returns different order for 3+ element arrays', () => {
    const words = ['The', 'cat', 'sits'];
    const result = shuffleDeterministic(words);
    expect(result).not.toEqual(words);
    expect(result.sort()).toEqual([...words].sort());
  });

  it('swaps two-element arrays', () => {
    const result = shuffleDeterministic(['a', 'b']);
    expect(result).toEqual(['b', 'a']);
  });

  it('returns copy for single element', () => {
    const result = shuffleDeterministic(['a']);
    expect(result).toEqual(['a']);
  });

  it('returns empty array for empty input', () => {
    expect(shuffleDeterministic([])).toEqual([]);
  });

  it('is deterministic (same input → same output)', () => {
    const words = ['She', 'has', 'been', 'working'];
    expect(shuffleDeterministic(words)).toEqual(shuffleDeterministic(words));
  });

  it('does not mutate the original array', () => {
    const words = ['a', 'b', 'c'];
    const copy = [...words];
    shuffleDeterministic(words);
    expect(words).toEqual(copy);
  });
});

describe('moveWord', () => {
  it('moves word from source to end of target', () => {
    const result = moveWord(['a', 'b', 'c'], ['x'], 1);
    expect(result.from).toEqual(['a', 'c']);
    expect(result.to).toEqual(['x', 'b']);
  });

  it('moves first word', () => {
    const result = moveWord(['a', 'b'], [], 0);
    expect(result.from).toEqual(['b']);
    expect(result.to).toEqual(['a']);
  });

  it('moves last word', () => {
    const result = moveWord(['a', 'b'], ['x'], 1);
    expect(result.from).toEqual(['a']);
    expect(result.to).toEqual(['x', 'b']);
  });

  it('does not mutate original arrays', () => {
    const from = ['a', 'b'];
    const to = ['x'];
    moveWord(from, to, 0);
    expect(from).toEqual(['a', 'b']);
    expect(to).toEqual(['x']);
  });
});

describe('insertWordAt', () => {
  it('inserts at the beginning', () => {
    expect(insertWordAt(['b', 'c'], 'a', 0)).toEqual(['a', 'b', 'c']);
  });

  it('inserts in the middle', () => {
    expect(insertWordAt(['a', 'c'], 'b', 1)).toEqual(['a', 'b', 'c']);
  });

  it('inserts at the end', () => {
    expect(insertWordAt(['a', 'b'], 'c', 2)).toEqual(['a', 'b', 'c']);
  });

  it('inserts into empty array', () => {
    expect(insertWordAt([], 'a', 0)).toEqual(['a']);
  });

  it('does not mutate the original array', () => {
    const arr = ['a', 'b'];
    insertWordAt(arr, 'x', 1);
    expect(arr).toEqual(['a', 'b']);
  });
});

describe('removeWord', () => {
  it('removes word at index and returns it', () => {
    const result = removeWord(['a', 'b', 'c'], 1);
    expect(result.removed).toBe('b');
    expect(result.remaining).toEqual(['a', 'c']);
  });

  it('removes first word', () => {
    const result = removeWord(['a', 'b'], 0);
    expect(result.removed).toBe('a');
    expect(result.remaining).toEqual(['b']);
  });

  it('removes last word', () => {
    const result = removeWord(['a', 'b'], 1);
    expect(result.removed).toBe('b');
    expect(result.remaining).toEqual(['a']);
  });

  it('does not mutate the original array', () => {
    const arr = ['a', 'b', 'c'];
    removeWord(arr, 1);
    expect(arr).toEqual(['a', 'b', 'c']);
  });
});
