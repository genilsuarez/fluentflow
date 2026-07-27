import { describe, it, expect } from 'vitest';
import { countBlanks, splitOnBlanks } from '../src/utils/blankMarker';

describe('blankMarker multi-blank consistency', () => {
  it('countBlanks matches splitOnBlanks gap count for canonical markers', () => {
    const sentence = "I'm reading ___ interesting book about ___ history of Spain.";
    expect(countBlanks(sentence)).toBe(2);
    expect(splitOnBlanks(sentence).length - 1).toBe(2);
  });

  it('counts two blanks in language + world exercise', () => {
    const sentence = '___ English is spoken all over ___ world.';
    expect(countBlanks(sentence)).toBe(2);
    expect(splitOnBlanks(sentence).length - 1).toBe(2);
  });

  it('normalizes legacy 4+ underscore runs to a single canonical blank', () => {
    const sentence = 'I went to ____ cinema last night.';
    expect(countBlanks(sentence)).toBe(1);
    expect(splitOnBlanks(sentence).length - 1).toBe(1);
  });
});
