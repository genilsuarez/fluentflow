#!/usr/bin/env node
/**
 * Splits public/data/learningModules.json (the hand-edited, canonical module
 * catalog — never touch this generator's output by hand instead of the
 * source) into one lightweight file per CEFR level plus a tiny counts
 * summary, so the app doesn't have to download+parse all 330 modules' worth
 * of metadata just to open the level the user is actually on.
 *
 * Output: public/data/learningModules/{a1,a2,b1,b2,c1,c2}.json + counts.json
 *
 * Run after any edit to learningModules.json. `npm run validate:content`
 * checks the output is in sync (see scripts/validation/validate-content.js).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'public/data/learningModules.json');
const OUT_DIR = path.join(ROOT, 'public/data/learningModules');

const LEVEL_ORDER = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'];

function getPrimaryLevel(module) {
  if (!module.level) return null;
  return Array.isArray(module.level) ? module.level[0] : module.level;
}

/** Pure: groups modules by level and returns the exact file contents this generator produces — no I/O, safe to use from a drift-check. */
export function computeLevelCatalogs(modules) {
  const byLevel = Object.fromEntries(LEVEL_ORDER.map(l => [l, []]));

  for (const mod of modules) {
    const level = getPrimaryLevel(mod);
    if (!level || !byLevel[level]) {
      throw new Error(`Module "${mod.id}" has an unrecognized level: ${JSON.stringify(mod.level)}`);
    }
    byLevel[level].push(mod);
  }

  const files = {};
  for (const level of LEVEL_ORDER) {
    files[`${level}.json`] = JSON.stringify(byLevel[level]);
  }

  const counts = Object.fromEntries(LEVEL_ORDER.map(l => [l, byLevel[l].length]));
  counts.total = modules.length;
  files['counts.json'] = JSON.stringify(counts);

  return { totalModules: modules.length, counts, files };
}

export function generateLevelCatalogs() {
  const modules = JSON.parse(readFileSync(SOURCE, 'utf8'));
  const result = computeLevelCatalogs(modules);

  mkdirSync(OUT_DIR, { recursive: true });
  for (const [fileName, content] of Object.entries(result.files)) {
    writeFileSync(path.join(OUT_DIR, fileName), content);
  }

  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { totalModules, counts } = generateLevelCatalogs();
  console.log(`Generated public/data/learningModules/*.json — ${totalModules} modules`, counts);
}
