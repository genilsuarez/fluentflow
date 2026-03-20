#!/usr/bin/env node
/**
 * Analyze remaining quiz options with length disparity
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

function findQuizFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findQuizFiles(full));
    else if (entry.name.includes('quiz') && entry.name.endsWith('.json')) results.push(full);
  }
  return results;
}

const files = findQuizFiles('public/data');
let issues = 0;

for (const file of files) {
  const data = JSON.parse(readFileSync(file, 'utf8'));

  for (const q of data) {
    if (!q.options || q.options.length < 2) continue;

    const correctIdx = typeof q.correct === 'number'
      ? q.correct
      : q.options.indexOf(q.correct);

    if (correctIdx < 0) continue;

    const correctLen = q.options[correctIdx].length;
    const wrongLens = q.options
      .filter((_, i) => i !== correctIdx)
      .map(o => o.length);
    const avgWrongLen = wrongLens.reduce((a, b) => a + b, 0) / wrongLens.length;

    if (correctLen > avgWrongLen * 1.3) {
      const shortOpts = q.options
        .map((o, i) => ({ text: o, i, short: i !== correctIdx && o.length < correctLen * 0.7 }))
        .filter(o => o.short);

      if (shortOpts.length > 0) {
        issues++;
        if (issues <= 20) {
          console.log(`\n📍 ${file}`);
          console.log(`   Q: ${q.question || q.idiom}`);
          console.log(`   Correct (${correctLen}): "${q.options[correctIdx]}"`);
          for (const s of shortOpts) {
            console.log(`   Short (${s.text.length}): "${s.text}"`);
          }
        }
      }
    }
  }
}

console.log(`\n📊 Remaining issues: ${issues}`);
