#!/usr/bin/env node

/**
 * Diagnose Heights - Analiza las alturas del CSS compilado y fuente
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

console.log('\n============================================================');
console.log('🔍 Diagnóstico de Alturas CSS');
console.log('============================================================\n');

// 1. Verificar archivos fuente
console.log('📄 Verificando archivos fuente...\n');

const moduleCardPath = path.join(rootDir, 'src/styles/components/module-card.css');
const mainMenuPath = path.join(rootDir, 'src/styles/components/main-menu.css');

if (fs.existsSync(moduleCardPath)) {
  const moduleCardContent = fs.readFileSync(moduleCardPath, 'utf-8');
  
  console.log('✅ module-card.css:');
  const heightMatches = moduleCardContent.match(/--card-height-\w+:\s*\d+px/g);
  if (heightMatches) {
    heightMatches.forEach(match => console.log(`   ${match}`));
  }
  console.log('');
}

if (fs.existsSync(mainMenuPath)) {
  const mainMenuContent = fs.readFileSync(mainMenuPath, 'utf-8');
  
  console.log('✅ main-menu.css:');
  
  // Grid heights
  const gridHeights = mainMenuContent.match(/--grid-height-\w+:\s*calc\([^)]+\)/g);
  if (gridHeights) {
    gridHeights.forEach(match => console.log(`   ${match}`));
  }
  
  // Header padding
  const headerPadding = mainMenuContent.match(/\.main-menu__header\s*\{[^}]*padding:\s*[^;]+;/s);
  if (headerPadding) {
    const paddingMatch = headerPadding[0].match(/padding:\s*([^;]+);/);
    if (paddingMatch) {
      console.log(`   header padding: ${paddingMatch[1]}`);
    }
  }
  
  // Header margin-bottom
  const headerMargin = mainMenuContent.match(/\.main-menu__header\s*\{[^}]*margin-bottom:\s*[^;]+;/s);
  if (headerMargin) {
    const marginMatch = headerMargin[0].match(/margin-bottom:\s*([^;]+);/);
    if (marginMatch) {
      console.log(`   header margin-bottom: ${marginMatch[1]}`);
    }
  }
  
  console.log('');
}

// 2. Verificar archivo compilado
console.log('📦 Verificando archivo compilado...\n');

const distDir = path.join(rootDir, 'dist/assets');
if (fs.existsSync(distDir)) {
  const files = fs.readdirSync(distDir);
  const cssFile = files.find(f => f.startsWith('index-') && f.endsWith('.css'));
  
  if (cssFile) {
    const cssPath = path.join(distDir, cssFile);
    const cssContent = fs.readFileSync(cssPath, 'utf-8');
    
    console.log(`✅ ${cssFile}:`);
    console.log(`   Tamaño: ${(fs.statSync(cssPath).size / 1024).toFixed(2)} KB`);
    
    // Buscar variables de altura en el CSS minificado
    const cardHeightMobile = cssContent.match(/--card-height-mobile:\s*\d+px/);
    const cardHeightTablet = cssContent.match(/--card-height-tablet:\s*\d+px/);
    const cardHeightDesktop = cssContent.match(/--card-height-desktop:\s*\d+px/);
    
    if (cardHeightMobile) console.log(`   ${cardHeightMobile[0]}`);
    if (cardHeightTablet) console.log(`   ${cardHeightTablet[0]}`);
    if (cardHeightDesktop) console.log(`   ${cardHeightDesktop[0]}`);
    
    console.log('');
  } else {
    console.log('⚠️  No se encontró archivo CSS compilado');
    console.log('   Ejecuta: npm run build\n');
  }
} else {
  console.log('⚠️  Directorio dist/ no existe');
  console.log('   Ejecuta: npm run build\n');
}

// 3. Calcular alturas esperadas
console.log('📐 Cálculo de alturas esperadas:\n');

const calculations = {
  mobile: {
    cardHeight: 87,
    rows: 4,
    gap: 8, // 0.5rem
    gapCount: 3,
    padding: 8, // 0.5rem
    total: 0
  },
  tablet: {
    cardHeight: 97,
    rows: 4,
    gap: 10, // 0.625rem
    gapCount: 3,
    padding: 10, // 0.625rem
    total: 0
  },
  desktop: {
    cardHeight: 107,
    rows: 4,
    gap: 12, // 0.75rem
    gapCount: 3,
    padding: 12, // 0.75rem
    total: 0
  }
};

Object.keys(calculations).forEach(key => {
  const calc = calculations[key];
  calc.total = (calc.cardHeight * calc.rows) + (calc.gap * calc.gapCount) + calc.padding;
  
  console.log(`${key.toUpperCase()}:`);
  console.log(`   Altura tarjeta: ${calc.cardHeight}px`);
  console.log(`   Filas: ${calc.rows}`);
  console.log(`   Gap: ${calc.gap}px × ${calc.gapCount}`);
  console.log(`   Padding: ${calc.padding}px`);
  console.log(`   TOTAL GRID: ${calc.total}px`);
  console.log('');
});

// 4. Verificar header
console.log('📏 Header dimensions:\n');
console.log('   Padding: 0.375rem 0.5rem (6px 8px)');
console.log('   Margin-bottom: 0.125rem (2px)');
console.log('   Border: 1px');
console.log('   TOTAL HEADER: ~50-60px (aprox)\n');

// 5. Resumen
console.log('============================================================');
console.log('📊 RESUMEN');
console.log('============================================================\n');

console.log('Cambios aplicados:');
console.log('  ✓ Tarjetas reducidas: 88→87px, 98→97px, 108→107px');
console.log('  ✓ Header padding: 0.5rem → 0.375rem 0.5rem (-4px vertical)');
console.log('  ✓ Header margin-bottom: 0.5rem → 0.125rem (-6px)');
console.log('  ✓ Reducción total estimada: ~14px\n');

console.log('Para ver cambios en el navegador:');
console.log('  1. Hard refresh: Ctrl+Shift+R (Win) / Cmd+Shift+R (Mac)');
console.log('  2. O desplegar: npm run build:full\n');

console.log('============================================================\n');
