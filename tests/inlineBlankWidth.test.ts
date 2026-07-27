import { describe, it, expect } from 'vitest';
import {
  gapBlankCharCount,
  inlineBlankWidthCh,
  INLINE_BLANK_MIN_CHARS,
} from '../src/utils/inlineBlankWidth';

describe('inlineBlankWidth', () => {
  it('reserves at least the correct answer length when field is empty', () => {
    const emptyThe = gapBlankCharCount({
      typedLength: 0,
      correctLength: 3,
      hintLength: 1,
    });
    const filledThe = gapBlankCharCount({
      typedLength: 3,
      correctLength: 3,
      hintLength: 1,
    });
    expect(emptyThe).toBe(filledThe);
    expect(inlineBlankWidthCh(emptyThe)).toBe(inlineBlankWidthCh(filledThe));
  });

  it('does not shrink below minimum char count', () => {
    expect(
      gapBlankCharCount({ typedLength: 0, correctLength: 1, hintLength: 1 })
    ).toBe(INLINE_BLANK_MIN_CHARS);
  });

  it('grows when user types longer than the correct answer', () => {
    const wider = gapBlankCharCount({
      typedLength: 8,
      correctLength: 3,
      hintLength: 1,
    });
    const normal = gapBlankCharCount({
      typedLength: 3,
      correctLength: 3,
      hintLength: 1,
    });
    expect(wider).toBeGreaterThan(normal);
    expect(inlineBlankWidthCh(wider)).not.toBe(inlineBlankWidthCh(normal));
  });
});
