import { readFileSync, writeFileSync } from 'fs';

const modulesPath = 'public/data/learningModules.json';
const modules = JSON.parse(readFileSync(modulesPath, 'utf-8'));

console.log('═══════════════════════════════════════════════════════');
console.log('🔧 LIMPIANDO DUPLICADOS EN C2');
console.log('═══════════════════════════════════════════════════════\n');

console.log(`📊 Estado actual: ${modules.length} módulos\n`);

// Encontrar duplicados
const seen = new Set();
const duplicates = [];
const unique = [];

modules.forEach((module, idx) => {
  if (seen.has(module.id)) {
    duplicates.push({ id: module.id, idx });
  } else {
    seen.add(module.id);
    unique.push(module);
  }
});

if (duplicates.length > 0) {
  console.log(`⚠️  Encontrados ${duplicates.length} duplicados:\n`);
  duplicates.forEach(dup => {
    console.log(`   • ${dup.id} (índice ${dup.idx})`);
  });
  
  // Guardar versión limpia
  writeFileSync(modulesPath, JSON.stringify(unique, null, 2), 'utf-8');
  
  console.log(`\n✅ Duplicados eliminados: ${unique.length} módulos únicos\n`);
} else {
  console.log('✅ No se encontraron duplicados\n');
}

// Actualizar prerequisites
unique.forEach((module, idx) => {
  if (idx > 0) {
    module.prerequisites = [unique[idx - 1].id];
  }
});

writeFileSync(modulesPath, JSON.stringify(unique, null, 2), 'utf-8');

// Análisis final
const byLevel = {};
unique.forEach(m => {
  const level = Array.isArray(m.level) ? m.level[0] : m.level;
  byLevel[level] = (byLevel[level] || 0) + 1;
});

console.log('═══════════════════════════════════════════════════════');
console.log('📊 DISTRIBUCIÓN FINAL');
console.log('═══════════════════════════════════════════════════════\n');

['a1', 'a2', 'b1', 'b2', 'c1', 'c2'].forEach(level => {
  console.log(`${level.toUpperCase()}: ${byLevel[level]} módulos`);
});

console.log(`\n✅ Total: ${unique.length} módulos\n`);
console.log('═══════════════════════════════════════════════════════\n');
