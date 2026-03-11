/**
 * Debug script para verificar el estado del cache offline
 * Ejecutar en la consola del navegador:
 * 
 * En producción:
 * fetch('/englishgame6/debug-cache.js').then(r => r.text()).then(eval)
 * 
 * O copiar y pegar este código directamente en la consola
 */

(async function debugOfflineCache() {
  console.log('🔍 === OFFLINE CACHE DEBUG ===');
  console.log('');

  // 1. Verificar soporte de Cache API
  if (!('caches' in window)) {
    console.error('❌ Cac