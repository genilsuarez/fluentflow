#!/usr/bin/env node

/**
 * Diagnóstico: Problema de sincronización entre hash y estado
 * 
 * SÍNTOMA: URL muestra #/learn/module-id pero la vista muestra el menú
 * CAUSA PROBABLE: Condición de carrera o problema de timing
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

console.log('🔍 DIAGNÓSTICO: Hash Sync Issue\n');

// Leer App.tsx
const appPath = path.join(rootDir, 'src/App.tsx');
const appContent = fs.readFileSync(appPath, 'utf-8');

console.log('📋 ANÁLISIS DEL PROBLEMA:\n');

console.log('SÍNTOMA REPORTADO:');
console.log('- URL: #/learn/flashcard-basic-vocabulary-a1');
console.log('- Vista mostrada: Progress (menú de progresión)');
console.log('- Vista esperada: Flashcard (contenido del módulo)');
console.log('');

console.log('POSIBLES CAUSAS:\n');

console.log('1. CONDICIÓN DE CARRERA:');
console.log('   - handleHashChange se ejecuta ANTES de que fetchModules complete');
console.log('   - El módulo no se encuentra en la primera ejecución');
console.log('   - La vista se queda en "menu" por defecto');
console.log('');

console.log('2. PROBLEMA DE TIMING:');
console.log('   - useEffect se ejecuta pero el estado no se actualiza a tiempo');
console.log('   - React renderiza antes de que setCurrentView se aplique');
console.log('');

console.log('3. CACHE ISSUE:');
console.log('   - fetchModules devuelve datos corruptos o vacíos');
console.log('   - module.find() no encuentra el módulo');
console.log('   - No se llama a setCurrentModule/setCurrentView');
console.log('');

console.log('4. PROBLEMA EN APPROUTER:');
console.log('   - AppRouter no está respetando currentView');
console.log('   - Renderiza ProgressionDashboard en lugar del LearningMode');
console.log('');

// Buscar el código relevante
const hashChangeMatch = appContent.match(/const handleHashChange = async \(\) => \{[\s\S]*?\};/);
if (hashChangeMatch) {
  console.log('✅ handleHashChange encontrado');
  
  // Verificar si hay manejo de errores
  if (!hashChangeMatch[0].includes('catch')) {
    console.log('⚠️  NO HAY MANEJO DE ERRORES en handleHashChange');
    console.log('   Si fetchModules falla, el error se pierde silenciosamente');
  }
  
  // Verificar si hay logging
  if (!hashChangeMatch[0].includes('console.log') && !hashChangeMatch[0].includes('logDebug')) {
    console.log('⚠️  NO HAY LOGGING en handleHashChange');
    console.log('   Difícil debuggear qué está pasando');
  }
}

console.log('');
console.log('🔧 SOLUCIÓN PROPUESTA:\n');

console.log('1. Agregar manejo de errores y logging:');
console.log('   - Catch errors en fetchModules');
console.log('   - Log cuando módulo no se encuentra');
console.log('   - Log cuando se actualiza el estado');
console.log('');

console.log('2. Agregar validación:');
console.log('   - Verificar que response.data existe');
console.log('   - Verificar que module existe antes de setCurrentModule');
console.log('   - Fallback a menu si algo falla');
console.log('');

console.log('3. Mejorar sincronización:');
console.log('   - Usar await correctamente');
console.log('   - Asegurar que setCurrentView se llama DESPUÉS de setCurrentModule');
console.log('   - Considerar usar useLayoutEffect en lugar de useEffect');
console.log('');

console.log('📝 CÓDIGO SUGERIDO:\n');
console.log(`
const handleHashChange = async () => {
  const hash = window.location.hash;
  console.log('[App] Hash changed:', hash);

  if (hash.startsWith('#/learn/')) {
    const moduleId = hash.replace('#/learn/', '');
    console.log('[App] Loading module:', moduleId);

    const { currentModule, currentView } = useAppStore.getState();

    if (currentModule?.id === moduleId && currentView !== 'menu') {
      console.log('[App] Module already loaded, skipping');
      return;
    }

    try {
      const { fetchModules } = await import('./services/api');
      const response = await fetchModules();

      if (!response.success || !response.data) {
        console.error('[App] Failed to fetch modules:', response.error);
        // Fallback to menu
        const { setCurrentView, setCurrentModule } = useAppStore.getState();
        setCurrentModule(null);
        setCurrentView('menu');
        return;
      }

      const module = response.data.find(m => m.id === moduleId);
      
      if (!module) {
        console.error('[App] Module not found:', moduleId);
        // Fallback to menu
        const { setCurrentView, setCurrentModule } = useAppStore.getState();
        setCurrentModule(null);
        setCurrentView('menu');
        return;
      }

      console.log('[App] Module found:', module.name, 'mode:', module.learningMode);
      const { setCurrentModule, setCurrentView } = useAppStore.getState();
      setCurrentModule(module);
      setCurrentView(module.learningMode);
      console.log('[App] State updated');
    } catch (error) {
      console.error('[App] Error in handleHashChange:', error);
      // Fallback to menu
      const { setCurrentView, setCurrentModule } = useAppStore.getState();
      setCurrentModule(null);
      setCurrentView('menu');
    }
  } else if (hash === '' || hash === '#/' || hash === '#/menu') {
    console.log('[App] Navigating to menu');
    const { setCurrentView, setCurrentModule } = useAppStore.getState();
    setCurrentModule(null);
    setCurrentView('menu');
  }
};
`);

console.log('✅ Diagnóstico completado');
