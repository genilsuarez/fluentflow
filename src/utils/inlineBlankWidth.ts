/** Minimum visual size for inline blanks — keeps empty/no-article gaps from collapsing */
export const INLINE_BLANK_MIN_CHARS = 5;

/** Width in `ch` for inline blanks — scales with reserved char count, never clips typed text */
export function inlineBlankWidthCh(charCount: number, minChars = INLINE_BLANK_MIN_CHARS): string {
  const len = Math.max(charCount, minChars);
  return `${Math.ceil(len * 1.05 + 2)}ch`;
}

/** Reserve width from typed text, correct answer, and hint — stable empty vs filled */
export function gapBlankCharCount(params: {
  typedLength: number;
  correctLength: number;
  hintLength: number;
  minChars?: number;
}): number {
  const min = params.minChars ?? INLINE_BLANK_MIN_CHARS;
  return Math.max(params.typedLength, params.correctLength, params.hintLength, min);
}
