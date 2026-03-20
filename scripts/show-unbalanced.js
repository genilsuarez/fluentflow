#!/usr/bin/env node
/**
 * Show remaining unbalanced questions in idiom quizzes
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

const files = findQuizFiles('public/data').filter(f =>
  f.includes('idiom') || f.includes('phrasal')
);

for (const file of files) {
  const data = JSON.parse(readFileSync(file, 'utf8'));
  let shown = false;

  for (let qi = 0; qi < data.length; qi++) {
    const q = data[qi];
    if (!q.options || q.options.length < 2) continue;
    const correctIdx = typeof q.correct === 'number' ? q.correct : q.options.indexOf(q.correct);
    if (correctIdx < 0) continue;

    const correctLen = q.options[correctIdx].length;
    const wrongLens = q.options.filter((_, i) => i !== correctIdx).map(o => o.length);
    const avgWrongLen = wrongLens.reduce((a, b) => a + b, 0) / wrongLens.length;

    if (correctLen > avgWrongLen * 1.3) {
      if (!shown) { console.log(`\n=== ${file} ===`); shown = true; }
      console.log(`[${qi}] Q: ${(q.question || q.idiom || '').substring(0, 60)}`);
      q.options.forEach((o, i) => {
        const mark = i === correctIdx ? '✓' : ' ';
        console.log(`  ${mark} [${i}] (${o.length}) "${o}"`);
      });
    }
  }
}
