import { describe, it, expect } from 'vitest';
import { normalizeAnswer } from '../src/utils/answerUtils';

describe('normalizeAnswer', () => {
  it('returns empty string for empty input', () => {
    expect(normalizeAnswer('')).toBe('');
  });

  it('converts to lowercase', () => {
    expect(normalizeAnswer('Hello World')).toBe('hello world');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeAnswer('  hello  ')).toBe('hello');
  });

  it('collapses multiple internal spaces to single space', () => {
    expect(normalizeAnswer('hello   world')).toBe('hello world');
  });

  it('strips trailing period', () => {
    expect(normalizeAnswer('hello world.')).toBe('hello world');
  });

  it('strips trailing exclamation mark', () => {
    expect(normalizeAnswer('hello world!')).toBe('hello world');
  });

  it('strips trailing question mark', () => {
    expect(normalizeAnswer('hello world?')).toBe('hello world');
  });

  it('strips multiple trailing punctuation marks', () => {
    expect(normalizeAnswer('hello world...')).toBe('hello world');
    expect(normalizeAnswer('hello world!!!')).toBe('hello world');
    expect(normalizeAnswer('hello world?!')).toBe('hello world');
  });

  it('handles all-whitespace input', () => {
    expect(normalizeAnswer('   ')).toBe('');
  });

  it('handles tabs and newlines as whitespace', () => {
    expect(normalizeAnswer('hello\t\nworld')).toBe('hello world');
  });

  it('normalizes combined case, whitespace, and punctuation', () => {
    expect(normalizeAnswer('  She Doesn\'t Like Coffee.  ')).toBe("she doesn't like coffee");
  });

  it('preserves internal punctuation (commas, apostrophes)', () => {
    expect(normalizeAnswer("I don't know, really")).toBe("i don't know, really");
  });

  it('two strings differing only in case normalize to the same value', () => {
    expect(normalizeAnswer('HELLO')).toBe(normalizeAnswer('hello'));
  });

  it('two strings differing only in trailing punctuation normalize to the same value', () => {
    expect(normalizeAnswer('hello world')).toBe(normalizeAnswer('hello world.'));
    expect(normalizeAnswer('hello world')).toBe(normalizeAnswer('hello world!'));
  });

  it('two strings differing only in whitespace normalize to the same value', () => {
    expect(normalizeAnswer('hello world')).toBe(normalizeAnswer('  hello   world  '));
  });
});
