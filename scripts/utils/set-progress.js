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

function output(targetModules, score, jsonOut, dry) {
  const ids = targetModules.map(m => m.id);
  const byLevel = {};
  for (const m of targetModules) {
    const lvl = m.level[0];
    byLevel[lvl] = (byLevel[lvl] || 0) + 1;
  }

  console.error(`\n📋 ${ids.length} modules to complete:`);
  for (const [lvl, count] of Object.entries(byLevel)) {
    console.error(`   ${lvl.toUpperCase()}: ${count} modules`);
  }

  if (dry) {
    console.error('\n🔍 Modules:');
    for (const m of targetModules) {
      console.error(`   [${m.level[0].toUpperCase()}] ${m.id} — ${m.name}`);
    }
    console.error('\n(dry run — no snippet generated)');
    return;
  }

  if (jsonOut) {
    console.log(JSON.stringify({ moduleIds: ids, score }, null, 2));
    return;
  }

  // Generate browser console snippet
  generateSnippet(ids, score);
}

function generateSnippet(moduleIds, score) {
  const correctPerModule = Math.round(score * 20 / 100);
  const incorrectPerModule = 20 - correctPerModule;

  const snippet = `
// === FluentFlow: Set Progress ===
// Modules: ${moduleIds.length} | Score: ${score}%
// Generated: ${new Date().toISOString()}
(() => {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();
  const moduleIds = ${JSON.stringify(moduleIds)};

  // 1. progress-storage (completedModules)
  const ps = JSON.parse(localStorage.getItem('progress-storage') || '{"state":{"progressHistory":[],"dailyProgress":{},"completedModules":{}},"version":0}');
  for (const id of moduleIds) {
    if (!ps.state.completedModules[id]) {
      ps.state.completedModules[id] = { moduleId: id, completedAt: today, bestScore: ${score}, attempts: 1 };
    }
  }
  localStorage.setItem('progress-storage', JSON.stringify(ps));

  // 2. user-storage (userScores)
  const us = JSON.parse(localStorage.getItem('user-storage') || '{"state":{"user":null,"userScores":{}},"version":0}');
  let addedCorrect = 0, addedIncorrect = 0;
  for (const id of moduleIds) {
    if (!us.state.userScores[id]) {
      us.state.userScores[id] = { moduleId: id, bestScore: ${score}, attempts: 1, lastAttempt: now, timeSpent: 120 };
      addedCorrect += ${correctPerModule};
      addedIncorrect += ${incorrectPerModule};
    }
  }
  localStorage.setItem('user-storage', JSON.stringify(us));

  // 3. app-storage (globalScore)
  const as = JSON.parse(localStorage.getItem('app-storage') || '{"state":{"globalScore":{"correct":0,"incorrect":0,"total":0,"accuracy":0}},"version":0}');
  const gs = as.state.globalScore || { correct: 0, incorrect: 0, total: 0, accuracy: 0 };
  gs.correct += addedCorrect;
  gs.incorrect += addedIncorrect;
  gs.total = gs.correct + gs.incorrect;
  gs.accuracy = gs.total > 0 ? (gs.correct / gs.total) * 100 : 0;
  as.state.globalScore = gs;
  localStorage.setItem('app-storage', JSON.stringify(as));

  console.log('✅ Progress set:', moduleIds.length, 'modules |', 'Score:', gs.correct + '/' + gs.incorrect, Math.round(gs.accuracy) + '%');
  console.log('🔄 Reload the page to see changes');
})();`.trim();

  console.log(snippet);
  console.error(`\n✅ Snippet generated. Paste it in the browser console and reload.`);
}

function generateReset() {
  const snippet = `
// === FluentFlow: Reset All Progress ===
(() => {
  localStorage.removeItem('progress-storage');
  localStorage.removeItem('user-storage');
  const as = JSON.parse(localStorage.getItem('app-storage') || '{"state":{}}');
  as.state.globalScore = { correct: 0, incorrect: 0, total: 0, accuracy: 0 };
  localStorage.setItem('app-storage', JSON.stringify(as));
  console.log('✅ All progress reset. Reload the page.');
})();`.trim();

  console.log(snippet);
  console.error('\n✅ Reset snippet generated. Paste it in the browser console and reload.');
}

function listModules(filterLevel) {
  const filtered = filterLevel
    ? modules.filter(m => m.level.includes(filterLevel.toLowerCase()))
    : modules;

  let currentLevel = '';
  for (const m of filtered) {
    const lvl = m.level[0].toUpperCase();
    if (lvl !== currentLevel) {
      currentLevel = lvl;
      console.log(`\n── ${lvl} ──`);
    }
    console.log(`  ${m.id.padEnd(45)} ${m.name} (${m.learningMode})`);
  }
  console.log(`\nTotal: ${filtered.length} modules`);
}

function printHelp() {
  console.log(`
set-progress.js — Set FluentFlow learning progress

Usage:
  node scripts/utils/set-progress.js --level a2          Complete all A1 + A2 modules
  node scripts/utils/set-progress.js --level b1          Complete all A1 + A2 + B1 modules
  node scripts/utils/set-progress.js --upto <moduleId>   Complete all modules before <moduleId>
  node scripts/utils/set-progress.js --reset              Generate reset snippet
  node scripts/utils/set-progress.js --list [level]       List modules (optionally filter by level)

Options:
  --score <n>    Score per module, 0-100 (default: 90)
  --json         Output raw JSON instead of console snippet
  --dry          Show which modules would be marked without generating snippet
  --help         Show this help

Examples:
  # Unlock first B1 module (complete A1+A2):
  node scripts/utils/set-progress.js --level a2

  # Complete everything up to "sorting-modal-verbs-b1":
  node scripts/utils/set-progress.js --upto sorting-modal-verbs-b1

  # See what --level b1 would do:
  node scripts/utils/set-progress.js --level b1 --dry

  # Reset all progress:
  node scripts/utils/set-progress.js --reset
`);
}
