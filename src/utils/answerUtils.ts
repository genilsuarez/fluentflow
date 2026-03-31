/**
 * Normalize answer for comparison: lowercase, collapse whitespace, trim,
 * strip trailing period/punctuation for leniency.
 */
export function normalizeAnswer(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '').trim();
}
