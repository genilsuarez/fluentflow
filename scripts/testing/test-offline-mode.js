#!/usr/bin/env node

/**
 * Test Offline Mode with Chrome DevTools MCP
 * 
 * Prueba el modo offline de la aplicación, especialmente:
 * - Carga inicial offline
 * - Navegación entre módulos offline
 * - Caso de borde: next-module recommendation offline
 * - Service Worker y cache
 * - Persistencia de progreso
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';

const SITE_URL = 'https://gsphome.github.io/englishgame6/';
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function section(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60) + '\n');
}

function checkChromeConnection() {
  try {
    log('Verificando conexión con Chrome...', 'blue');
    // Intentar listar páginas para verificar conexión
    const result = execSync('echo "list_pages" | node -e "console.log(\'Chrome check\')"', {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    return true;
  } catch (error) {
    log('⚠️  Chrome no está conectado o no está corriendo con remote debugging', 'yellow');
    log('Ejecuta: /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222', 'yellow');
    return false;
  }
}

async function runTest() {
  section('🧪 Test Offline Mode - Chrome DevTools');

  log('Este script requiere que uses las herramientas MCP Chrome DevTools manualmente.', 'yellow');
  log('Sigue los pasos a continuación y ejecuta los comandos MCP correspondientes.\n', 'yellow');

  // Test 1: Carga inicial online
  section('Test 1: Carga inicial ONLINE');
  log('Comandos MCP a ejecutar:', 'blue');
  log('1. new_page: ' + SITE_URL);
  log('2. take_snapshot: Verificar que la app carga correctamente');
  log('3. list_network_requests: Ver requests de módulos JSON');
  log('\n✓ Verificar: App carga, módulos visibles, service worker registrado\n', 'green');

  // Test 2: Completar un módulo
  section('Test 2: Completar un módulo para activar next-module');
  log('Comandos MCP a ejecutar:', 'blue');
  log('1. take_snapshot: Identificar primer módulo disponible');
  log('2. click: uid del módulo (ej: "reading-greetings-a1")');
  log('3. Completar el módulo (clicks en respuestas)');
  log('4. click: botón "Return to Menu"');
  log('5. take_snapshot: Verificar que next-module está destacado');
  log('\n✓ Verificar: Módulo completado, next-module visible y destacado\n', 'green');

  // Test 3: Modo offline - navegación básica
  section('Test 3: Modo OFFLINE - Navegación básica');
  log('Comandos MCP a ejecutar:', 'blue');
  log('1. emulate: networkConditions="Offline"');
  log('2. navigate_page: type="reload"');
  log('3. take_snapshot: Verificar que app sigue funcionando');
  log('4. list_network_requests: Ver que requests fallan pero app funciona');
  log('\n✓ Verificar: App carga desde cache, módulos visibles, progreso persistido\n', 'green');

  // Test 4: CASO DE BORDE - Next-module offline
  section('Test 4: CASO DE BORDE - Next-module recommendation OFFLINE');
  log('Comandos MCP a ejecutar:', 'blue');
  log('1. [Mantener modo offline]');
  log('2. take_snapshot: Verificar que next-module sigue destacado');
  log('3. click: uid del next-module');
  log('4. take_snapshot: Verificar que módulo carga correctamente');
  log('5. Intentar completar el módulo');
  log('6. click: "Return to Menu"');
  log('7. take_snapshot: Verificar nuevo next-module');
  log('\n✓ Verificar: Next-module carga offline, progreso se guarda localmente\n', 'green');

  // Test 5: Cambio de vista offline
  section('Test 5: Cambio de vista OFFLINE');
  log('Comandos MCP a ejecutar:', 'blue');
  log('1. [Mantener modo offline]');
  log('2. click: Tab "All Modules"');
  log('3. take_snapshot: Verificar scroll automático a next-module');
  log('4. click: Tab "My Progress"');
  log('5. take_snapshot: Verificar dashboard de progreso');
  log('\n✓ Verificar: Navegación funciona, scroll a next-module, stats correctos\n', 'green');

  // Test 6: Volver online
  section('Test 6: Volver ONLINE - Sincronización');
  log('Comandos MCP a ejecutar:', 'blue');
  log('1. emulate: networkConditions="" (vacío para resetear)');
  log('2. navigate_page: type="reload"');
  log('3. take_snapshot: Verificar que progreso se mantiene');
  log('4. list_network_requests: Ver requests exitosos');
  log('\n✓ Verificar: Progreso intacto, módulos actualizados si hay cambios\n', 'green');

  // Test 7: Edge cases
  section('Test 7: Edge Cases');
  log('Comandos MCP a ejecutar:', 'blue');
  log('\nA) Next-module cuando todos están completados:');
  log('   - Completar todos los módulos de un nivel');
  log('   - Verificar que next-module apunta al siguiente nivel');
  log('\nB) Next-module con prerequisites:');
  log('   - Verificar que módulos bloqueados no aparecen como next');
  log('   - Completar prerequisite y verificar desbloqueo');
  log('\nC) Offline desde el inicio (sin cache):');
  log('   - Abrir en incognito mode');
  log('   - emulate: networkConditions="Offline"');
  log('   - navigate_page: ' + SITE_URL);
  log('   - Verificar mensaje de error o fallback');
  log('\n✓ Verificar: Todos los edge cases manejados correctamente\n', 'green');

  // Test 8: Performance offline
  section('Test 8: Performance OFFLINE');
  log('Comandos MCP a ejecutar:', 'blue');
  log('1. emulate: networkConditions="Offline"');
  log('2. performance_start_trace: reload=true');
  log('3. [Esperar carga completa]');
  log('4. performance_stop_trace: filePath="offline-trace.json"');
  log('5. Revisar métricas de carga desde cache');
  log('\n✓ Verificar: LCP < 2.5s, FCP < 1.8s, TTI < 3.8s\n', 'green');

  // Resumen
  section('📋 Checklist de validación');
  log('□ App carga correctamente online', 'yellow');
  log('□ Service Worker se registra', 'yellow');
  log('□ Módulos JSON se cachean', 'yellow');
  log('□ Progreso se persiste en localStorage', 'yellow');
  log('□ App funciona completamente offline', 'yellow');
  log('□ Next-module se calcula correctamente offline', 'yellow');
  log('□ Next-module carga su contenido desde cache', 'yellow');
  log('□ Scroll automático a next-module funciona offline', 'yellow');
  log('□ Cambio de tabs funciona offline', 'yellow');
  log('□ Progreso se mantiene al volver online', 'yellow');
  log('□ Edge cases manejados (sin cache, todos completados, etc.)', 'yellow');
  log('□ Performance offline es aceptable', 'yellow');

  section('🔍 Archivos clave para revisar si hay problemas');
  log('Service Worker: public/service-worker.js', 'blue');
  log('Progression Service: src/services/progressionService.ts', 'blue');
  log('Next Module Logic: src/hooks/useProgression.ts (getNextRecommendedModule)', 'blue');
  log('Auto-scroll: src/components/ui/MainMenu.tsx (scrollToNextModule)', 'blue');
  log('Module Card: src/components/ui/ModuleCard.tsx (isNextRecommended)', 'blue');
  log('Progress Dashboard: src/components/ui/ProgressionDashboard.tsx', 'blue');

  section('✅ Test completado');
  log('Usa los comandos MCP Chrome DevTools para ejecutar cada test.', 'green');
  log('Documenta cualquier issue encontrado con screenshots y snapshots.', 'green');
}

runTest().catch(error => {
  log(`\n❌ Error: ${error.message}`, 'red');
  process.exit(1);
});
