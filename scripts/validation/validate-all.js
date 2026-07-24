#!/usr/bin/env node

/**
 * Script maestro de validación - ejecuta todas las verificaciones
 * 
 * Modos:
 *   (sin args)    Ejecuta validaciones base (data-paths + BEM)
 *   --full        Ejecuta validaciones base + 4 análisis profundos
 */

import { logHeader, logInfo, logSuccess, logError } from '../utils/logger.js';
import { checkAllLinks } from './validate-data-paths.js';
import { validateBEMCompliance } from './validate-bem.js';

const FULL_MODE = process.argv.includes('--full');

async function runAnalysisScript(scriptPath, name) {
  const { execSync } = await import('child_process');
  const { dirname } = await import('path');
  const { fileURLToPath } = await import('url');
  const rootDir = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

  try {
    const output = execSync(`node ${scriptPath}`, {
      cwd: rootDir,
      encoding: 'utf-8',
      stdio: 'pipe',
    });

    // Check for ❌ in output (indicates failures)
    const hasErrors = output.includes('❌');
    if (!hasErrors) {
      const warnings = (output.match(/⚠️/g) || []).length;
      if (warnings > 0) {
        logInfo(`${name}: ✅ (${warnings} warning${warnings > 1 ? 's' : ''})`);
      } else {
        logSuccess(`${name}: ✅`);
      }
    } else {
      logError(`${name}: ❌`);
      console.log(output);
    }
    return !hasErrors;
  } catch (e) {
    logError(`${name}: ❌ (exit code ${e.status})`);
    if (e.stdout) console.log(e.stdout);
    return false;
  }
}

async function main() {
  logHeader('🔍 VALIDACIÓN COMPLETA' + (FULL_MODE ? ' + ANÁLISIS PROFUNDO' : ''));

  const results = [];

  // 1. Links y rutas de datos
  logInfo('Paso 1: Verificando datos y rutas...');
  try {
    const passed = await checkAllLinks();
    results.push({ name: 'Data Paths', ok: passed });
  } catch (e) {
    logError(`Data paths: ${e.message}`);
    results.push({ name: 'Data Paths', ok: false });
  }

  // 2. BEM compliance
  logInfo('Paso 2: Verificando BEM compliance...');
  try {
    const passed = validateBEMCompliance();
    results.push({ name: 'BEM', ok: passed });
  } catch (e) {
    logError(`BEM: ${e.message}`);
    results.push({ name: 'BEM', ok: false });
  }

  // 3. Breakpoint canonical tiers
  logInfo('Paso 3: Verificando breakpoints canónicos...');
  try {
    const ok = await runAnalysisScript('scripts/validation/check-breakpoints.js', 'Breakpoints');
    results.push({ name: 'Breakpoints', ok });
  } catch (e) {
    logError(`Breakpoints: ${e.message}`);
    results.push({ name: 'Breakpoints', ok: false });
  }

  // 4. Análisis profundos (solo con --full)
  if (FULL_MODE) {
    logInfo('Paso 4: Análisis profundos...');

    const analyses = [
      { script: 'scripts/validation/analyze-unused.js', name: 'Analyze Unused (17 pasadas)' },
      { script: 'scripts/validation/deep-analysis.js', name: 'Deep Analysis (DA+DB+DC, 30 pasadas)' },
    ];

    for (const { script, name } of analyses) {
      const ok = await runAnalysisScript(script, name);
      results.push({ name, ok });
    }
  }

  // Resumen
  const failed = results.filter(r => !r.ok);
  if (failed.length > 0) {
    logError(`${failed.length} validación(es) fallaron: ${failed.map(r => r.name).join(', ')}`);
    process.exit(1);
  } else {
    logSuccess(`Todas las validaciones pasaron (${results.length} checks)`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as validateAll };
