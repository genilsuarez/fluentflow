#!/usr/bin/env node
/**
 * Verify quiz options balance in idiom files
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

const files = findQuizFiles('public/data').filter(f => f.includes('idiom'));

for (const file of files) {
  const data = JSON.parse(readFileSync(file, 'utf8'));
  let balanced = 0, unbalanced = 0;

  for (const q of data) {
    if (!q.options || q.options.length < 2) continue;
    const correctIdx = typeof q.correct === 'number' ? q.correct : q.options.indexOf(q.correct);
    if (correctIdx < 0) continue;

    const correctLen = q.options[correctIdx].length;
    const wrongLens = q.options.filter((_, i) => i !== correctIdx).map(o => o.length);
    const avgWrongLen = wrongLens.reduce((a, b) => a + b, 0) / wrongLens.length;
    const ratio = correctLen / avgWrongLen;

    if (ratio > 1.3) unbalanced++;
    else balanced++;
  }

  console.log(`${file}: ${balanced} balanced, ${unbalanced} unbalanced`);
}
