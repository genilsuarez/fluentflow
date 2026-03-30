import { shuffleArray } from '../../utils/randomUtils';

/**
 * Result of validating a user's word ordering against the correct answer.
 */
export interface ValidationResult {
  isCorrect: boolean;
  incorrectPositions: number[];
}

/**
 * Compare user's word array against the correct word array element by element (case-sensitive).
 * If lengths differ, all positions in userWords are marked incorrect.
 */
export function validateReordering(
  userWords: string[],
  correctWords: string[]
): ValidationResult {
  if (userWords.length !== correctWords.length) {
    return {
      isCorrect: false,
      incorrectPositions: userWords.map((_, i) => i),
    };
  }

  const incorrectPositions: number[] = [];
  for (let i = 0; i < userWords.length; i++) {
    if (userWords[i] !== correctWords[i]) {
      incorrectPositions.push(i);
    }
  }

  return {
    isCorrect: incorrectPositions.length === 0,
    incorrectPositions,
  };
}

/**
 * Merge correct words with optional distractors and shuffle.
 * If randomize is true (default), uses Fisher-Yates shuffle.
 * If randomize is false, uses shuffleDeterministic for a fixed order different from the original.
 */
export function prepareWords(
  words: string[],
  distractors?: string[],
  randomize: boolean = true
): string[] {
  const merged = [...words, ...(distractors ?? [])];
  return randomize ? shuffleArray(merged) : shuffleDeterministic(merged);
}

/**
 * Produce a deterministic order different from the original array.
 * For arrays with 3+ elements, guarantees the result differs from input.
 * Uses a simple reverse + rotate strategy to ensure determinism and difference.
 */
export function shuffleDeterministic(words: string[]): string[] {
  if (words.length <= 1) return [...words];

  if (words.length === 2) {
    // Swap the two elements — always different from original
    return [words[1], words[0]];
  }

  // For 3+ elements: rotate by 1 position to the right
  // This guarantees a different order since no element stays in its original position
  const result = [...words];
  const last = result.pop()!;
  result.unshift(last);

  return result;
}

/**
 * Remove word at wordIndex from `from` array and append it to the end of `to` array.
 * Returns new copies of both arrays (immutable).
 */
export function moveWord(
  from: string[],
  to: string[],
  wordIndex: number
): { from: string[]; to: string[] } {
  const newFrom = [...from];
  const [word] = newFrom.splice(wordIndex, 1);
  const newTo = [...to, word];
  return { from: newFrom, to: newTo };
}

/**
 * Insert a word at a specific position in an array.
 * Returns a new array (immutable).
 */
export function insertWordAt(arr: string[], word: string, index: number): string[] {
  const result = [...arr];
  result.splice(index, 0, word);
  return result;
}

/**
 * Remove word at the given index from an array.
 * Returns the removed word and the remaining array (immutable).
 */
export function removeWord(
  arr: string[],
  wordIndex: number
): { removed: string; remaining: string[] } {
  const remaining = [...arr];
  const [removed] = remaining.splice(wordIndex, 1);
  return { removed, remaining };
}
