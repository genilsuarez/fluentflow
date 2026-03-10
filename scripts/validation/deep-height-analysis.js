#!/usr/bin/env node

/**
 * Deep Height Analysis
 * Comprehensive analysis of all height-related CSS rules
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== DEEP HEIGHT ANALYSIS ===\n');

// Read all relevant CSS files
const cssFiles = [
  'src/styles/components/module-card.css',
  'src/styles/components/main-menu.css',
  'src/styles/components/progression-dashboard.css'
];

const cssContents = {};
cssFiles.forEach(file => {
  const fullPath = path.join(__dirname, '../..', file);
  cssContents[file] = fs.readFileSync(fullPath, 'utf8');
});

console.log('📋 STEP 1: Verify CSS Variable Definitions\n');

// Check module-card variables
const moduleCardCSS = cssContents['src/styles/components/module-card.css'];
const cardHeightMobile = moduleCardCSS.match(/--card-height-mobile:\s*(\d+)px/)?.[1];
const cardHeightTablet = moduleCardCSS.match(/--card-height-tablet:\s*(\d+)px/)?.[1];
const cardHeightDesktop = moduleCardCSS.match(/--card-height-desktop:\s*(\d+)px/)?.[1];

console.log('Module Card Variables:');
console.log(`  --card-height-mobile: ${cardHeightMobile}px`);
console.log(`  --card-height-tablet: ${cardHeightTablet}px`);
console.log(`  --card-height-desktop: ${cardHeightDesktop}px`);
console.log();

console.log('📋 STEP 2: Verify Main Menu Uses Variables\n');

const mainMenuCSS = cssContents['src/styles/components/main-menu.css'];

// Check if main-menu uses var() references
const gridHeightMobileMatch = mainMenuCSS.match(/--grid-height-mobile:\s*calc\(([^)]+)\)/);
const gridHeightTabletMatch = mainMenuCSS.match(/--grid-height-tablet:\s*calc\(([^)]+)\)/);
const gridHeightDesktopMatch = mainMenuCSS.match(/--grid-height-desktop:\s*calc\(([^)]+)\)/);

console.log('Main Menu Grid Height Calculations:');
console.log(`  --grid-height-mobile: calc(${gridHeightMobileMatch?.[1] || 'NOT FOUND'})`);
console.log(`  --grid-height-tablet: calc(${gridHeightTabletMatch?.[1] || 'NOT FOUND'})`);
console.log(`  --grid-height-desktop: calc(${gridHeightDesktopMatch?.[1] || 'NOT FOUND'})`);
console.log();

// Check if using var(--card-height-*)
const usesCardHeightMobile = gridHeightMobileMatch?.[1]?.includes('var(--card-height-mobile)');
const usesCardHeightTablet = gridHeightTabletMatch?.[1]?.includes('var(--card-height-tablet)');
const usesCardHeightDesktop = gridHeightDesktopMatch?.[1]?.includes('var(--card-height-desktop)');

console.log('Uses CSS Variables:');
console.log(`  Mobile: ${usesCardHeightMobile ? '✅ YES' : '❌ NO'}`);
console.log(`  Tablet: ${usesCardHeightTablet ? '✅ YES' : '❌ NO'}`);
console.log(`  Desktop: ${usesCardHeightDesktop ? '✅ YES' : '❌ NO'}`);
console.log();

console.log('📋 STEP 3: Check for Hardcoded Heights\n');

// Search for hardcoded px values in main-menu
const hardcodedHeights = mainMenuCSS.match(/max-height:\s*(\d+)px/g);
if (hardcodedHeights && hardcodedHeights.length > 0) {
  console.log('⚠️  WARNING: Found hardcoded max-height values:');
  hardcodedHeights.forEach(h => console.log(`  ${h}`));
  console.log();
} else {
  console.log('✅ No hardcoded max-height values found');
  console.log();
}

console.log('📋 STEP 4: Check CSS Specificity Issues\n');

// Count how many times .main-menu__grid is defined
const gridDefinitions = (mainMenuCSS.match(/\.main-menu__grid\s*\{/g) || []).length;
console.log(`Number of .main-menu__grid definitions: ${gridDefinitions}`);

// Check for !important rules
const importantRules = (mainMenuCSS.match(/max-height:[^;]+!important/g) || []).length;
console.log(`Number of !important max-height rules: ${importantRules}`);
console.log();

console.log('📋 STEP 5: Calculate Expected Heights\n');

const gapMobile = 0.5 * 16; // 0.5rem
const gapTablet = 0.625 * 16; // 0.625rem
const gapDesktop = 0.75 * 16; // 0.75rem

const expectedMobile = parseInt(cardHeightMobile) * 4 + gapMobile * 3 + gapMobile;
const expectedTablet = parseInt(cardHeightTablet) * 4 + gapTablet * 3 + gapTablet;
const expectedDesktop = parseInt(cardHeightDesktop) * 4 + gapDesktop * 3 + gapDesktop;

console.log('Expected Main Menu Heights:');
console.log(`  Mobile:  ${expectedMobile}px (${cardHeightMobile} * 4 + gaps)`);
console.log(`  Tablet:  ${expectedTablet}px (${cardHeightTablet} * 4 + gaps)`);
console.log(`  Desktop: ${expectedDesktop}px (${cardHeightDesktop} * 4 + gaps)`);
console.log();

console.log('📋 STEP 6: Check Build Output\n');

const distPath = path.join(__dirname, '../../dist/assets');
if (fs.existsSync(distPath)) {
  const cssFiles = fs.readdirSync(distPath).filter(f => f.endsWith('.css'));
  if (cssFiles.length > 0) {
    const mainCSSFile = cssFiles.find(f => f.startsWith('index-')) || cssFiles[0];
    const builtCSS = fs.readFileSync(path.join(distPath, mainCSSFile), 'utf8');
    
    // Check if variables are in build
    const hasCardHeightMobile = builtCSS.includes('--card-height-mobile:85px') || builtCSS.includes('--card-height-mobile: 85px');
    const hasCardHeightTablet = builtCSS.includes('--card-height-tablet:95px') || builtCSS.includes('--card-height-tablet: 95px');
    const hasCardHeightDesktop = builtCSS.includes('--card-height-desktop:105px') || builtCSS.includes('--card-height-desktop: 105px');
    
    console.log('Build Output Check:');
    console.log(`  --card-height-mobile: 85px ${hasCardHeightMobile ? '✅' : '❌'}`);
    console.log(`  --card-height-tablet: 95px ${hasCardHeightTablet ? '✅' : '❌'}`);
    console.log(`  --card-height-desktop: 105px ${hasCardHeightDesktop ? '✅' : '❌'}`);
    console.log();
  }
} else {
  console.log('⚠️  No dist folder found. Run npm run build first.');
  console.log();
}

console.log('📋 STEP 7: Check for CSS Order Issues\n');

// Check if :root is defined before usage
const rootIndex = mainMenuCSS.indexOf(':root');
const gridUsageIndex = mainMenuCSS.indexOf('max-height: var(--grid-height');

if (rootIndex === -1) {
  console.log('⚠️  WARNING: :root not found in main-menu.css');
  console.log('   Variables must be defined in module-card.css and imported first');
} else if (rootIndex > gridUsageIndex && gridUsageIndex !== -1) {
  console.log('⚠️  WARNING: Variables used before :root definition');
} else {
  console.log('✅ CSS variable order is correct');
}
console.log();

console.log('=== DIAGNOSIS ===\n');

if (usesCardHeightMobile && usesCardHeightTablet && usesCardHeightDesktop) {
  console.log('✅ Configuration is CORRECT');
  console.log('   Main menu uses CSS variables from module-card');
  console.log('   Changes should propagate automatically');
  console.log();
  console.log('💡 If changes are not visible:');
  console.log('   1. Clear browser cache (Cmd+Shift+R)');
  console.log('   2. Check browser DevTools > Elements > Computed styles');
  console.log('   3. Verify no inline styles override CSS');
  console.log('   4. Check if service worker is caching old CSS');
} else {
  console.log('❌ Configuration has ISSUES');
  console.log('   Main menu is NOT using CSS variables correctly');
  console.log('   Manual updates needed when card heights change');
}
