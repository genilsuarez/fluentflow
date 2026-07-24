/**
 * validate-content.js — Validación profunda de contenido de módulos de aprendizaje
 *
 * Verifica integridad estructural, calidad de contenido, duplicados y coherencia
 * entre los archivos JSON de datos y learningModules.json.
 *
 * Uso:
 *   node scripts/validation/validate-content.js          # Reporte completo
 *   node scripts/validation/validate-content.js --errors  # Solo errores
 *   node scripts/validation/validate-content.js --json    # Output JSON
 *   node scripts/validation/validate-content.js --fix-dry # Muestra qué arreglaría sin tocar archivos
 *
 * Exit codes:
 *   0 = sin errores (puede haber warnings)
 *   1 = errores encontrados
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT, 'public', 'data');
const MODULES_PATH = path.join(DATA_DIR, 'learningModules.json');

// ============================================================
// CONFIG
// ============================================================

/** Minimum item counts per learning mode */
const MINIMUMS = {
  flashcard: 40,
  quiz: 20,
  completion: 20,
  sorting: 20,
  matching: 20,
  reading: 4, // sections
  reordering: 5,
  transformation: 20,
  'error-correction': 20,
  'word-formation': 20,
};

/** Time estimate formulas: mode → (itemCount) → minutes */
const TIME_FORMULAS = {
  flashcard:          (c) => Math.max(1, Math.round(c * 5 / 60)),
  quiz:               (c) => Math.max(2, Math.round(Math.min(c, 15) * 20 / 60)),
  completion:         (c) => Math.max(2, Math.round(Math.min(c, 15) * 20 / 60)),
  sorting:            (c) => Math.max(2, Math.round(Math.min(c, 20) * 10 / 60)),
  matching:           (c) => Math.max(1, Math.round(Math.min(c, 10) * 15 / 60)),
  reading:            (c) => Math.max(3, Math.round(c * 0.9)),
  reordering:         (c) => Math.max(2, Math.round(Math.min(c, 12) * 15 / 60)),
  transformation:     (c) => Math.max(2, Math.round(Math.min(c, 12) * 20 / 60)),
  'error-correction': (c) => Math.max(2, Math.round(Math.min(c, 12) * 20 / 60)),
  'word-formation':   (c) => Math.max(2, Math.round(Math.min(c, 12) * 15 / 60)),
};

/** CEFR level order for cross-level comparisons */
const LEVEL_ORDER = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'];

/**
 * The CompletionComponent splits sentences on this exact string.
 * See: src/components/learning/CompletionComponent.tsx → renderSentence()
 */
const COMPLETION_BLANK = '______'; // 6 underscores

// ============================================================
// HELPERS
// ============================================================

const errors = [];
const warnings = [];
const info = [];

function err(code, msg) { errors.push({ code, msg }); }
function warn(code, msg) { warnings.push({ code, msg }); }
function inf(code, msg) { info.push({ code, msg }); }

function getLevel(mod) {
  return Array.isArray(mod.level) ? mod.level[0] : mod.level;
}

function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

// ============================================================
// VALIDATORS
// ============================================================

function validateFlashcard(items, fileName) {
  const seen = new Map();

  for (let i = 0; i < items.length; i++) {
    const card = items[i];

    // Required fields
    if (!card.front || typeof card.front !== 'string') {
      err('FC-FIELD', `${fileName}[${i}]: missing or invalid "front"`);
    }
    if (!card.back || typeof card.back !== 'string') {
      err('FC-FIELD', `${fileName}[${i}]: missing or invalid "back"`);
    }

    // front === back (cognados sin traducción)
    if (card.front && card.back &&
        card.front.trim().toLowerCase() === card.back.trim().toLowerCase()) {
      err('FC-SAME', `${fileName}[${i}]: front === back "${card.front}"`);
    }

    // Internal duplicates
    const key = card.front?.toLowerCase().trim();
    if (key && seen.has(key)) {
      err('FC-IDUP', `${fileName}: "${card.front}" duplicated at [${seen.get(key)}] and [${i}]`);
    } else if (key) {
      seen.set(key, i);
    }
  }
}

function validateQuiz(items, fileName) {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // Must have question or sentence
    if (!item.question && !item.sentence) {
      err('QZ-FIELD', `${fileName}[${i}]: missing "question" and "sentence"`);
    }

    // Must have options array
    if (!Array.isArray(item.options) || item.options.length < 2) {
      err('QZ-OPTS', `${fileName}[${i}]: missing or insufficient "options" (need ≥2)`);
      continue;
    }

    // Validate correct field
    if (item.correct === undefined || item.correct === null) {
      err('QZ-CORRECT', `${fileName}[${i}]: missing "correct" field`);
    } else if (typeof item.correct === 'number') {
      // Index-based: must be valid index
      if (item.correct < 0 || item.correct >= item.options.length) {
        err('QZ-IDX', `${fileName}[${i}]: correct index ${item.correct} out of range [0..${item.options.length - 1}]`);
      }
    } else if (typeof item.correct === 'string') {
      // String-based: must be in options
      if (!item.options.includes(item.correct)) {
        err('QZ-NOTOPT', `${fileName}[${i}]: correct "${item.correct}" not in options`);
      }
    }

    // Duplicate options
    const uniqueOpts = new Set(item.options.map(o => o.toLowerCase().trim()));
    if (uniqueOpts.size < item.options.length) {
      warn('QZ-DUPOPT', `${fileName}[${i}]: duplicate options detected`);
    }
  }
}

function validateCompletion(items, fileName) {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // Required fields
    if (!item.sentence || typeof item.sentence !== 'string') {
      err('CP-FIELD', `${fileName}[${i}]: missing or invalid "sentence"`);
      continue;
    }
    if (!item.correct || typeof item.correct !== 'string') {
      err('CP-FIELD', `${fileName}[${i}]: missing or invalid "correct"`);
    }

    // Blank marker check — CompletionComponent.tsx splits on '______'
    if (!item.sentence.includes(COMPLETION_BLANK)) {
      err('CP-BLANK', `${fileName}[${i}]: sentence missing blank marker "${COMPLETION_BLANK}"`);
    }

    // If has options, correct must be in options
    if (item.options && Array.isArray(item.options) && item.correct) {
      if (!item.options.includes(item.correct)) {
        err('CP-NOTOPT', `${fileName}[${i}]: correct "${item.correct}" not in options`);
      }
    }
  }
}

function validateSorting(items, fileName) {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (!item.word || typeof item.word !== 'string') {
      err('ST-FIELD', `${fileName}[${i}]: missing or invalid "word"`);
    }
    if (!item.category) {
      err('ST-FIELD', `${fileName}[${i}]: missing "category"`);
    }
    if (item.translation !== undefined && typeof item.translation !== 'string') {
      err('ST-FIELD', `${fileName}[${i}]: invalid "translation" (must be string)`);
    }
    if (!item.translation || !String(item.translation).trim()) {
      warn('ST-TRANS', `${fileName}[${i}]: missing Spanish "translation" for "${item.word}"`);
    }
  }

  // Check category distribution (at least 2 categories)
  const categories = [...new Set(items.map(it => it.category).filter(Boolean))];
  if (categories.length < 2) {
    warn('ST-CATS', `${fileName}: only ${categories.length} category — sorting needs ≥2`);
  }
}

function validateMatching(items, fileName) {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (!item.left || typeof item.left !== 'string') {
      err('MT-FIELD', `${fileName}[${i}]: missing or invalid "left"`);
    }
    if (!item.right || typeof item.right !== 'string') {
      err('MT-FIELD', `${fileName}[${i}]: missing or invalid "right"`);
    }

    // left === right
    if (item.left && item.right &&
        item.left.trim().toLowerCase() === item.right.trim().toLowerCase()) {
      err('MT-SAME', `${fileName}[${i}]: left === right "${item.left}"`);
    }
  }
}

function validateReading(data, fileName) {
  if (!data.title) warn('RD-TITLE', `${fileName}: missing "title"`);
  if (!data.sections || !Array.isArray(data.sections)) {
    err('RD-SECTS', `${fileName}: missing or invalid "sections" array`);
    return;
  }
  if (!data.learningObjectives || data.learningObjectives.length === 0) {
    warn('RD-OBJ', `${fileName}: missing "learningObjectives"`);
  }

  for (let i = 0; i < data.sections.length; i++) {
    const sec = data.sections[i];
    if (!sec.title) warn('RD-STITLE', `${fileName} section[${i}]: missing "title"`);
    if (!sec.content) warn('RD-SCONT', `${fileName} section[${i}]: missing "content"`);
    if (!sec.type) warn('RD-STYPE', `${fileName} section[${i}]: missing "type"`);
  }
}

/**
 * ReorderingComponent/reorderingUtils.validateReordering() compares the user's
 * word order against `words` element-by-element (case-sensitive) — so `words`
 * joined must reconstruct `sentence` (modulo case/trailing punctuation).
 */
function validateReordering(items, fileName) {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (!item.sentence || typeof item.sentence !== 'string') {
      err('RO-FIELD', `${fileName}[${i}]: missing or invalid "sentence"`);
      continue;
    }
    if (!Array.isArray(item.words) || item.words.length === 0) {
      err('RO-FIELD', `${fileName}[${i}]: missing or empty "words"`);
      continue;
    }

    const norm = (s) => s.toLowerCase().replace(/[.,!?;:]/g, '').trim();
    const target = norm(item.sentence);
    const joined = norm(item.words.join(' '));
    if (target !== joined) {
      err('RO-MISMATCH', `${fileName}[${i}]: words don't reconstruct sentence — "${item.sentence}" vs "${item.words.join(' ')}"`);
    }
  }
}

/**
 * TransformationComponent / ErrorCorrectionComponent both check user input
 * against `correct.some(c => normalizeAnswer(c) === norm)` — `correct` must be
 * a non-empty array of non-empty strings.
 */
function validateTransformation(items, fileName) {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.source || typeof item.source !== 'string') {
      err('TR-FIELD', `${fileName}[${i}]: missing or invalid "source"`);
    }
    if (!Array.isArray(item.correct) || item.correct.length === 0 || item.correct.some((c) => !c || typeof c !== 'string')) {
      err('TR-CORRECT', `${fileName}[${i}]: "correct" must be a non-empty array of non-empty strings`);
    }
  }
}

function validateErrorCorrection(items, fileName) {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.sentence || typeof item.sentence !== 'string') {
      err('EC-FIELD', `${fileName}[${i}]: missing or invalid "sentence"`);
    }
    if (!Array.isArray(item.correct) || item.correct.length === 0 || item.correct.some((c) => !c || typeof c !== 'string')) {
      err('EC-CORRECT', `${fileName}[${i}]: "correct" must be a non-empty array of non-empty strings`);
    }
  }
}

/** WordFormationComponent renders the blank via the 5-underscore marker "_____". */
const WORD_FORMATION_BLANK = '_____';

function validateWordFormation(items, fileName) {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.sentence || typeof item.sentence !== 'string') {
      err('WF-FIELD', `${fileName}[${i}]: missing or invalid "sentence"`);
      continue;
    }
    if (!item.sentence.includes(WORD_FORMATION_BLANK)) {
      err('WF-BLANK', `${fileName}[${i}]: sentence missing blank marker "${WORD_FORMATION_BLANK}"`);
    }
    if (!item.rootWord || typeof item.rootWord !== 'string') {
      err('WF-FIELD', `${fileName}[${i}]: missing or invalid "rootWord"`);
    }
    if (!item.correct || typeof item.correct !== 'string') {
      err('WF-FIELD', `${fileName}[${i}]: missing or invalid "correct"`);
    }
  }
}

/**
 * Generic exact-duplicate check within a single file, for modes with a
 * primary text key (sentence/question/source). Catches copy-paste repeats
 * regardless of mode.
 */
function validateInFileDuplicates(items, fileName) {
  const keyOf = (item) => item.sentence || item.question || item.source || item.left || item.word || item.text;
  const seen = new Map();
  for (let i = 0; i < items.length; i++) {
    const key = keyOf(items[i]);
    if (!key || typeof key !== 'string') continue;
    const norm = key.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seen.has(norm)) {
      warn('DUP-INFILE', `${fileName}: "${key}" duplicated at [${seen.get(norm)}] and [${i}]`);
    } else {
      seen.set(norm, i);
    }
  }
}

// ============================================================
// MAIN AUDIT
// ============================================================

function run() {
  const args = process.argv.slice(2);
  const onlyErrors = args.includes('--errors');
  const jsonOutput = args.includes('--json');
  const fixDry = args.includes('--fix-dry');

  // Load modules
  if (!fs.existsSync(MODULES_PATH)) {
    console.error('❌ learningModules.json not found');
    process.exit(1);
  }
  const modules = loadJSON(MODULES_PATH);
  if (!modules || !Array.isArray(modules)) {
    console.error('❌ learningModules.json is not a valid array');
    process.exit(1);
  }

  const moduleIds = new Set(modules.map(m => m.id));
  const levelStats = {};
  const allFlashcards = {}; // level -> [{front, file}]

  // ── Per-module validation ──────────────────────────────────
  for (const mod of modules) {
    const level = getLevel(mod);
    const fileName = path.basename(mod.dataPath || '');
    const filePath = path.join(ROOT, 'public', mod.dataPath || '');

    // Track stats
    if (!levelStats[level]) levelStats[level] = { modules: 0, items: 0, time: 0, modes: {} };
    levelStats[level].modules++;
    levelStats[level].time += mod.estimatedTime || 0;
    levelStats[level].modes[mod.learningMode] = (levelStats[level].modes[mod.learningMode] || 0) + 1;

    // ── Module-level checks ──
    if (!mod.id) err('MOD-ID', `Module missing "id"`);
    if (!mod.learningMode) err('MOD-MODE', `${mod.id}: missing "learningMode"`);
    if (!mod.dataPath) { err('MOD-PATH', `${mod.id}: missing "dataPath"`); continue; }
    if (!fs.existsSync(filePath)) { err('MOD-FILE', `${mod.id}: file not found "${mod.dataPath}"`); continue; }

    // Prerequisites reference valid modules
    if (mod.prerequisites) {
      for (const prereq of mod.prerequisites) {
        if (!moduleIds.has(prereq)) {
          err('MOD-PREREQ', `${mod.id}: prerequisite "${prereq}" does not exist`);
        }
      }
    }

    // Load data
    const rawData = loadJSON(filePath);
    if (rawData === null) { err('MOD-JSON', `${mod.id}: invalid JSON in ${fileName}`); continue; }

    // ── Item count & time estimate ──
    let items, count;
    if (mod.learningMode === 'reading') {
      items = rawData.sections || [];
      count = items.length;
    } else {
      items = Array.isArray(rawData) ? rawData : [];
      count = items.length;
    }
    levelStats[level].items += count;

    // Minimum threshold
    const min = MINIMUMS[mod.learningMode];
    if (min && count < min) {
      err('MIN-COUNT', `${mod.id} (${mod.learningMode}): ${count} items, minimum is ${min}`);
    }

    // Time estimate
    const formula = TIME_FORMULAS[mod.learningMode];
    if (formula) {
      const expected = formula(count);
      if (mod.estimatedTime !== expected) {
        warn('TIME-EST', `${mod.id}: estimatedTime=${mod.estimatedTime}, expected=${expected} (${count} items)`);
      }
    }

    // ── Mode-specific validation ──
    switch (mod.learningMode) {
      case 'flashcard':
        validateFlashcard(items, fileName);
        // Collect for duplicate detection
        if (!allFlashcards[level]) allFlashcards[level] = [];
        for (const card of items) {
          allFlashcards[level].push({
            front: card.front?.toLowerCase().trim(),
            file: fileName,
            level,
          });
        }
        break;
      case 'quiz':
        validateQuiz(items, fileName);
        break;
      case 'completion':
        validateCompletion(items, fileName);
        break;
      case 'sorting':
        validateSorting(items, fileName);
        break;
      case 'matching':
        validateMatching(items, fileName);
        break;
      case 'reading':
        validateReading(rawData, fileName);
        break;
      case 'reordering':
        validateReordering(items, fileName);
        break;
      case 'transformation':
        validateTransformation(items, fileName);
        break;
      case 'error-correction':
        validateErrorCorrection(items, fileName);
        break;
      case 'word-formation':
        validateWordFormation(items, fileName);
        break;
      case 'listening-quiz':
        validateQuiz(items, fileName);
        break;
      case 'listen-complete':
        validateCompletion(items, fileName);
        break;
    }

    if (mod.learningMode !== 'reading' && mod.learningMode !== 'flashcard' && mod.learningMode !== 'sorting') {
      validateInFileDuplicates(items, fileName);
    }
  }

  // ── Cross-file same-level flashcard duplicates ─────────────
  let sameLevelDups = 0;
  for (const [level, cards] of Object.entries(allFlashcards)) {
    const byFront = {};
    for (const card of cards) {
      if (!byFront[card.front]) byFront[card.front] = [];
      byFront[card.front].push(card.file);
    }
    for (const [front, files] of Object.entries(byFront)) {
      const uniqueFiles = [...new Set(files)];
      if (uniqueFiles.length > 1) {
        warn('FC-XLDUP', `[${level}] "${front}" in: ${uniqueFiles.join(', ')}`);
        sameLevelDups++;
      }
    }
  }

  // ── Cross-level flashcard duplicates ───────────────────────
  const globalFronts = {};
  for (const [level, cards] of Object.entries(allFlashcards)) {
    for (const card of cards) {
      if (!globalFronts[card.front]) globalFronts[card.front] = [];
      globalFronts[card.front].push({ level, file: card.file });
    }
  }
  let crossLevelDups = 0;
  for (const [front, occurrences] of Object.entries(globalFronts)) {
    const levels = [...new Set(occurrences.map(o => o.level))];
    if (levels.length > 1) {
      const locs = occurrences.map(o => `${o.level}/${o.file}`).join(', ');
      inf('FC-CLDUP', `"${front}" in: ${locs}`);
      crossLevelDups++;
    }
  }

  // ── Quiz question diversity ────────────────────────────────
  const globalPatterns = {};
  for (const mod of modules) {
    if (mod.learningMode !== 'quiz') continue;
    const filePath = path.join(ROOT, 'public', mod.dataPath || '');
    if (!fs.existsSync(filePath)) continue;
    const data = loadJSON(filePath);
    if (!Array.isArray(data)) continue;
    for (const item of data) {
      if (!item.question) continue;
      const normalized = item.question
        .replace(/"[^"]+"/g, '"___"')
        .replace(/'[^']+'/g, "'___'");
      const pattern = normalized.split(/\s+/).slice(0, 6).join(' ').toLowerCase();
      globalPatterns[pattern] = (globalPatterns[pattern] || 0) + 1;
    }
  }
  const repetitivePatterns = Object.entries(globalPatterns)
    .filter(([, c]) => c >= 10)
    .sort((a, b) => b[1] - a[1]);

  if (repetitivePatterns.length > 0) {
    for (const [pat, count] of repetitivePatterns) {
      inf('QZ-REPAT', `${count}x: "${pat}..."`);
    }
  }

  // ── Output ─────────────────────────────────────────────────
  if (jsonOutput) {
    const result = {
      summary: {
        modules: modules.length,
        errors: errors.length,
        warnings: warnings.length,
        info: info.length,
        sameLevelDups,
        crossLevelDups,
      },
      levelStats,
      errors,
      warnings: onlyErrors ? [] : warnings,
      info: onlyErrors ? [] : info,
    };
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('============================================================');
    console.log('📊 CONTENT VALIDATION REPORT');
    console.log('============================================================\n');

    console.log(`📦 Modules: ${modules.length}`);
    console.log(`\n📊 Level Statistics:`);
    console.log('Level | Modules | Items | Est.Time | Modes');
    console.log('------|---------|-------|----------|------');
    const totalItems = { modules: 0, items: 0, time: 0 };
    for (const [level, stats] of Object.entries(levelStats).sort()) {
      const modes = Object.entries(stats.modes).map(([m, c]) => `${m}:${c}`).join(', ');
      console.log(`${level.toUpperCase()}    | ${String(stats.modules).padStart(7)} | ${String(stats.items).padStart(5)} | ${String(stats.time).padStart(6)}m | ${modes}`);
      totalItems.modules += stats.modules;
      totalItems.items += stats.items;
      totalItems.time += stats.time;
    }
    console.log(`TOTAL | ${String(totalItems.modules).padStart(7)} | ${String(totalItems.items).padStart(5)} | ${String(totalItems.time).padStart(6)}m |`);

    if (errors.length > 0) {
      console.log(`\n❌ ERRORS (${errors.length}):`);
      for (const e of errors) console.log(`  [${e.code}] ${e.msg}`);
    }

    if (!onlyErrors && warnings.length > 0) {
      console.log(`\n⚠️  WARNINGS (${warnings.length}):`);
      for (const w of warnings) console.log(`  [${w.code}] ${w.msg}`);
    }

    if (!onlyErrors && info.length > 0) {
      console.log(`\nℹ️  INFO (${info.length}):`);
      const grouped = {};
      for (const i of info) {
        if (!grouped[i.code]) grouped[i.code] = [];
        grouped[i.code].push(i.msg);
      }
      for (const [code, msgs] of Object.entries(grouped)) {
        console.log(`  [${code}] (${msgs.length} items):`);
        for (const m of msgs.slice(0, 15)) console.log(`    ${m}`);
        if (msgs.length > 15) console.log(`    ... and ${msgs.length - 15} more`);
      }
    }

    console.log('\n============================================================');
    console.log(`RESULT: ${errors.length} errors, ${warnings.length} warnings, ${info.length} info`);
    if (errors.length === 0) {
      console.log('✅ No errors found');
    } else {
      console.log('❌ Errors found — fix before deploying');
    }
    console.log('============================================================');
  }

  process.exit(errors.length > 0 ? 1 : 0);
}

run();
