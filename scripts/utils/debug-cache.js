/**
 * Debug script para inspeccionar Cache API desde consola del navegador
 * 
 * Uso:
 * 1. Abrir DevTools en el navegador
 * 2. Copiar y pegar este código en la consola
 * 3. Ver qué URLs están cacheadas
 */

async function debugCache() {
  const CACHE_NAME = 'fluentflow-offline-v1';
  
  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    
    console.log(`📦 Cache: ${CACHE_NAME}`);
    console.log(`📊 Total entries: ${keys.length}`);
    console.log('\n🔍 Cached URLs:');
    
    keys.forEach((request, index) => {
      console.log(`${index + 1}. ${request.url}`);
    });
    
    // Probar match con diferentes variantes
    console.log('\n🧪 Testing URL matching:');
    
    const testUrls = [
      '/englishgame6/data/learningModules.json',
      'https://gsphome.github.io/englishgame6/data/learningModules.json',
      window.location.origin + '/englishgame6/data/learningModules.json'
    ];
    
    for (const url of testUrls) {
      const match = await cache.match(url);
      console.log(`${match ? '✅' : '❌'} ${url}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugCache();
