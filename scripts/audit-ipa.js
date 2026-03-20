import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const modules = JSON.parse(readFileSync(join(ROOT, 'public/data/learningModules.json'), 'utf-8'));

const fcModules = modules.filter(m => m.learningMode === 'flashcard');

let totalMissing = 0;
const results = [];

for (const mod of fcModules) {
  const level = Array.isArray(mod.level) ? mod.level[0] : mod.level;
  try {
    const data = JSON.parse(readFileSync(join(ROOT, 'public', mod.dataPath), 'utf-8'));
    const missing = data.filter(item => !item.ipa);
    if (missing.length > 0) {
      totalMissing += missing.length;
      results.push({
        id: mod.id,
        level: level.toUpperCase(),
        category: mod.category,
        total: data.length,
        missing: missing.length,
        pct: ((missing.length / data.length) * 100).toFixed(1),
        samples: missing.slice(0, 5).map(i => i.front)
      });
    }
  } catch {}
}

console.log(`\nFlashcards sin IPA: ${totalMissing} items en ${results.length} archivos\n`);

for (const r of results) {
  console.log(`${r.level} | ${r.category.padEnd(14)} | ${r.id}`);
  console.log(`   ${r.missing}/${r.total} sin IPA (${r.pct}%)`);
  console.log(`   Ejemplos: ${r.samples.join(', ')}`);
  console.log();
}
