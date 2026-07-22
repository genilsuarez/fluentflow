import { describe, it, expect } from 'vitest';
import { normalizeAnswer, matchesAnswer } from '../src/utils/answerUtils';

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

  it('strips commas/semicolons/colons but preserves apostrophes', () => {
    expect(normalizeAnswer("I don't know, really")).toBe("i don't know really");
    expect(normalizeAnswer("Yes; of course")).toBe("yes of course");
    expect(normalizeAnswer("Note: important")).toBe("note important");
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

  it('expands common contractions to full forms', () => {
    expect(normalizeAnswer("it's cold today")).toBe('it is cold today');
    expect(normalizeAnswer('It is cold today.')).toBe('it is cold today');
    expect(normalizeAnswer("it's cold today")).toBe(normalizeAnswer('It is cold today.'));
  });
});

describe('matchesAnswer', () => {
  it('accepts contraction when correct answer uses full form', () => {
    expect(matchesAnswer("it's cold today", ['It is cold today.'])).toBe(true);
    expect(matchesAnswer('it is cold today', ["It's cold today."])).toBe(true);
  });
});
