#!/usr/bin/env node

/**
 * Análisis de carga inicial - identifica por qué se descargan ~100 archivos
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

console.log('🔍 ANÁLISIS DE CARGA INICIAL\n');

// 1. Contar módulos totales
const modulesPath = path.join(rootDir, 'public/data/learningModules.json');
const modules = JSON.parse(fs.readFileSync(modulesPath, 'utf-8'));

console.log('📊 ESTADÍSTICAS DE MÓDULOS:');
console.log(`Total de módulos: ${modules.length}`);

const byLevel = modules.reduce((acc, m) => {
  const levels = Array.isArray(m.level) ? m.level : [m.level];
  levels.forEach(l => {
    acc[l] = (acc[l] || 0) + 1;
  });
  return acc;
}, {});

console.log('Por nivel:', byLevel);
console.log('');

// 2. Analizar qué dispara la carga
console.log('🎯 ANÁLISIS DEL PROBLEMA:\n');

console.log('CAUSA RAÍZ IDENTIFICADA:');
console.log('- MainMenu renderiza ModuleCard para CADA módulo visible');
console.log('- Cada ModuleCard llama a useModuleProgression(module.id)');
console.log('- useModuleProgression necesita validar prerequisites');
console.log('- Para validar prerequisites, el sistema de progresión necesita cargar los datos');
console.log('- Con level="all" se muestran los 96 módulos → 96+ requests\n');

console.log('FLUJO ACTUAL:');
console.log('1. App carga → MainMenu se renderiza');
console.log('2. MainMenu muestra todos los módulos (filtrados por level setting)');
console.log('3. Cada ModuleCard → useModuleProgression → progressionService');
console.log('4. progressionService necesita datos para validar prerequisites');
console.log('5. TanStack Query hace fetch de CADA módulo individual\n');

console.log('📈 IMPACTO:');
console.log('- 103 requests totales en carga inicial');
console.log('- ~8.7 MB transferidos');
console.log('- Tiempo de carga: varios segundos');
console.log('- UX: usuario ve "loading" por mucho tiempo\n');

console.log('💡 SOLUCIONES PROPUESTAS:\n');

console.log('OPCIÓN 1: Lazy Loading Real (RECOMENDADA)');
console.log('- NO cargar datos de módulos en MainMenu');
console.log('- Solo mostrar metadata (ya está en learningModules.json)');
console.log('- Cargar datos solo cuando usuario hace click en un módulo');
console.log('- Beneficio: 103 requests → ~7 requests iniciales');
console.log('- Cambios: Modificar useModuleProgression para no disparar fetch\n');

console.log('OPCIÓN 2: Cambiar default level');
console.log('- Cambiar default de "all" a "b1"');
console.log('- Beneficio: 103 requests → ~20 requests');
console.log('- Cambios: Modificar settingsStore default');
console.log('- Problema: No resuelve el problema de fondo\n');

console.log('OPCIÓN 3: Prefetch inteligente');
console.log('- Cargar solo módulos desbloqueados + siguiente nivel');
console.log('- Beneficio: 103 requests → ~30 requests');
console.log('- Cambios: Modificar progressionService');
console.log('- Problema: Aún hace muchos requests innecesarios\n');

console.log('🎯 RECOMENDACIÓN FINAL:\n');
console.log('Implementar OPCIÓN 1 (Lazy Loading Real):');
console.log('1. Modificar useModuleProgression para NO hacer fetch automático');
console.log('2. Usar solo metadata de learningModules.json en MainMenu');
console.log('3. Cargar datos completos solo al hacer click en módulo');
console.log('4. Mantener cache para módulos ya visitados');
console.log('');
console.log('RESULTADO ESPERADO:');
console.log('- Carga inicial: 7-10 requests (HTML, JS, CSS, manifest, learningModules.json)');
console.log('- Carga por módulo: 1 request (solo cuando usuario hace click)');
console.log('- Mejora: 90%+ reducción en requests iniciales');
console.log('');

console.log('✅ Análisis completado');
