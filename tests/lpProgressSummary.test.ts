// @vitest-environment jsdom
// Tests for the canonical cross-app CEFR progression logic (public/lp-progress-summary.js).
// This file is synced from Learn/scripts/lp-progress-summary.js via copy-shared.sh and shared
// verbatim by DeskFlow, HubFlow, and LyricFlow -- FluentFlow is the only app with a test runner,
// so its coverage stands in for all four. See docs/to-do/learnflow-progression-system.md.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkLevelAdvancement,
  getActiveLevel,
  getCombinedLevelProgress,
  levelUnlocks,
} from '../public/lp-progress-summary.js';
import { HUBFLOW_LEVELS, LYRICFLOW_LEVELS } from '../public/lp-level-map.js';

function idsForLevel(map: Record<string, string>, level: string): string[] {
  return Object.entries(map)
    .filter(([, lvl]) => lvl === level)
    .map(([id]) => id);
}

function writeDoc(app: string, content: Record<string, unknown>) {
  localStorage.setItem(
    `learnflow:progress:${app}:v1`,
    JSON.stringify({
      schemaVersion: 1,
      app,
      updatedAt: new Date().toISOString(),
      catalogVersion: 'test',
      summary: {},
      content,
    })
  );
}

/** Marks `count` of the given level's real HubFlow ids as completed. */
function completeHubflow(level: string, count: number) {
  const ids = idsForLevel(HUBFLOW_LEVELS, level).slice(0, count);
  writeDoc('hubflow', Object.fromEntries(ids.map(id => [id, { completed: true }])));
}
/** Marks `count` of the given level's real LyricFlow song ids as completed. */
function completeLyricflow(level: string, count: number) {
  const ids = idsForLevel(LYRICFLOW_LEVELS, level).slice(0, count);
  writeDoc('lyricflow', Object.fromEntries(ids.map(id => [id, { completed: true }])));
}
/**
 * FluentFlow content isn't id-mapped to a level -- each entry carries its own
 * cefrLevel field. Writes `total` fake entries at `level`, the first
 * `completedCount` of them marked completed (so progressPct = completedCount/total).
 */
function writeFluentflow(level: string, total: number, completedCount: number) {
  const content: Record<string, unknown> = {};
  for (let i = 0; i < total; i++) {
    content[`fake-${level}-${i}`] = { completed: i < completedCount, cefrLevel: level };
  }
  writeDoc('fluentflow', content);
}

beforeEach(() => {
  localStorage.clear();
});

describe('levelUnlocks', () => {
  it('unlocks modules at or below the active level', () => {
    expect(levelUnlocks('a1', 'a2')).toBe(true);
    expect(levelUnlocks('a2', 'a2')).toBe(true);
    expect(levelUnlocks('b1', 'a2')).toBe(false);
  });

  it('always unlocks levels outside LEVEL_ORDER (e.g. LyricFlow "FR" for Dernière Danse)', () => {
    expect(levelUnlocks('fr', 'a1')).toBe(true);
  });
});

describe('getActiveLevel', () => {
  it('defaults to a1 when lp-level is unset', () => {
    expect(getActiveLevel()).toBe('a1');
  });

  it('returns the stored lp-level', () => {
    localStorage.setItem('lp-level', 'b1');
    expect(getActiveLevel()).toBe('b1');
  });
});

describe('getCombinedLevelProgress', () => {
  it('treats a level with zero content as 100% for that app (regla del vacío)', () => {
    // HubFlow and LyricFlow both exclude C2 by design (see hubflow-cefr-rebalance.md).
    expect(idsForLevel(HUBFLOW_LEVELS, 'c2')).toHaveLength(0);
    expect(idsForLevel(LYRICFLOW_LEVELS, 'c2')).toHaveLength(0);

    const progress = getCombinedLevelProgress('c2');

    expect(progress.hubflow.totalModules).toBe(0);
    expect(progress.hubflow.progressPct).toBe(100);
    expect(progress.lyricflow.totalSongs).toBe(0);
    expect(progress.lyricflow.progressPct).toBe(100);
  });
});

describe('checkLevelAdvancement', () => {
  it('does not advance when FluentFlow is below 100%', () => {
    writeFluentflow('A1', 10, 5); // 50%
    completeHubflow('a1', idsForLevel(HUBFLOW_LEVELS, 'a1').length);
    completeLyricflow('a1', idsForLevel(LYRICFLOW_LEVELS, 'a1').length);

    const result = checkLevelAdvancement();

    expect(result.advanced).toBe(false);
    expect(getActiveLevel()).toBe('a1');
  });

  it('treats HubFlow exactly at 50% as meeting its threshold', () => {
    const a1HubflowIds = idsForLevel(HUBFLOW_LEVELS, 'a1');
    expect(a1HubflowIds.length).toBe(20); // fixture assumption -- keeps 50% exact

    writeFluentflow('A1', 5, 5);
    completeHubflow('a1', 10); // exactly 50% of 20
    completeLyricflow('a1', idsForLevel(LYRICFLOW_LEVELS, 'a1').length);

    const result = checkLevelAdvancement();

    expect(result.breakdown?.hubflow).toBe(50);
    expect(result.advanced).toBe(true);
    expect(result.level).toBe('a2');
  });

  it('advances a1 -> a2 once FluentFlow=100%, HubFlow>=50%, LyricFlow=100%', () => {
    writeFluentflow('A1', 5, 5);
    completeHubflow('a1', idsForLevel(HUBFLOW_LEVELS, 'a1').length);
    completeLyricflow('a1', idsForLevel(LYRICFLOW_LEVELS, 'a1').length);

    const result = checkLevelAdvancement();

    expect(result.advanced).toBe(true);
    expect(result.level).toBe('a2');
    expect(result.previousLevel).toBe('a1');
    expect(getActiveLevel()).toBe('a2');
  });

  it('is idempotent -- a second call with the same a1 data does not advance past a2', () => {
    writeFluentflow('A1', 5, 5);
    completeHubflow('a1', idsForLevel(HUBFLOW_LEVELS, 'a1').length);
    completeLyricflow('a1', idsForLevel(LYRICFLOW_LEVELS, 'a1').length);

    const first = checkLevelAdvancement();
    const second = checkLevelAdvancement();

    expect(first.advanced).toBe(true);
    expect(second.advanced).toBe(false); // now evaluating a2's condition, which isn't met
    expect(getActiveLevel()).toBe('a2');
  });

  it('never lowers the level, even with no progress recorded', () => {
    localStorage.setItem('lp-level', 'b1');

    const result = checkLevelAdvancement();

    expect(result.advanced).toBe(false);
    expect(getActiveLevel()).toBe('b1');
  });

  it('treats C2 as terminal and does not evaluate further advancement', () => {
    localStorage.setItem('lp-level', 'c2');

    const result = checkLevelAdvancement();

    expect(result.advanced).toBe(false);
    expect(result.terminal).toBe(true);
    expect(getActiveLevel()).toBe('c2');
  });
});
