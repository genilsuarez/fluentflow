#!/usr/bin/env node

/**
 * Fix: Implementar lazy loading real para reducir requests iniciales
 * 
 * PROBLEMA:
 * - 103 requests en carga inicial (todos los archivos JSON de datos)
 * - Causa: Algo está disparando fetches individuales para cada módulo
 * 
 * SOLUCIÓN:
 * 1. Verificar que useModuleData NO se llame desde ModuleCard
 * 2. Asegurar que solo se use metadata de learningModules.json
 * 3. Cargar datos completos solo al hacer click
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

console.log('🔧 FIX: Lazy Loading Real\n');

// 1. Verificar ModuleCard - NO debe llamar a useModuleData
const moduleCardPath = path.join(rootDir, 'src/components/ui/ModuleCard.tsx');
const moduleCardContent = fs.readFileSync(moduleCardPath, 'utf-8');

console.log('✅ VERIFICACIÓN ModuleCard:');
if (moduleCardContent.includes('useModuleData')) {
  console.log('❌ ERROR: ModuleCard está usando useModuleData');
  console.log('   Esto dispara fetch de datos innecesarios');
} else {
  console.log('✅ OK: ModuleCard NO usa useModuleData');
}

if (moduleCardContent.includes('useModuleProgression')) {
  console.log('✅ OK: ModuleCard usa useModuleProgression (solo metadata)');
}
console.log('');

// 2. Verificar useProgression - debe trabajar solo con metadata
const useProgressionPath = path.join(rootDir, 'src/hooks/useProgression.ts');
const useProgressionContent = fs.readFileSync(useProgressionPath, 'utf-8');

console.log('✅ VERIFICACIÓN useProgression:');
if (useProgressionContent.includes('fetchModuleData')) {
  console.log('❌ ERROR: useProgression está haciendo fetch de datos individuales');
} else {
  console.log('✅ OK: useProgression NO hace fetch de datos individuales');
}

if (useProgressionContent.includes('useAllModules')) {
  console.log('✅ OK: useProgression usa useAllModules (solo metadata)');
}
console.log('');

// 3. Buscar el culpable - ¿quién está disparando los fetches?
console.log('🔍 BUSCANDO CULPABLE:\n');

const filesToCheck = [
  'src/components/ui/ProgressionDashboard.tsx',
  'src/components/ui/ProgressionView.tsx',
  'src/components/learning/LearningMode.tsx',
  'src/App.tsx',
];

let culpritFound = false;

for (const file of filesToCheck) {
  const filePath = path.join(rootDir, file);
  if (!fs.existsSync(filePath)) continue;
  
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Buscar patrones sospechosos
  const patterns = [
    { pattern: /useModuleData\([^)]*\)/g, name: 'useModuleData calls' },
    { pattern: /fetchModuleData\([^)]*\)/g, name: 'fetchModuleData calls' },
    { pattern: /modules\.map.*useModuleData/g, name: 'map + useModuleData' },
  ];
  
  for (const { pattern, name } of patterns) {
    const matches = content.match(pattern);
    if (matches) {
      console.log(`❌ ENCONTRADO en ${file}:`);
      console.log(`   ${name}: ${matches.length} ocurrencias`);
      matches.slice(0, 3).forEach(m => console.log(`   - ${m}`));
      culpritFound = true;
    }
  }
}

if (!culpritFound) {
  console.log('✅ No se encontraron llamadas directas sospechosas');
  console.log('');
  console.log('💡 HIPÓTESIS:');
  console.log('El problema podría estar en:');
  console.log('1. TanStack Query haciendo prefetch automático');
  console.log('2. Service Worker intentando cachear todos los módulos');
  console.log('3. Algún efecto en App.tsx o componente padre');
}

console.log('');
console.log('📋 PLAN DE ACCIÓN:\n');
console.log('1. Revisar configuración de TanStack Query (staleTime, cacheTime)');
console.log('2. Verificar que NO haya prefetch automático');
console.log('3. Revisar Service Worker - podría estar cacheando proactivamente');
console.log('4. Agregar logs para identificar qué dispara los fetches');
console.log('');

console.log('✅ Análisis completado');
console.log('');
console.log('SIGUIENTE PASO: Revisar Chrome DevTools Network tab');
console.log('- Ver qué componente/hook inicia cada request');
console.log('- Buscar en "Initiator" column');
