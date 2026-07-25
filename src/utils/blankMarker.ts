/** Canonical fill-in-the-blank marker in exercise JSON (exactly 3 underscores). */
export const BLANK_MARKER = '___' as const;

/** Matches one blank — any run of 3+ underscores (tolerates legacy 4/5/6 in cached JSON). */
const BLANK_RUN = /_{3,}/;

/** Matches runs of 4+ underscores (non-canonical — use for migration/validation). */
export const NON_CANONICAL_BLANK_PATTERN = /_{4,}/g;

export function countBlanks(sentence: string): number {
  return (sentence.match(BLANK_RUN) ?? []).length;
}

export function splitOnBlanks(sentence: string): string[] {
  return normalizeBlankMarkers(sentence).split(BLANK_RUN);
}

/** Replace the first blank with text (e.g. TTS in listen-complete). */
export function replaceFirstBlank(sentence: string, replacement: string): string {
  return normalizeBlankMarkers(sentence).replace(BLANK_RUN, replacement);
}

/** Collapse any run of 4+ underscores to the canonical marker. */
export function normalizeBlankMarkers(text: string): string {
  return text.replace(NON_CANONICAL_BLANK_PATTERN, BLANK_MARKER);
}
