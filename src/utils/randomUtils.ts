/**
 * Robust randomization utilities for learning components
 */

/**
 * Fisher-Yates shuffle algorithm for true randomization
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Conditionally shuffle array based on settings
 * Returns shuffled array if randomization is enabled, original array otherwise
 */
export function conditionalShuffle<T>(array: T[], shouldRandomize: boolean): T[] {
  return shouldRandomize ? shuffleArray(array) : [...array];
}

/**
 * Conditionally randomize using Math.random based on settings
 * Returns randomized comparison function or stable sort
 */
export function conditionalRandomSort(shouldRandomize: boolean): (a: any, b: any) => number {
  return shouldRandomize ? () => Math.random() - 0.5 : () => 0;
}
