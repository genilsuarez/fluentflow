/**
 * Script de diagnóstico para modo offline
 * Ejecutar en la consola del navegador cuando estés offline
 */

async function diagnosticOfflineCache() {
  console.log('=== DIAGNÓSTICO MODO OFFLINE ===\n');
  
  // 1. Verificar soporte de Cache API
  if (!('caches' in window)) {
    console.error('❌ Cache API no soportada');
    return;
  }
  console.log('✅ Cache API soportada\n');
  
  // 2. Listar todos los caches
  const cacheNames = await caches.keys();
  console.log('📦 Caches disponibles:', cacheNames);
  
  // 3. Verificar cache de datos
  const dataCache = await caches.open('fluentflow-offline-v2');
  const dataCacheKeys = await dataCache.keys();
  console.log(`\n📊 Cache de datos (${dataCacheKeys.length} archivos):`);
  
  // Agrupar por nivel
  const byLevel = {};
  dataCacheKeys.forEach(req => {
    const url = req.url;
    const match = url.match(/\/(a1|a2|b1|b2|c1|c2)\//);
    if (match) {
      const level = match[1];
      byLevel[level] = (byLevel[level] || 0) + 1;
    }
  });
  
  console.log('Por nivel:', byLevel);
  
  // 4. Mostrar primeras 10 URLs
  console.log('\n📝 Primeras 10 URLs en caché:');
  dataCacheKeys.slice(0, 10).forEach((req, i) => {
    console.log(`  ${i + 1}. ${req.url}`);
  });
  
  // 5. Verificar cache de assets
  const assetsCache = await caches.open('fluentflow-assets-v2');
  const assetsCacheKeys = await assetsCache.keys();
  console.log(`\n🎨 Cache de assets (${assetsCacheKeys.length} archivos):`);
  assetsCacheKeys.slice(0, 5).forEach((req, i) => {
    console.log(`  ${i + 1}. ${req.url}`);
  });
  
  // 6. Probar una URL específica
  console.log('\n🔍 Probando URL de ejemplo...');
  const testUrl = `${window.location.origin}/englishgame6/data/a1/a1-flashcard-basic-vocabulary.json`;
  console.log('URL a probar:', testUrl);
  
  const cached = await dataCache.match(testUrl);
  if (cached) {
    console.log('✅ URL encontrada en caché');
    const data = await cached.json();
    console.log('Datos:', data);
  } else {
    console.log('❌ URL NO encontrada en caché');
    console.log('\n🔍 Buscando URLs similares...');
    dataCacheKeys.forEach(req => {
      if (req.url.includes('a1-flashcard-basic-vocabulary')) {
        console.log('  Encontrada:', req.url);
      }
    });
  }
  
  console.log('\n=== FIN DIAGNÓSTICO ===');
}

// Ejecutar automáticamente
diagnosticOfflineCache();
