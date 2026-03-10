#!/usr/bin/env node

/**
 * Height Calculation Checker
 * Verifies CSS variable calculations for main-menu and module-card heights
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== HEIGHT CALCULATION CHECKER ===\n');

// Read CSS files
const moduleCardPath = path.join(__dirname, '../../src/styles/components/module-card.css');
const mainMenuPath = path.join(__dirname, '../../src/styles/components/main-menu.css');

const moduleCardCSS = fs.readFileSync(moduleCardPath, 'utf8');
const mainMenuCSS = fs.readFileSync(mainMenuPath, 'utf8');

// Extract card height variables
const cardHeightMobile = moduleCardCSS.match(/--card-height-mobile:\s*(\d+)px/)?.[1];
const cardHeightTablet = moduleCardCSS.match(/--card-height-tablet:\s*(\d+)px/)?.[1];
const cardHeightDesktop = moduleCardCSS.match(/--card-height-desktop:\s*(\d+)px/)?.[1];

console.log('📏 MODULE CARD HEIGHTS:');
console.log(`  Mobile:  ${cardHeightMobile}px`);
console.log(`  Tablet:  ${cardHeightTablet}px`);
console.log(`  Desktop: ${cardHeightDesktop}px`);
console.log();

// Calculate expected main-menu heights
const gapMobile = 0.5 * 16; // 0.5rem = 8px
const gapTablet = 0.625 * 16; // 0.625rem = 10px
const gapDesktop = 0.75 * 16; // 0.75rem = 12px

const gridHeightMobile = parseInt(cardHeightMobile) * 4 + gapMobile * 3 + gapMobile;
const gridHeightTablet = parseInt(cardHeightTablet) * 4 + gapTablet * 3 + gapTablet;
const gridHeightDesktop = parseInt(cardHeightDesktop) * 4 + gapDesktop * 3 + gapDesktop;

console.log('📐 CALCULATED MAIN-MENU HEIGHTS:');
console.log(`  Mobile:  ${gridHeightMobile}px (${cardHeightMobile} * 4 + ${gapMobile * 3} + ${gapMobile})`);
console.log(`  Tablet:  ${gridHeightTablet}px (${cardHeightTablet} * 4 + ${gapTablet * 3} + ${gapTablet})`);
console.log(`  Desktop: ${gridHeightDesktop}px (${cardHeightDesktop} * 4 + ${gapDesktop * 3} + ${gapDesktop})`);
console.log();

// Check if main-menu uses CSS variables
const usesVariables = mainMenuCSS.includes('var(--card-height-mobile)');

console.log('🔗 MAIN-MENU CONFIGURATION:');
console.log(`  Uses CSS variables: ${usesVariables ? '✅ YES' : '❌ NO (hardcoded)'}`);
console.log();

if (usesVariables) {
  console.log('✅ CORRECT: main-menu will automatically update when card heights change');
} else {
  console.log('⚠️  WARNING: main-menu uses hardcoded values and needs manual updates');
}

console.log('\n=== SUMMARY ===');
console.log(`Card heights reduced by 2px from original (87→85, 97→95, 107→105)`);
console.log(`Main-menu should be ${2 * 4}px shorter (2px per card × 4 rows)`);
console.log(`Expected reduction: Mobile -8px, Tablet -8px, Desktop -8px`);
