#!/usr/bin/env node

/**
 * Smart Commit - AI-powered commit message generator
 * 
 * Analyzes git changes and generates intelligent commit messages
 * Usage: node scripts/git/smart-commit.js [options]
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { colors, log, logHeader, logSuccess, logError, logWarning, logInfo } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = dirname(dirname(__dirname));

// Git utilities
function getGitStatus() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8', cwd: rootDir });
    return status.trim().split('\n').filter(line => line.trim());
  } catch (error) {
    throw new Error('Not a git repository or git not available');
  }
}

function getGitDiff() {
  try {
    const diff = execSync('git diff --cached --name-status', { encoding: 'utf8', cwd: rootDir });
    return diff.trim().split('\n').filter(line => line.trim());
  } catch (error) {
    return [];
  }
}

function getGitDiffStats() {
  try {
    const stats = execSync('git diff --cached --stat', { encoding: 'utf8', cwd: rootDir });
    return stats.trim();
  } catch (error) {
    return '';
  }
}

function getGitDiffContent() {
  try {
    const diff = execSync('git diff --cached', { encoding: 'utf8', cwd: rootDir });
    return diff;
  } catch (error) {
    return '';
  }
}

// File analysis
function analyzeChanges(statusLines, diffLines) {
  const analysis = {
    added: [],
    modified: [],
    deleted: [],
    renamed: [],
    categories: new Set(),
    scope: new Set(),
    breaking: false,
    fileTypes: new Set()
  };

  statusLines.forEach(line => {
    const status = line.substring(0, 2);
    const file = line.substring(3);

    // Determine change type
    if (status.includes('A')) analysis.added.push(file);
    if (status.includes('M')) analysis.modified.push(file);
    if (status.includes('D')) analysis.deleted.push(file);
    if (status.includes('R')) analysis.renamed.push(file);

    // Determine file type
    const ext = file.split('.').pop();
    if (ext) analysis.fileTypes.add(ext);

    // Determine category and scope
    if (file.startsWith('src/')) {
      analysis.categories.add('feat');
      if (file.includes('component')) analysis.scope.add('components');
      if (file.includes('hook')) analysis.scope.add('hooks');
      if (file.includes('util')) analysis.scope.add('utils');
      if (file.includes('service')) analysis.scope.add('services');
      if (file.includes('store')) analysis.scope.add('store');
      if (file.includes('type')) analysis.scope.add('types');
    }

    if (file.startsWith('tests/') || file.includes('.test.') || file.includes('.spec.')) {
      analysis.categories.add('test');
      analysis.scope.add('tests');
    }

    if (file.startsWith('.github/workflows/')) {
      analysis.categories.add('ci');
      analysis.scope.add('workflows');
    }

    if (file.startsWith('scripts/')) {
      analysis.categories.add('build');
      analysis.scope.add('scripts');
    }

    if (file === 'package.json' || file === 'package-lock.json') {
      analysis.categories.add('build');
      analysis.scope.add('deps');
    }

    if (file.startsWith('config/') || file.includes('.config.')) {
      analysis.categories.add('build');
      analysis.scope.add('config');
    }

    if (file.includes('README') || file.includes('.md')) {
      analysis.categories.add('docs');
      analysis.scope.add('docs');
    }

    if (file.includes('style') || file.includes('.css') || file.includes('.scss')) {
      analysis.categories.add('style');
      analysis.scope.add('styles');
    }
  });

  return analysis;
}

// AI-powered commit message generation
function generateCommitMessage(analysis, diffContent) {
  const { added, modified, deleted, renamed, categories, scope, fileTypes } = analysis;

  // Determine primary type
  let type = 'feat'; // default
  if (categories.has('test') && categories.size === 1) type = 'test';
  if (categories.has('docs') && categories.size === 1) type = 'docs';
  if (categories.has('style') && categories.size === 1) type = 'style';
  if (categories.has('ci') && categories.size === 1) type = 'ci';
  if (categories.has('build') && categories.size === 1) type = 'build';
  if (modified.length > 0 && added.length === 0 && deleted.length === 0) {
    if (categories.has('feat')) type = 'feat';
    else type = 'fix';
  }
  if (deleted.length > 0) type = 'refactor';

  // Determine scope
  let scopeStr = '';
  if (scope.size === 1) {
    scopeStr = `(${Array.from(scope)[0]})`;
  } else if (scope.size > 1) {
    const mainScope = Array.from(scope).sort()[0];
    scopeStr = `(${mainScope})`;
  }

  // Generate description based on changes
  let description = '';

  if (added.length > 0 && modified.length === 0 && deleted.length === 0) {
    // Pure addition
    if (added.length === 1) {
      const file = added[0];
      if (file.includes('component')) description = `add ${file.split('/').pop().replace('.tsx', '').replace('.ts', '')} component`;
      else if (file.includes('hook')) description = `add ${file.split('/').pop().replace('.ts', '')} hook`;
      else if (file.includes('util')) description = `add ${file.split('/').pop().replace('.ts', '')} utility`;
      else if (file.includes('test')) description = `add tests for ${file.split('/').pop().replace('.test.', '').replace('.spec.', '')}`;
      else if (file.includes('README')) description = 'add documentation';
      else if (file.includes('workflow')) description = `add ${file.split('/').pop().replace('.yml', '')} workflow`;
      else description = `add ${file.split('/').pop()}`;
    } else {
      description = `add ${added.length} new files`;
      if (fileTypes.has('tsx') || fileTypes.has('ts')) description += ' (TypeScript)';
      if (fileTypes.has('test')) description += ' with tests';
    }
  } else if (modified.length > 0 && added.length === 0 && deleted.length === 0) {
    // Pure modification
    if (modified.length === 1) {
      const file = modified[0];
      if (file === 'package.json') description = 'update dependencies';
      else if (file.includes('README')) description = 'update documentation';
      else if (file.includes('workflow')) description = `update ${file.split('/').pop().replace('.yml', '')} workflow`;
      else if (file.includes('component')) description = `update ${file.split('/').pop().replace('.tsx', '').replace('.ts', '')} component`;
      else if (file.includes('config')) description = 'update configuration';
      else description = `update ${file.split('/').pop()}`;
    } else {
      description = `update ${modified.length} files`;
      if (scope.has('components')) description = 'update components';
      else if (scope.has('workflows')) description = 'update CI/CD workflows';
      else if (scope.has('config')) description = 'update configuration';
      else if (scope.has('tests')) description = 'update tests';
    }
  } else if (deleted.length > 0) {
    // Deletions involved
    if (deleted.length === 1 && added.length === 0 && modified.length === 0) {
      description = `remove ${deleted[0].split('/').pop()}`;
    } else {
      description = 'refactor and cleanup';
      if (added.length > 0) description += ` (${added.length} added, ${deleted.length} removed)`;
    }
  } else {
    // Mixed changes
    const totalChanges = added.length + modified.length + deleted.length;
    if (scope.has('workflows')) description = 'improve CI/CD pipeline';
    else if (scope.has('components')) description = 'enhance components';
    else if (scope.has('tests')) description = 'improve test coverage';
    else if (scope.has('config')) description = 'update project configuration';
    else if (scope.has('scripts')) description = 'enhance build scripts';
    else description = `update project structure (${totalChanges} files)`;
  }

  // Analyze diff content for more context
  if (diffContent) {
    const lines = diffContent.split('\n');
    const addedLines = lines.filter(line => line.startsWith('+')).length;
    const removedLines = lines.filter(line => line.startsWith('-')).length;

    // Look for specific patterns
    if (diffContent.includes('TODO') || diffContent.includes('FIXME')) {
      if (!description.includes('fix')) description += ' and address TODOs';
    }

    if (diffContent.includes('console.log') && diffContent.includes('-')) {
      description += ' and remove debug logs';
    }

    if (diffContent.includes('test(') || diffContent.includes('it(') || diffContent.includes('describe(')) {
      if (!description.includes('test')) description += ' with tests';
    }

    if (diffContent.includes('export') && diffContent.includes('+')) {
      if (!description.includes('add') && !description.includes('export')) description += ' and export utilities';
    }
  }

  // Construct final message
  const commitMessage = `${type}${scopeStr}: ${description}`;

  // Generate body if significant changes
  let body = '';
  if (added.length + modified.length + deleted.length > 5) {
    body += '\nChanges:\n';
    if (added.length > 0) body += `- Added: ${added.length} files\n`;
    if (modified.length > 0) body += `- Modified: ${modified.length} files\n`;
    if (deleted.length > 0) body += `- Deleted: ${deleted.length} files\n`;
  }

  return { message: commitMessage, body: body.trim() };
}

// Interactive commit process
async function promptUser(question) {
  return new Promise((resolve) => {
    process.stdout.write(`${question} `);

    // Set stdin to raw mode for better input handling
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }

    process.stdin.once('data', (data) => {
      const input = data.toString().trim();
      resolve(input);
    });

    // Resume stdin if it was paused
    process.stdin.resume();
  });
}

async function interactiveCommit(analysis, suggestions) {
  logHeader('🤖 AI-Generated Commit Messages');

  // Show a brief summary first
  const { added, modified, deleted } = analysis;
  const totalFiles = added.length + modified.length + deleted.length;
  log(`\n📊 Changes Summary: ${totalFiles} files (${added.length} added, ${modified.length} modified, ${deleted.length} deleted)`, colors.cyan);

  // Show suggested messages prominently
  log('\n🎯 Commit message options:', colors.bright);

  // Option 1: Short
  log(`\n  ${colors.green}1.${colors.reset} ${colors.bright}Short:${colors.reset} ${suggestions[0].message}`);

  // Option 2: Descriptive
  log(`\n  ${colors.green}2.${colors.reset} ${colors.bright}Descriptive:${colors.reset} ${suggestions[1].message}`);
  if (suggestions[1].body) {
    const bodyLines = suggestions[1].body.split('\n').slice(0, 3); // Show first 3 lines
    bodyLines.forEach(line => {
      if (line.trim()) {
        log(`      ${colors.white}${line}${colors.reset}`);
      }
    });
    if (suggestions[1].body.split('\n').length > 3) {
      log(`      ${colors.white}...${colors.reset}`);
    }
  }

  // Show options clearly at the bottom
  log('\n' + '='.repeat(60), colors.cyan);
  log('📋 What would you like to do?', colors.bright);
  log('='.repeat(60), colors.cyan);
  log(`  ${colors.green}1${colors.reset}    Use short commit message (option 1)`);
  log(`  ${colors.green}2${colors.reset}    Use descriptive commit message (option 2)`);
  log(`  ${colors.blue}c${colors.reset}    Write a custom commit message`);
  log(`  ${colors.yellow}s${colors.reset}    Show detailed file changes`);
  log(`  ${colors.red}q${colors.reset}    Quit without committing`);
  log('='.repeat(60), colors.cyan);

  const choice = await promptUser(`\n${colors.bright}🎯 Your choice:${colors.reset}`);

  switch (choice.toLowerCase()) {
    case '1':
    case '2':
      const index = parseInt(choice) - 1;
      if (suggestions[index]) {
        log(`\n✅ Selected: ${suggestions[index].message}`, colors.green);
        return suggestions[index];
      } else {
        logWarning('Invalid selection. Please choose 1 or 2.');
        return await interactiveCommit(analysis, suggestions);
      }
    case 'c':
      log('\n📝 Custom commit message:', colors.bright);
      const customMessage = await promptUser('Message:');
      if (!customMessage.trim()) {
        logWarning('Commit message cannot be empty.');
        return await interactiveCommit(analysis, suggestions);
      }
      const customBody = await promptUser('Body (optional):');
      return { message: customMessage.trim(), body: customBody.trim() };
    case 's':
      showDetailedChanges(analysis);
      log('\nPress Enter to continue...', colors.cyan);
      await promptUser('');
      return await interactiveCommit(analysis, suggestions);
    case 'q':
      log('\n👋 Commit cancelled.', colors.yellow);
      process.exit(0);
    default:
      logWarning(`Invalid option "${choice}". Please choose 1-3, c, s, or q.`);
      return await interactiveCommit(analysis, suggestions);
  }
}

function showDetailedChanges(analysis) {
  logHeader('📊 Detailed File Changes');

  const { added, modified, deleted, renamed, categories, scope, fileTypes } = analysis;

  // Show summary first
  const total = added.length + modified.length + deleted.length + renamed.length;
  log(`\n📈 Total changes: ${total} files`, colors.bright);

  if (added.length > 0) {
    log(`\n${colors.green}📁 Added files (${added.length}):${colors.reset}`);
    added.slice(0, 10).forEach(file => log(`  ${colors.green}+${colors.reset} ${file}`));
    if (added.length > 10) {
      log(`  ${colors.white}... and ${added.length - 10} more${colors.reset}`);
    }
  }

  if (modified.length > 0) {
    log(`\n${colors.yellow}📝 Modified files (${modified.length}):${colors.reset}`);
    modified.slice(0, 10).forEach(file => log(`  ${colors.yellow}~${colors.reset} ${file}`));
    if (modified.length > 10) {
      log(`  ${colors.white}... and ${modified.length - 10} more${colors.reset}`);
    }
  }

  if (deleted.length > 0) {
    log(`\n${colors.red}🗑️ Deleted files (${deleted.length}):${colors.reset}`);
    deleted.slice(0, 10).forEach(file => log(`  ${colors.red}-${colors.reset} ${file}`));
    if (deleted.length > 10) {
      log(`  ${colors.white}... and ${deleted.length - 10} more${colors.reset}`);
    }
  }

  if (renamed.length > 0) {
    log(`\n${colors.blue}🔄 Renamed files (${renamed.length}):${colors.reset}`);
    renamed.forEach(file => log(`  → ${file}`, colors.blue));
  }

  log('\n🏷️ Detected categories:', colors.bright);
  Array.from(categories).forEach(cat => log(`  • ${cat}`, colors.cyan));

  log('\n🎯 Detected scopes:', colors.bright);
  Array.from(scope).forEach(sc => log(`  • ${sc}`, colors.magenta));

  log('\n📄 File types:', colors.bright);
  Array.from(fileTypes).forEach(type => log(`  • ${type}`, colors.white));
}

async function main() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const isAutoMode = args.includes('--auto');
    const shouldStageAll = args.includes('--stage-all');
    const shouldPush = args.includes('--push');
    const isSimpleMode = args.includes('--simple');
    const allowEmpty = args.includes('--allow-empty');
    const customMessage = args.find(arg => arg.startsWith('--message='))?.split('=')[1];

    logHeader('🤖 Smart Commit - AI-Powered Commit Messages');
    
    if (isAutoMode) {
      logInfo('🤖 Running in automatic mode');
    }

    // Check if we're in a git repository
    const statusLines = getGitStatus();
    
    // Check if there are unpushed commits
    let hasUnpushedCommits = false;
    try {
      const unpushedCommits = execSync('git log @{u}..HEAD --oneline', { encoding: 'utf8', cwd: rootDir });
      hasUnpushedCommits = unpushedCommits.trim().length > 0;
    } catch (error) {
      // Branch might not have upstream, ignore error
    }

    // SIMPLIFIED LOGIC FOR build:full - Always execute git add . if shouldStageAll is true
    if (shouldStageAll) {
      logInfo('Auto-staging all changes with `git add .`...');
      
      // Show what files will be added (both staged and unstaged)
      const allStatus = execSync('git status --porcelain', { encoding: 'utf8', cwd: rootDir });
      if (allStatus.trim()) {
        const files = allStatus.trim().split('\n').slice(0, 5); // Show first 5 files
        files.forEach(file => {
          const status = file.substring(0, 2);
          const filename = file.substring(3);
          let icon = '•';
          if (status.includes('M')) icon = '~';
          if (status.includes('A')) icon = '+';
          if (status.includes('D')) icon = '-';
          if (status.includes('??')) icon = '?';
          log(`  ${icon} ${filename}`, colors.cyan);
        });
        if (allStatus.trim().split('\n').length > 5) {
          log(`  ... and ${allStatus.trim().split('\n').length - 5} more files`, colors.white);
        }
      }
      
      // Always execute git add . regardless of current state
      execSync('git add .', { cwd: rootDir });
      logSuccess('All changes staged successfully!');
    }

    // Check current state after staging
    let updatedStatusLines = getGitStatus(); // Refresh status after staging
    let diffLines = getGitDiff();
    const hasWorkingChanges = updatedStatusLines.length > 0 && updatedStatusLines[0] !== '';
    const hasStagedChanges = diffLines.length > 0 && diffLines[0] !== '';

    // Determine what to do based on current state
    if (!hasStagedChanges && !hasWorkingChanges) {
      // No changes at all
      if (hasUnpushedCommits && shouldPush) {
        logInfo('No working directory changes, but found unpushed commits.');
        logInfo('\nPushing to remote...');
        try {
          execSync('git push', { stdio: 'inherit', cwd: rootDir });
          logSuccess('Push completed successfully!');
          log('\n✨ Smart commit completed successfully!', colors.green);
          process.exit(0);
        } catch (error) {
          logError('Push failed. You may need to push manually.');
          process.exit(1);
        }
      } else if (shouldPush) {
        logInfo('No changes to commit; attempting push...');
        try {
          execSync('git push', { stdio: 'inherit', cwd: rootDir });
          logSuccess('Push completed successfully!');
          log('\n✨ Smart commit completed successfully!', colors.green);
          process.exit(0);
        } catch (error) {
          logError('Push failed. You may need to push manually.');
          process.exit(1);
        }
      } else if (allowEmpty) {
        logInfo('No changes detected, but continuing due to --allow-empty flag.');
        log('\n✨ Smart commit completed successfully (no changes detected)!', colors.green);
        process.exit(0);
      } else {
        logInfo('No changes detected and no unpushed commits.');
        log('\n✨ Smart commit completed successfully (nothing to do)!', colors.green);
        process.exit(0);
      }
    }

    if (!hasStagedChanges) {
      // No staged changes but there might be working changes
      if (hasUnpushedCommits && shouldPush) {
        logInfo('No staged changes to commit, but found unpushed commits.');
        logInfo('\nPushing to remote...');
        try {
          execSync('git push', { stdio: 'inherit', cwd: rootDir });
          logSuccess('Push completed successfully!');
          log('\n✨ Smart commit completed successfully!', colors.green);
          process.exit(0);
        } catch (error) {
          logError('Push failed. You may need to push manually.');
          process.exit(1);
        }
      } else {
        logInfo('No staged changes to commit.');
        log('\n✨ Smart commit completed successfully (nothing to commit)!', colors.green);
        process.exit(0);
      }
    }

    logInfo('Analyzing changes...');

    // Analyze changes
    const analysis = analyzeChanges(updatedStatusLines, diffLines);
    const diffContent = getGitDiffContent();
    const diffStats = getGitDiffStats();

    // Generate exactly 2 suggestions: short and descriptive
    const suggestions = [];

    // Generate primary commit message
    const primary = generateCommitMessage(analysis, diffContent);

    // Option 1: Short version (just the message)
    const shortVersion = {
      message: primary.message,
      body: ''
    };
    suggestions.push(shortVersion);

    // Option 2: Descriptive version (with body and details)
    const descriptiveVersion = {
      message: primary.message,
      body: primary.body || `Changes:\n- Modified: ${analysis.modified.length} files\n- Added: ${analysis.added.length} files\n- Deleted: ${analysis.deleted.length} files`
    };

    // Add diff stats if significant changes
    if (analysis.added.length + analysis.modified.length + analysis.deleted.length > 3) {
      descriptiveVersion.body += `\n\nDiff summary:\n${diffStats.split('\n').slice(0, 5).join('\n')}`;
    }

    suggestions.push(descriptiveVersion);

    // Select commit message
    let selectedCommit;
    
    if (customMessage) {
      selectedCommit = { message: customMessage, body: '' };
      logInfo(`Using custom message: ${customMessage}`);
    } else if (isAutoMode) {
      // In auto mode, use the first (short) suggestion
      selectedCommit = suggestions[0];
      logInfo(`Auto-selected: ${selectedCommit.message}`);
    } else {
      // Interactive selection
      selectedCommit = await interactiveCommit(analysis, suggestions);
    }

    // Perform commit
    logInfo('Committing changes...');

    let commitCommand = `git commit -m "${selectedCommit.message}"`;
    if (selectedCommit.body && selectedCommit.body.trim()) {
      commitCommand = `git commit -m "${selectedCommit.message}" -m "${selectedCommit.body}"`;
    }

    execSync(commitCommand, { stdio: 'inherit', cwd: rootDir });

    logSuccess('Commit completed successfully!');

    // Show commit info
    const commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8', cwd: rootDir }).trim();
    log(`\n📝 Commit: ${commitHash}`, colors.cyan);
    log(`💬 Message: ${selectedCommit.message}`, colors.green);

    // Push if requested
    if (shouldPush) {
      logInfo('\nPushing to remote...');
      try {
        execSync('git push', { stdio: 'inherit', cwd: rootDir });
        logSuccess('Push completed successfully!');
      } catch (error) {
        logError('Push failed. You may need to push manually.');
      }
    }

    // Exit successfully
    log('\n✨ Smart commit completed successfully!', colors.green);
    process.exit(0);

  } catch (error) {
    logError(`Smart commit failed: ${error.message}`);
    process.exit(1);
  }
}

// Cleanup function
function cleanup() {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
  process.stdin.pause();
  process.stdin.destroy();
}

// Handle process termination
process.on('SIGINT', () => {
  log('\n\n👋 Smart commit interrupted. No changes committed.', colors.cyan);
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('\n\n👋 Smart commit terminated. No changes committed.', colors.cyan);
  cleanup();
  process.exit(0);
});

process.on('exit', () => {
  cleanup();
});

// Start the application
main().catch((error) => {
  logError('Smart commit crashed:');
  console.error(error);
  cleanup();
  process.exit(1);
});