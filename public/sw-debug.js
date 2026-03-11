/**
 * Script de diagnóstico completo para Service Worker
 * Ejecutar en consola: const script = document.createElement('script'); script.src = '/englishgame6/sw-debug.js'; document.head.appendChild(script);
 */

(async function swDebug() {
  console.log('=== SERVICE WORKER DEBUG ===\n');
  
  // 1. Verificar soporte
  if (!('serviceWorker' in navigator)) {
    console.error('❌ Service Worker no soportado');
    return;
  }
  console.log('✅ Service Worker soportado\n');
  
  // 2. Estado actual
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) {
    console.error('❌ No hay Service Worker registrado');
    console.log('Registrando SW...');
    try {
      const newReg = await navigator.serviceWorker.register('/englishgame6/sw.js', { scope: '/englishgame6/' });
      console.log('✅ SW registrado:', newReg.scope);
    } catch (error) {
      console.error('❌ Error registrando SW:', error);
    }
    return;
  }
  
  console.log('📋 Service Worker Registration:');
  console.log('  Scope:', reg.scope);
  console.log('  Active:', reg.active?.state);
  console.log('  Waiting:', reg.waiting?.state);
  console.log('  Installing:', reg.installing?.state);
  console.log('  Script URL:', reg.active?.scriptURL);
  
  // 3. Verificar versión del SW en el servidor
  console.log('\n🔍 Verificando versión en servidor...');
  try {
    const response = await fetch('/englishgame6/sw.js');
    const text = await response.text();
    const cacheNameMatch = text.match(/CACHE_NAME = '([^']+)'/);
    const assetsCacheMatch = text.match(/ASSETS_CACHE = '([^']+)'/);
    console.log('  CACHE_NAME:', cacheNameMatch ? cacheNameMatch[1] : 'not found');
    console.log('  ASSETS_CACHE:', assetsCacheMatch ? assetsCacheMatch[1] : 'not found');
  } catch (error) {
    console.error('  ❌ Error fetching sw.js:', error);
  }
  
  // 4. Verificar caches disponibles
  console.log('\n📦 Caches disponibles:');
  const cacheNames = await caches.keys();
  cacheNames.forEach(name => console.log('  -', name));
  
  // 5. Verificar interceptación
  console.log('\n🎯 Test de interceptación:');
  console.log('  Haciendo fetch de prueba...');
  
  const testUrl = `${window.location.origin}/englishgame6/data/learningModules.json`;
  console.log('  URL:', testUrl);
  
  try {
    const startTime = performance.now();
    const response = await fetch(testUrl);
    const endTime = performance.now();
    
    console.log('  ✅ Fetch exitoso');
    console.log('  Status:', response.status);
    console.log('  Type:', response.type);
    console.log('  Time:', Math.round(endTime - startTime), 'ms');
    console.log('  Headers:', [...response.headers.entries()]);
  } catch (error) {
    console.error('  ❌ Fetch falló:', error);
  }
  
  // 6. Forzar actualización
  console.log('\n🔄 Forzando actualización del SW...');
  try {
    await reg.update();
    console.log('  ✅ Update triggered');
    console.log('  Espera 2 segundos y recarga la página');
  } catch (error) {
    console.error('  ❌ Error en update:', error);
  }
  
  // 7. Instrucciones
  console.log('\n📝 INSTRUCCIONES:');
  console.log('1. Si ves "Waiting: activated", el SW está funcionando');
  console.log('2. Si CACHE_NAME no es "fluentflow-offline-v4", ejecuta:');
  console.log('   navigator.serviceWorker.getRegistration().then(r => r.unregister()).then(() => location.reload())');
  console.log('3. Después de recargar, vuelve a ejecutar este script');
  console.log('4. Si todo está OK, prueba modo offline');
  
  console.log('\n=== FIN DEBUG ===');
})();
