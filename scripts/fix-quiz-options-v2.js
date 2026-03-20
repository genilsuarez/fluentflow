#!/usr/bin/env node
/**
 * Auto-expand short quiz options to match correct answer length.
 * Adds contextual padding to short wrong answers.
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
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

// Contextual suffixes to pad short options
const suffixes = [
  ' in this context',
  ' in this situation',
  ' at that moment',
  ' in a given scenario',
  ' under the circumstances',
  ' when it happens',
  ' as a general rule',
  ' in everyday language',
  ' in common usage',
  ' in most situations',
  ' as commonly understood',
  ' in practical terms',
  ' in a typical scenario',
  ' in the usual sense',
  ' as generally meant',
];

// Prefixes for very short options
const prefixes = [
  'to literally ',
  'to actually ',
  'it refers to ',
  'it means to ',
  'the act of ',
  'related to ',
  'having to do with ',
  'in the sense of ',
  'something like ',
  'the idea of ',
];

function expandOption(opt, targetLen, qi, oi) {
  if (opt.length >= targetLen * 0.7) return opt;

  // Use deterministic "random" based on indices
  const seed = qi * 7 + oi * 13;

  let expanded = opt;

  // If very short (< 15 chars), add a prefix
  if (expanded.length < 15) {
    const prefix = prefixes[seed % prefixes.length];
    // Only add prefix if option doesn't start with capital or "to "
    if (!expanded.startsWith('To ') && !expanded.startsWith('to ') && expanded[0] === expanded[0].toLowerCase()) {
      expanded = prefix + expanded;
    }
  }

  // If still too short, add a suffix
  if (expanded.length < targetLen * 0.7) {
    const suffix = suffixes[(seed + 3) % suffixes.length];
    expanded = expanded + suffix;
  }

  // If STILL too short, add another suffix
  if (expanded.length < targetLen * 0.6) {
    const suffix2 = suffixes[(seed + 7) % suffixes.length];
    expanded = expanded + suffix2;
  }

  return expanded;
}

const files = findQuizFiles('public/data').filter(f =>
  f.includes('idiom') || f.includes('phrasal')
);

let totalFixed = 0;

for (const file of files) {
  const data = JSON.parse(readFileSync(file, 'utf8'));
  let fileFixed = 0;

  for (let qi = 0; qi < data.length; qi++) {
    const q = data[qi];
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

    if (correctLen <= avgWrongLen * 1.3) continue;

    let changed = false;
    for (let oi = 0; oi < q.options.length; oi++) {
      if (oi === correctIdx) continue;
      const opt = q.options[oi];
      if (opt.length < correctLen * 0.7) {
        const expanded = expandOption(opt, correctLen, qi, oi);
        if (expanded !== opt) {
          q.options[oi] = expanded;
          changed = true;
        }
      }
    }

    if (changed) fileFixed++;
  }

  if (fileFixed > 0) {
    writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
    console.log(`✅ ${file}: fixed ${fileFixed} questions`);
    totalFixed += fileFixed;
  }
}

console.log(`\n📊 Total: ${totalFixed} additional questions fixed`);
