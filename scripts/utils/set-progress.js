#!/usr/bin/env node

/**
 * set-progress.js — Set learning progress to a specific level or module
 *
 * Generates a JavaScript snippet to paste in the browser console,
 * or outputs JSON to pipe into another tool.
 *
 * Usage:
 *   node scripts/utils/set-progress.js --level a2        # Complete all A1+A2
 *   node scripts/utils/set-progress.js --level b1        # Complete A1+A2+B1
 *   node scripts/utils/set-progress.js --upto <moduleId> # Complete up to (not including) that module
 *   node scripts/utils/set-progress.js --reset            # Generate reset snippet
 *   node scripts/utils/set-progress.js --list             # List all modules by level
 *   node scripts/utils/set-progress.js --list a2          # List modules for a specific level
 *
 * Options:
 *   --score <n>    Score per module (default: 90)
 *   --json         Output raw JSON instead of console snippet
 *   --dry          Show which modules would be marked, don't generate snippet
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const MODULES_PATH = path.join(ROOT, 'public/data/learningModules.json');

const LEVELS_ORDER = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'];

// --- Parse args ---
const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(name);
  return idx !== -1 ? (args[idx + 1] || true) : null;
}
const hasFlag = (name) => args.includes(name);

// --- Load modules ---
const modules = JSON.parse(fs.readFileSync(MODULES_PATH, 'utf8'));

// --- Commands ---

if (hasFlag('--help') || hasFlag('-h') || args.length === 0) {
  printHelp();
  process.exit(0);
}

if (hasFlag('--list')) {
  const filterLevel = getArg('--list');
  listModules(typeof filterLevel === 'string' ? filterLevel : null);
  process.exit(0);
}

if (hasFlag('--reset')) {
  generateReset();
  process.exit(0);
}

const score = parseInt(getArg('--score') || '90', 10);
const jsonOutput = hasFlag('--json');
const dryRun = hasFlag('--dry');

if (hasFlag('--level')) {
  const level = getArg('--level')?.toLowerCase();
  if (!level || !LEVELS_ORDER.includes(level)) {
    console.error(`❌ Invalid level: ${level}. Valid: ${LEVELS_ORDER.join(', ')}`);
    process.exit(1);
  }
  const targetModules = getModulesUpToLevel(level);
  output(targetModules, score, jsonOutput, dryRun);
} else if (hasFlag('--upto')) {
  const moduleId = getArg('--upto');
  const targetModules = getModulesUpTo(moduleId);
  output(targetModules, score, jsonOutput, dryRun);
} else {
  console.error('❌ Specify --level, --upto, --reset, or --list. Use --help for usage.');
  process.exit(1);
}

// --- Functions ---

function getModulesUpToLevel(level) {
  const levelIdx = LEVELS_ORDER.indexOf(level);
  // Include all modules of this level and below
  const targetLevels = LEVELS_ORDER.slice(0, levelIdx + 1);
  return modules.filter(m => m.level.some(l => targetLevels.includes(l)));
}

function getModulesUpTo(moduleId) {
  const idx = modules.findIndex(m => m.id === moduleId);
  if (idx === -1) {
    console.error(`❌ Module not found: ${moduleId}`);
    console.error('Use --list to see available modules.');
    process.exit(1);
  }
  // All modules before this one (not including it)
  return modules.slice(0, idx);
}
