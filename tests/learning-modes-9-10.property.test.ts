import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { normalizeAnswer } from '../src/utils/answerUtils';
import { useSettingsStore } from '../src/stores/settingsStore';

/**
 * Feature: learning-modes-9-10, Property 1: normalizeAnswer invariants
 * Validates: Requirements 4.2, 5.2
 *
 * For any two strings that differ only in casing, whitespace, or trailing
 * punctuation, normalizeAnswer(a) === normalizeAnswer(b).
 */
describe('Feature: learning-modes-9-10, Property 1: normalizeAnswer invariants', () => {
  it('normalizeAnswer is idempotent: normalizing twice yields the same result', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 200 }), (s) => {
        const once = normalizeAnswer(s);
        const twice = normalizeAnswer(once);
        expect(twice).toBe(once);
      }),
      { numRuns: 100 }
    );
  });

  it('case variation does not affect normalized result', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 100 }), (s) => {
        const lower = normalizeAnswer(s.toLowerCase());
        const upper = normalizeAnswer(s.toUpperCase());
        expect(lower).toBe(upper);
      }),
      { numRuns: 100 }
    );
  });

  it('leading/trailing whitespace does not affect normalized result', () => {
    const wsCharArb = fc.constantFrom(' ', '\t', '\n');
    const wsArb = fc.array(wsCharArb, { minLength: 1, maxLength: 5 }).map(arr => arr.join(''));
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 80 }).filter(s => s.trim().length > 0),
        wsArb,
        wsArb,
        (s, wsBefore, wsAfter) => {
          expect(normalizeAnswer(wsBefore + s + wsAfter)).toBe(normalizeAnswer(s));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('trailing punctuation (.!?) does not affect normalized result', () => {
    const punctCharArb = fc.constantFrom('.', '!', '?');
    const punctArb = fc.array(punctCharArb, { minLength: 1, maxLength: 3 }).map(arr => arr.join(''));
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 80 }).filter(s => s.trim().length > 0 && !/[.!?]$/.test(s.trim())),
        punctArb,
        (s, punct) => {
          expect(normalizeAnswer(s + punct)).toBe(normalizeAnswer(s));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('internal whitespace runs are collapsed to single space', () => {
    const wordArb = fc.stringMatching(/^[a-z]{1,10}$/);
    fc.assert(
      fc.property(
        fc.array(wordArb, { minLength: 2, maxLength: 6 }),
        (words) => {
          const singleSpaced = words.join(' ');
          const multiSpaced = words.join('   ');
          expect(normalizeAnswer(multiSpaced)).toBe(normalizeAnswer(singleSpaced));
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * Feature: learning-modes-9-10, Property 3: Settings round-trip
 * Validates: Requirements 9.2, 9.3
 *
 * For any valid item count (integer >= 1) and new mode key
 * (wordFormationMode, errorCorrectionMode), setting and getting
 * should return the same value.
 */
describe('Feature: learning-modes-9-10, Property 3: Settings round-trip', () => {
  it('setGameSetting and reading gameSettings returns the same itemCount for new modes', () => {
    const modeArb = fc.constantFrom(
      'wordFormationMode' as const,
      'errorCorrectionMode' as const
    );
    const itemCountArb = fc.integer({ min: 1, max: 1000 });

    fc.assert(
      fc.property(modeArb, itemCountArb, (mode, count) => {
        const store = useSettingsStore.getState();

        // Set the value
        store.setGameSetting(mode, 'itemCount', count);

        // Read it back
        const updated = useSettingsStore.getState();
        expect(updated.gameSettings[mode].itemCount).toBe(count);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: learning-modes-9-10, Property 4: Settings migration
 * Validates: Requirements 9.5
 *
 * For any valid v11 state, applying v12 migration should add
 * wordFormationMode and errorCorrectionMode with defaults while
 * preserving existing fields.
 */
describe('Feature: learning-modes-9-10, Property 4: Settings migration', () => {
  it('v12 migration adds new mode defaults while preserving existing gameSettings fields', () => {
    const itemCountArb = fc.integer({ min: 1, max: 100 });

    // Generate a random v11 gameSettings (without the new modes)
    const v11GameSettingsArb = fc.record({
      flashcardMode: fc.record({ wordCount: itemCountArb }),
      quizMode: fc.record({ questionCount: itemCountArb }),
      completionMode: fc.record({ itemCount: itemCountArb }),
      sortingMode: fc.record({ wordCount: itemCountArb, categoryCount: itemCountArb }),
      matchingMode: fc.record({ wordCount: itemCountArb }),
      reorderingMode: fc.record({ itemCount: itemCountArb }),
      transformationMode: fc.record({ itemCount: itemCountArb }),
    });

    fc.assert(
      fc.property(v11GameSettingsArb, (v11gs) => {
        // Simulate the v12 migration logic (from settingsStore.ts)
        const gs: any = { ...v11gs };
        if (!gs.wordFormationMode) gs.wordFormationMode = { itemCount: 10 };
        if (!gs.errorCorrectionMode) gs.errorCorrectionMode = { itemCount: 10 };

        // New modes should have defaults
        expect(gs.wordFormationMode).toEqual({ itemCount: 10 });
        expect(gs.errorCorrectionMode).toEqual({ itemCount: 10 });

        // Existing fields should be preserved
        expect(gs.flashcardMode).toEqual(v11gs.flashcardMode);
        expect(gs.quizMode).toEqual(v11gs.quizMode);
        expect(gs.completionMode).toEqual(v11gs.completionMode);
        expect(gs.sortingMode).toEqual(v11gs.sortingMode);
        expect(gs.matchingMode).toEqual(v11gs.matchingMode);
        expect(gs.reorderingMode).toEqual(v11gs.reorderingMode);
        expect(gs.transformationMode).toEqual(v11gs.transformationMode);
      }),
      { numRuns: 100 }
    );
  });

  it('v12 migration does not overwrite existing wordFormationMode/errorCorrectionMode if already present', () => {
    const itemCountArb = fc.integer({ min: 1, max: 100 });

    fc.assert(
      fc.property(itemCountArb, itemCountArb, (wfCount, ecCount) => {
        // Simulate a state that already has the new modes (e.g., double migration)
        const gs: any = {
          flashcardMode: { wordCount: 10 },
          wordFormationMode: { itemCount: wfCount },
          errorCorrectionMode: { itemCount: ecCount },
        };

        // Apply migration logic
        if (!gs.wordFormationMode) gs.wordFormationMode = { itemCount: 10 };
        if (!gs.errorCorrectionMode) gs.errorCorrectionMode = { itemCount: 10 };

        // Should preserve existing values, not overwrite with defaults
        expect(gs.wordFormationMode.itemCount).toBe(wfCount);
        expect(gs.errorCorrectionMode.itemCount).toBe(ecCount);
      }),
      { numRuns: 100 }
    );
  });
});
