#!/usr/bin/env node

/**
 * Script de limpieza: elimina archivos temporales, logs y build artifacts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '../..');

console.log('🧹 Iniciando limpieza del proyecto...\n');

// Directorios y archivos a limpiar
const cleanupTargets = [
  // Build artifacts
  { path: 'dist', type: 'dir', description: 'Build artifacts' },
  
  // Migration backups
  { path: '.migration-backup', type: 'dir', description: 'Migration backups' },
  
  // Logs
  { path: 'npm-debug.log', type: 'file', description: 'NPM debug log' },
  { path: 'yarn-error.log', type: 'file', description: 'Yarn error log' },
  { path: 'pnpm-debug.log', type: 'file', description: 'PNPM debug log' },
  
  // Archivos temporales
  { path: '.DS_Store', type: 'file', description: 'macOS metadata' },
  { path: 'Thumbs.db', type: 'file', description: 'Windows metadata' },
  
  // Coverage
  { path: 'coverage', type: 'dir', description: 'Test coverage' },
  
  // Temp directories
  { path: '.temp', type: 'dir', description: 'Temporary files' },
  { path: '.tmp', type: 'dir', description: 'Temporary files' },
];

let cleaned = 0;
let skipped = 0;

cleanupTargets.forEach((target) => {
  const fullPath = path.join(rootDir, target.path);
  
  try {
    if (fs.existsSync(fullPath)) {
      const stats = fs.statSync(fullPath);
      
      if (target.type === 'dir' && stats.isDirectory()) {
        fs.rmSync(fullPath, { recursive: true, force: true });
        console.log(`✅ Eliminado: ${target.path} (${target.description})`);
        cleaned++;
      } else if (target.type === 'file' && stats.isFile()) {
        fs.unlinkSync(fullPath);
        console.log(`✅ Eliminado: ${target.path} (${target.description})`);
        cleaned++;
      }
    } else {
      skipped++;
    }
  } catch (error) {
    console.log(`⚠️  Error al eliminar ${target.path}: ${error.message}`);
  }
});

// Buscar y eliminar archivos .DS_Store recursivamente
function cleanDSStore(dir) {
  try {
    const files = fs.readdirSync(dir);
    
    files.forEach((file) => {
      const fullPath = path.join(dir, file);
      const stats = fs.statSync(fullPath);
      
      if (stats.isDirectory()) {
        // Ignorar node_modules y .git
        if (file !== 'node_modules' && file !== '.git') {
          cleanDSStore(fullPath);
        }
      } else if (file === '.DS_Store') {
        fs.unlinkSync(fullPath);
        console.log(`✅ Eliminado: ${fullPath.replace(rootDir, '.')}`);
        cleaned++;
      }
    });
  } catch (error) {
    // Ignorar errores de permisos
  }
}

console.log('\n🔍 Buscando archivos .DS_Store...');
cleanDSStore(rootDir);

console.log('\n═══════════════════════════════════════');
console.log('📊 RESUMEN DE LIMPIEZA');
console.log('═══════════════════════════════════════');
console.log(`✅ Archivos eliminados: ${cleaned}`);
console.log(`⏭️  Archivos no encontrados: ${skipped}`);
console.log('\n✨ Limpieza completada\n');

// Mostrar estado actual
console.log('📁 Estado del proyecto:');
try {
  const distExists = fs.existsSync(path.join(rootDir, 'dist'));
  console.log(`   dist/: ${distExists ? '❌ Existe (ejecutar build para regenerar)' : '✅ Limpio'}`);
  
  const nodeModulesExists = fs.existsSync(path.join(rootDir, 'node_modules'));
  console.log(`   node_modules/: ${nodeModulesExists ? '✅ Existe' : '❌ No existe (ejecutar npm install)'}`);
} catch (error) {
  console.log('   Error al verificar estado');
}

console.log('\n💡 Comandos útiles:');
console.log('   npm run build        - Regenerar build');
console.log('   npm install          - Reinstalar dependencias');
console.log('   npm run validate:all - Validar proyecto\n');
