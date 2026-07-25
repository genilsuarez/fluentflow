#!/usr/bin/env node
/**
 * Normalize fill-in-the-blank markers in public/data JSON to exactly "___".
 * Replaces any run of 4+ consecutive underscores with the canonical marker.
 *
 * Usage: node scripts/normalize-blank-markers.js [--check]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeBlankMarkers, NON_CANONICAL_BLANK_PATTERN } from './blank-marker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'public', 'data');
const checkOnly = process.argv.includes('--check');

function walkJsonFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJsonFiles(full, files);
    else if (entry.name.endsWith('.json')) files.push(full);
  }
  return files;
}

let changedFiles = 0;

for (const filePath of walkJsonFiles(DATA_DIR)) {
  const original = fs.readFileSync(filePath, 'utf8');
  if (!NON_CANONICAL_BLANK_PATTERN.test(original)) continue;

  NON_CANONICAL_BLANK_PATTERN.lastIndex = 0;
  const normalized = normalizeBlankMarkers(original);

  if (normalized === original) continue;

  changedFiles++;
  const rel = path.relative(path.join(__dirname, '..'), filePath);
  if (checkOnly) {
    console.error(`non-canonical blank markers: ${rel}`);
    process.exitCode = 1;
    continue;
  }

  fs.writeFileSync(filePath, normalized);
  console.log(`normalized: ${rel}`);
}

if (!checkOnly) {
  console.log(changedFiles ? `Done — ${changedFiles} file(s) updated.` : 'No files needed normalization.');
} else if (!changedFiles) {
  console.log('All blank markers are canonical.');
}
