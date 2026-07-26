import { describe, it, expect } from 'vitest';
import { matchesAnswer } from '../src/utils/answerUtils';

function parseCorrectParts(correct: string, blankCount: number): string[] {
  if (blankCount <= 1) return [correct.trim()];
  const parts = correct.split(',').map(part => part.trim());
  while (parts.length < blankCount) parts.push('');
  return parts.slice(0, blankCount);
}

function matchesAllBlanks(answers: string[], correctParts: string[]): boolean {
  if (!correctParts.length) return false;
  return correctParts.every((correct, index) => matchesAnswer(answers[index] || '', [correct]));
}

describe('completion multi-blank matching', () => {
  it('accepts an + the for articles exercise', () => {
    const correctParts = parseCorrectParts('an, the', 2);
    expect(correctParts).toEqual(['an', 'the']);
    expect(matchesAllBlanks(['an', 'the'], correctParts)).toBe(true);
  });

  it('accepts empty second gap when answer is no article (∅)', () => {
    const correctParts = parseCorrectParts('the, ∅', 2);
    expect(matchesAllBlanks(['the', ''], correctParts)).toBe(true);
  });

  it('treats zero-width contenteditable artifacts as empty for ∅ gaps', () => {
    const correctParts = parseCorrectParts('the, ∅', 2);
    expect(matchesAllBlanks(['the', '\u200b'], correctParts)).toBe(true);
  });

  it('accepts ∅ + the for language + unique noun exercise', () => {
    const correctParts = parseCorrectParts('∅, the', 2);
    expect(matchesAllBlanks(['', 'the'], correctParts)).toBe(true);
    expect(matchesAllBlanks(['-', 'the'], correctParts)).toBe(true);
    expect(matchesAllBlanks(['—', 'the'], correctParts)).toBe(true);
  });

  it('does not treat comma-separated correct as a single blank when blankCount is 2', () => {
    const wrongParts = parseCorrectParts('an, the', 1);
    expect(wrongParts).toEqual(['an, the']);
    expect(matchesAllBlanks(['an', 'the'], wrongParts)).toBe(false);
  });
});
