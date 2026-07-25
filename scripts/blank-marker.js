/**
 * Canonical blank marker utilities (Node scripts).
 * Keep in sync with src/utils/blankMarker.ts
 */
export const BLANK_MARKER = '___';

/** Any run of 3+ underscores (split/replace — tolerates legacy lengths). */
const BLANK_RUN = /_{3,}/;

export const NON_CANONICAL_BLANK_PATTERN = /_{4,}/g;

export function countBlanks(sentence) {
  return (sentence.match(BLANK_RUN) || []).length;
}

export function splitOnBlanks(sentence) {
  return normalizeBlankMarkers(sentence).split(BLANK_RUN);
}

export function replaceFirstBlank(sentence, replacement) {
  return normalizeBlankMarkers(sentence).replace(BLANK_RUN, replacement);
}

export function normalizeBlankMarkers(text) {
  return text.replace(NON_CANONICAL_BLANK_PATTERN, BLANK_MARKER);
}
