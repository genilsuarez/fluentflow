import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const modules = JSON.parse(readFileSync(join(ROOT, 'public/data/learningModules.json'), 'utf-8'));

const cpModules = modules.filter(m => m.learningMode === 'completion');
let totalItems = 0, totalWithTip = 0, totalWithout = 0;

const results = [];

for (const mod of cpModules) {
  const level = (Array.isArray(mod.level) ? mod.level[0] : mod.level).toUpperCase();
  try {
    const data = JSON.parse(readFileSync(join(ROOT, 'public', mod.dataPath), 'utf-8'));
    const withTip = data.filter(i => i.tip);
    const withoutTip = data.filter(i => !i.tip);
    totalItems += data.length;
    totalWithTip += withTip.length;
    totalWithout += withoutTip.length;

    results.push({
      level,
      id: mod.id,
      category: mod.category,
      total: data.length,
      withTip: withTip.length,
      withoutTip: withoutTip.length,
      pct: ((withTip.length / data.length) * 100).toFixed(0),
    });
  } catch {}
}

// Sort by level then by pct
results.sort((a, b) => a.level.localeCompare(b.level) || Number(a.pct) - Number(b.pct));

console.log(`\nCompletion tips: ${totalWithTip}/${totalItems} (${((totalWithTip/totalItems)*100).toFixed(1)}%)\n`);
console.log('Nivel | Categoría      | Tips    | Archivo');
console.log('──────┼────────────────┼─────────┼────────');

for (const r of results) {
  const status = r.withTip === r.total ? '✅' : r.withTip === 0 ? '❌' : '⚠️';
  console.log(`${r.level}    | ${r.category.padEnd(14)} | ${status} ${String(r.withTip).padStart(2)}/${r.total} (${r.pct.padStart(3)}%) | ${r.id}`);
}

// Summary by level
console.log('\nResumen por nivel:');
const byLevel = {};
for (const r of results) {
  if (!byLevel[r.level]) byLevel[r.level] = { total: 0, withTip: 0, files: 0, filesComplete: 0 };
  byLevel[r.level].total += r.total;
  byLevel[r.level].withTip += r.withTip;
  byLevel[r.level].files++;
  if (r.withTip === r.total) byLevel[r.level].filesComplete++;
}
for (const [lv, d] of Object.entries(byLevel)) {
  console.log(`  ${lv}: ${d.withTip}/${d.total} items con tip (${((d.withTip/d.total)*100).toFixed(0)}%), ${d.filesComplete}/${d.files} archivos completos`);
}
