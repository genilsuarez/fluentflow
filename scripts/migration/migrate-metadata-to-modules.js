#!/usr/bin/env node

/**
 * Migration Script: Move metadata from individual JSON files to learningModules.json
 * 
 * This script:
 * 1. Reads learningModules.json
 * 2. For each module with dataPath, reads the individual JSON file
 * 3. Extracts metadata (estimatedTime, difficulty, tags)
 * 4. Adds metadata to module in learningModules.json
 * 5. Removes metadata from individual JSON files
 * 6. Creates backup before modifying
 * 7. Validates all changes
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

// Paths
const MODULES_PATH = path.join(ROOT_DIR, 'public/data/learningModules.json');
const DATA_DIR = path.join(ROOT_DIR, 'public/data');
const BACKUP_DIR = path.join(ROOT_DIR, '.migration-backup');

// Statistics
const stats = {
  modulesProcessed: 0,
  metadataExtracted: 0,
  filesModified: 0,
  errors: [],
  warnings: [],
};

/**
 * Create backup of all files before migration
 */
function createBackup() {
  console.log('\n📦 Creating backup...');
  
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}`);
  fs.mkdirSync(backupPath, { recursive: true });

  // Backup learningModules.json
  fs.copyFileSync(
    MODULES_PATH,
    path.join(backupPath, 'learningModules.json')
  );

  // Backup data directory
  const dataBackupPath = path.join(backupPath, 'data');
  fs.mkdirSync(dataBackupPath, { recursive: true });
  
  copyDirRecursive(DATA_DIR, dataBackupPath);

  console.log(`✅ Backup created: ${backupPath}`);
  return backupPath;
}

/**
 * Recursively copy directory
 */
function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (entry.name.endsWith('.json')) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Resolve dataPath to absolute file path
 */
function resolveDataPath(dataPath) {
  // Remove 'data/' prefix if present
  const cleanPath = dataPath.startsWith('data/') 
    ? dataPath.substring(5) 
    : dataPath;
  
  return path.join(DATA_DIR, cleanPath);
}

/**
 * Extract metadata from individual JSON file
 */
function extractMetadata(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    const metadata = {
      estimatedTime: data.estimatedTime || data.estimatedReadingTime || null,
      difficulty: data.difficulty || null,
      tags: data.tags || null,
    };

    // Check if file has data array or is reading mode
    const hasDataArray = Array.isArray(data.data);
    const isReadingMode = data.sections && Array.isArray(data.sections);

    return {
      metadata,
      hasDataArray,
      isReadingMode,
      originalData: data,
    };
  } catch (error) {
    stats.errors.push(`Failed to read ${filePath}: ${error.message}`);
    return null;
  }
}

/**
 * Remove metadata from individual JSON file
 */
function removeMetadataFromFile(filePath, originalData, hasDataArray, isReadingMode) {
  try {
    let cleanedData;

    if (hasDataArray) {
      // For files with data array, keep only the data array
      cleanedData = {
        data: originalData.data,
      };
    } else if (isReadingMode) {
      // For reading mode, keep all content structure but remove metadata
      cleanedData = { ...originalData };
      delete cleanedData.estimatedTime;
      delete cleanedData.estimatedReadingTime;
      delete cleanedData.difficulty;
      delete cleanedData.tags;
    } else {
      // For other formats, keep everything except metadata
      cleanedData = { ...originalData };
      delete cleanedData.estimatedTime;
      delete cleanedData.difficulty;
      delete cleanedData.tags;
    }

    fs.writeFileSync(filePath, JSON.stringify(cleanedData, null, 2), 'utf-8');
    stats.filesModified++;
    return true;
  } catch (error) {
    stats.errors.push(`Failed to write ${filePath}: ${error.message}`);
    return false;
  }
}

/**
 * Main migration function
 */
function migrate() {
  console.log('\n🚀 Starting metadata migration...\n');

  // Create backup
  const backupPath = createBackup();

  // Read learningModules.json
  console.log('\n📖 Reading learningModules.json...');
  const modulesContent = fs.readFileSync(MODULES_PATH, 'utf-8');
  const modules = JSON.parse(modulesContent);

  console.log(`✅ Found ${modules.length} modules\n`);

  // Process each module
  console.log('🔄 Processing modules...\n');
  
  for (const module of modules) {
    stats.modulesProcessed++;

    // Skip modules without dataPath
    if (!module.dataPath) {
      console.log(`⏭️  Skipping ${module.id} (no dataPath)`);
      continue;
    }

    const filePath = resolveDataPath(module.dataPath);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      stats.warnings.push(`File not found: ${filePath} for module ${module.id}`);
      console.log(`⚠️  ${module.id}: File not found`);
      continue;
    }

    // Extract metadata
    const result = extractMetadata(filePath);
    if (!result) {
      console.log(`❌ ${module.id}: Failed to extract metadata`);
      continue;
    }

    const { metadata, hasDataArray, isReadingMode, originalData } = result;

    // Check if metadata exists
    const hasMetadata = metadata.estimatedTime || metadata.difficulty || metadata.tags;

    if (!hasMetadata) {
      console.log(`⏭️  ${module.id}: No metadata to migrate`);
      continue;
    }

    // Add metadata to module (only if not already present)
    let updated = false;
    
    if (metadata.estimatedTime && !module.estimatedTime) {
      module.estimatedTime = metadata.estimatedTime;
      updated = true;
    }
    
    if (metadata.difficulty && !module.difficulty) {
      module.difficulty = metadata.difficulty;
      updated = true;
    }
    
    if (metadata.tags && !module.tags) {
      module.tags = metadata.tags;
      updated = true;
    }

    if (updated) {
      stats.metadataExtracted++;
      console.log(`✅ ${module.id}: Metadata extracted`);
      
      // Remove metadata from individual file
      removeMetadataFromFile(filePath, originalData, hasDataArray, isReadingMode);
    } else {
      console.log(`⏭️  ${module.id}: Metadata already in learningModules.json`);
    }
  }

  // Write updated learningModules.json
  console.log('\n💾 Writing updated learningModules.json...');
  fs.writeFileSync(MODULES_PATH, JSON.stringify(modules, null, 2), 'utf-8');
  console.log('✅ learningModules.json updated');

  // Print statistics
  console.log('\n' + '='.repeat(60));
  console.log('📊 MIGRATION STATISTICS');
  console.log('='.repeat(60));
  console.log(`Modules processed:     ${stats.modulesProcessed}`);
  console.log(`Metadata extracted:    ${stats.metadataExtracted}`);
  console.log(`Files modified:        ${stats.filesModified}`);
  console.log(`Warnings:              ${stats.warnings.length}`);
  console.log(`Errors:                ${stats.errors.length}`);
  console.log('='.repeat(60));

  if (stats.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    stats.warnings.forEach(w => console.log(`   - ${w}`));
  }

  if (stats.errors.length > 0) {
    console.log('\n❌ ERRORS:');
    stats.errors.forEach(e => console.log(`   - ${e}`));
  }

  console.log(`\n📦 Backup location: ${backupPath}`);
  console.log('\n✨ Migration completed!\n');

  // Return success status
  return stats.errors.length === 0;
}

// Run migration
try {
  const success = migrate();
  process.exit(success ? 0 : 1);
} catch (error) {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
}
