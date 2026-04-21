#!/usr/bin/env node

/**
 * Development Tools - Unified development workflow orchestrator
 * 
 * Consolidates pipeline-runner.js, dev-flow.js, and pipeline.sh functionality
 * Usage: node scripts/development/dev-tools.js [command] [options]
 */

import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';
import { colors, log, logHeader, logCompactHeader, logSuccess, logError, logWarning, logInfo } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = dirname(dirname(__dirname));

function executeCommand(command, description, options = {}) {
  const startTime = Date.now();
  const quiet = options.quiet || process.env.BUILD_QUIET === '1';
  try {
    log(`🔄 ${description}...`, colors.cyan);

    if (quiet) {
      const output = execSync(command, {
        stdio: 'pipe',
        cwd: rootDir,
        env: { ...process.env, FORCE_COLOR: '0' },
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024
      });
      // In quiet mode, only show actual errors from output
      if (output) {
        const lines = output.split('\n');
        const important = lines.filter(l => {
          const trimmed = l.trim();
          if (!trimmed) return false;
          // Skip lines with success/info indicators anywhere in the line
          if (/[\u2705\u2713\u2714\u2139]/.test(trimmed)) return false;
          if (trimmed.includes('✅') || trimmed.includes('✓') || trimmed.includes('ℹ️')) return false;
          // Only show actual error/failure lines
          return /\b(error|fail(ed|ure)?|fatal|exception)\b/i.test(trimmed);
        });
        if (important.length > 0) {
          important.slice(0, 5).forEach(l => logWarning(l.trim()));
        }
      }
    } else {
      execSync(command, {
        stdio: options.silent ? 'pipe' : 'inherit',
        cwd: rootDir,
        env: { ...process.env, FORCE_COLOR: '1' }
      });
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logSuccess(`${description} completed in ${duration}s`);
    return true;
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logError(`${description} failed after ${duration}s`);
    // In quiet mode, show the captured output on failure
    if (quiet && error.stdout) console.log(error.stdout);
    if (quiet && error.stderr) console.error(error.stderr);
    return false;
  }
}

/**
 * Execute multiple commands in parallel. Returns true only if all succeed.
 * Each command runs as a child process; output is captured and shown on failure.
 */
function executeParallel(commands) {
  const quiet = process.env.BUILD_QUIET === '1';
  const descs = commands.map(c => c.desc).join(', ');
  log(`⚡ Running in parallel: ${descs}`, colors.cyan);

  const startTime = Date.now();

  const promises = commands.map(({ cmd, desc }) => {
    const taskStart = Date.now();
    return new Promise((resolve) => {
      const child = spawn('sh', ['-c', cmd], {
        cwd: rootDir,
        env: { ...process.env, FORCE_COLOR: '0' },
        stdio: 'pipe',
      });

      let stdout = '';
      let stderr = '';
      child.stdout.on('data', d => { stdout += d; });
      child.stderr.on('data', d => { stderr += d; });

      child.on('close', (code) => {
        const duration = ((Date.now() - taskStart) / 1000).toFixed(1);
        if (code === 0) {
          logSuccess(`${desc} completed in ${duration}s`);
          resolve({ success: true, desc });
        } else {
          logError(`${desc} failed after ${duration}s`);
          if (!quiet) {
            if (stdout.trim()) console.log(stdout);
            if (stderr.trim()) console.error(stderr);
          } else {
            // In quiet mode, show captured output on failure
            if (stdout.trim()) console.log(stdout);
            if (stderr.trim()) console.error(stderr);
          }
          resolve({ success: false, desc, stdout, stderr });
        }
      });
    });
  });

  return Promise.all(promises).then(results => {
    const allOk = results.every(r => r.success);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    if (allOk) {
      logSuccess(`Parallel group completed in ${duration}s`);
    } else {
      const failed = results.filter(r => !r.success).map(r => r.desc);
      logError(`Parallel group failed after ${duration}s (${failed.join(', ')})`);
    }
    return allOk;
  });
}

// Pipeline definitions
// Commands can be individual objects or arrays (parallel groups)
const pipelines = {
  quality: {
    name: '🎯 Quality',
    description: 'ESLint, TypeScript, Tests, Formatting (parallel)',
    commands: [
      // All checks are read-only and independent — run fully in parallel
      [
        { cmd: 'npm run lint', desc: 'ESLint check' },
        { cmd: 'npm run type-check', desc: 'TypeScript check' },
        { cmd: 'npm run format:check', desc: 'Format check' },
        { cmd: 'npm test', desc: 'Tests' },
      ],
    ],
    color: colors.blue
  },
  security: {
    name: '🛡️ Security',
    description: 'Vulnerabilities, Patterns, Licenses',
    commands: [
      // Both security checks are independent — run in parallel
      [
        { cmd: 'npm run security:audit', desc: 'Dependency audit' },
        { cmd: 'npm run security:scan', desc: 'Security patterns' },
      ],
    ],
    color: colors.red
  },
  build: {
    name: '📦 Build',
    description: 'Build application',
    commands: [
      { cmd: 'npm run build', desc: 'Build application' }
    ],
    color: colors.green
  }
};

// Workflow definitions
const workflows = {
  commit: {
    name: '⚡ Quick Commit Flow',
    description: 'Quality check + AI commit + push',
    steps: [
      { type: 'pipeline', target: 'quality' },
      { type: 'command', cmd: 'node scripts/git/smart-commit.js --stage-all', desc: 'AI commit' },
      { type: 'command', cmd: 'git push', desc: 'Push to remote' }
    ]
  },
  safe: {
    name: '🛡️ Safe Development Flow',
    description: 'Full validation + AI commit',
    steps: [
      { type: 'pipeline', target: 'quality' },
      { type: 'pipeline', target: 'security' },
      { type: 'command', cmd: 'node scripts/git/smart-commit.js', desc: 'AI commit' }
    ]
  },
  full: {
    name: '🚀 Full Pipeline',
    description: 'Quality + Security + Build + Deploy',
    steps: [
      { type: 'command', cmd: 'node scripts/git/smart-commit.js --stage-all --auto --allow-empty', desc: 'Pre-build commit (clean working directory)' },
      { type: 'command', cmd: 'git pull --rebase', desc: 'Sync with remote' },
      { type: 'pipeline', target: 'quality' },
      { type: 'pipeline', target: 'security' },
      { type: 'command', cmd: 'npx vite build --mode production --config config/vite.config.ts', desc: 'Build application (vite only)' },
      { type: 'command', cmd: 'node scripts/git/smart-commit.js --stage-all --push --auto --allow-empty', desc: 'Post-build commit & push' },
      { type: 'command', cmd: 'node scripts/git/github-actions-status.js watch-all', desc: 'Monitor pipeline (CI + CD)' },
    ]
  },
  fix: {
    name: '🔧 Auto-fix Flow',
    description: 'Auto-fix issues + commit',
    steps: [
      { type: 'command', cmd: 'npm run lint:fix', desc: 'Auto-fix linting' },
      { type: 'command', cmd: 'npm run format', desc: 'Auto-format code' },
      { type: 'pipeline', target: 'quality' },
      { type: 'command', cmd: 'node scripts/git/smart-commit.js --stage-all --auto', desc: 'Auto commit' }
    ]
  }
};

async function promptUser(question) {
  return new Promise((resolve) => {
    process.stdout.write(`${question} `);
    process.stdin.once('data', (data) => {
      resolve(data.toString().trim());
    });
  });
}

function showMainMenu() {
  logHeader('🎭 Development Tools - Unified Workflow Orchestrator');

  log('\n📋 Available Pipelines:', colors.bright);
  Object.entries(pipelines).forEach(([key, pipeline]) => {
    log(`  ${key.padEnd(10)} ${pipeline.name}`, pipeline.color);
    log(`             ${pipeline.description}`, colors.white);
  });

  log('\n🔄 Available Workflows:', colors.bright);
  Object.entries(workflows).forEach(([key, workflow]) => {
    log(`  ${key.padEnd(10)} ${workflow.name}`, colors.magenta);
    log(`             ${workflow.description}`, colors.white);
  });

  log('\n⚡ Quick Commands:', colors.bright);
  log('  q          Quality pipeline', colors.blue);
  log('  s          Security pipeline', colors.red);
  log('  b          Build pipeline', colors.green);
  log('  a          All pipelines', colors.magenta);
  log('  c          Quick commit flow', colors.cyan);
  log('  f          Auto-fix flow', colors.yellow);
  log('  t          Run tests', colors.white);
  log('  h          Show this help', colors.white);
  log('  x          Exit', colors.red);
}

async function runPipeline(pipelineKey) {
  const pipeline = pipelines[pipelineKey];
  if (!pipeline) {
    logError(`Unknown pipeline: ${pipelineKey}`);
    return false;
  }

  logCompactHeader(`${pipeline.name}`);

  const startTime = Date.now();
  let allSuccess = true;

  for (const entry of pipeline.commands) {
    // Array = parallel group, object = sequential command
    if (Array.isArray(entry)) {
      const success = await executeParallel(entry);
      if (!success) {
        allSuccess = false;
        break;
      }
    } else {
      const success = executeCommand(entry.cmd, entry.desc);
      if (!success) {
        allSuccess = false;
        break;
      }
    }
  }

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);

  if (allSuccess) {
    logSuccess(`${pipeline.name} completed successfully in ${totalDuration}s`);
  } else {
    logError(`${pipeline.name} failed after ${totalDuration}s`);
  }

  return allSuccess;
}

async function runWorkflow(workflowKey) {
  const workflow = workflows[workflowKey];
  if (!workflow) {
    logError(`Unknown workflow: ${workflowKey}`);
    return false;
  }

  logHeader(`${workflow.name} - Execution`);
  logInfo(`Description: ${workflow.description}`);

  const startTime = Date.now();
  let allSuccess = true;

  for (const step of workflow.steps) {
    if (step.type === 'pipeline') {
      const success = await runPipeline(step.target);
      if (!success) {
        allSuccess = false;
        break;
      }
    } else if (step.type === 'command') {
      const success = executeCommand(step.cmd, step.desc);
      if (!success) {
        allSuccess = false;
        // For GitHub Actions monitoring, don't fail the entire workflow
        if (step.desc.includes('GitHub Actions')) {
          logWarning('GitHub Actions monitoring failed, but continuing...');
          allSuccess = true;
        } else {
          break;
        }
      }
    }
  }

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);

  if (allSuccess) {
    logSuccess(`${workflow.name} completed successfully in ${totalDuration}s`);

    // Concise summary for full workflow (bot-friendly)
    if (workflowKey === 'full') {
      let commitSha = 'unknown';
      try {
        commitSha = execSync('git rev-parse --short HEAD', { encoding: 'utf8', cwd: rootDir }).trim();
      } catch {}

      // Write build metadata for telegram-notify.js
      try {
        const metaPath = join(rootDir, 'dist', 'build-meta.json');
        writeFileSync(metaPath, JSON.stringify({
          commit: commitSha,
          duration: totalDuration,
          buildDate: new Date().toISOString()
        }));
      } catch {}

      console.log('\n' + '='.repeat(50));
      log('✅ Build exitoso', colors.bright + colors.green);
      log(`  🔗 https://genilsuarez.github.io/fluentflow/`, colors.cyan);
      log(`  📝 Commit: ${commitSha}`, colors.white);
      log(`  ⏱️ Tiempo: ${totalDuration}s`, colors.white);
      console.log('='.repeat(50));
    }
  } else {
    logError(`${workflow.name} failed after ${totalDuration}s`);

    if (workflowKey === 'full') {
      console.log('\n' + '='.repeat(50));
      log(`❌ Build falló (${totalDuration}s)`, colors.bright + colors.red);
      console.log('='.repeat(50));
    }
  }

  return allSuccess;
}

async function runAllPipelines() {
  logHeader('🚀 All Pipelines - Sequential Execution');

  const pipelineOrder = ['quality', 'security', 'build'];
  let allSuccess = true;

  for (const pipelineKey of pipelineOrder) {
    const success = await runPipeline(pipelineKey);
    if (!success) {
      allSuccess = false;
      break;
    }
  }

  return allSuccess;
}

function showGitStatus() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8', cwd: rootDir });
    const hasChanges = status.trim().length > 0;

    if (hasChanges) {
      log('\n📊 Git Status:', colors.bright);
      const lines = status.trim().split('\n');
      lines.slice(0, 10).forEach(line => {
        const status = line.substring(0, 2);
        const file = line.substring(3);
        let color = colors.white;
        let icon = '•';

        if (status.includes('M')) { color = colors.yellow; icon = '~'; }
        if (status.includes('A')) { color = colors.green; icon = '+'; }
        if (status.includes('D')) { color = colors.red; icon = '-'; }
        if (status.includes('??')) { color = colors.cyan; icon = '?'; }

        log(`  ${icon} ${file}`, color);
      });

      if (lines.length > 10) {
        log(`  ... and ${lines.length - 10} more files`, colors.white);
      }
    } else {
      log('\n✨ Working directory is clean', colors.green);
    }

    return hasChanges;
  } catch (error) {
    logWarning('Not a git repository or git not available');
    return false;
  }
}

async function interactiveMode() {
  console.clear();
  showMainMenu();
  showGitStatus();

  while (true) {
    const input = await promptUser('\n🎯 Select option:');

    switch (input.toLowerCase()) {
      case 'q':
      case 'quality':
        await runPipeline('quality');
        break;
      case 's':
      case 'security':
        await runPipeline('security');
        break;
      case 'b':
      case 'build':
        await runPipeline('build');
        break;
      case 'a':
      case 'all':
        await runAllPipelines();
        break;
      case 'c':
      case 'commit':
        await runWorkflow('commit');
        break;
      case 'safe':
        await runWorkflow('safe');
        break;
      case 'full':
        await runWorkflow('full');
        break;
      case 'f':
      case 'fix':
        await runWorkflow('fix');
        break;
      case 't':
      case 'test':
        executeCommand('npm test', 'Run tests');
        break;
      case 'h':
      case 'help':
        showMainMenu();
        showGitStatus();
        break;
      case 'x':
      case 'exit':
      case 'quit':
        log('\n👋 Development tools session ended. Happy coding!', colors.cyan);
        process.exit(0);
        break;
      default:
        logWarning('Invalid option. Type "h" for help or "x" to exit.');
        break;
    }
  }
}

function showHelp() {
  console.log(`
🎭 Development Tools - Unified Workflow Orchestrator

Usage: node scripts/development/dev-tools.js [command] [options]

Commands:
  quality, q       Run quality pipeline (ESLint, TypeScript, Tests)
  security, s      Run security pipeline (Audit, Patterns, Licenses)
  build, b         Run build pipeline (Build, Verify, Analysis)
  all, a           Run all pipelines sequentially
  
  commit, c        Quick commit flow (quality + AI commit + push)
  safe             Safe development flow (quality + security + commit)
  full             Complete flow (all pipelines + commit + push)
  fix, f           Auto-fix flow (fix issues + commit)
  
  test, t          Run test suite
  interactive, i   Interactive mode (default)
  help, h          Show this help

Options:
  --ci-mode        Optimize for CI environment (non-interactive)
  --quiet, -q      Suppress command output (show only on failure)
  --silent         Suppress command output
  --no-git         Skip git status checks

Examples:
  node scripts/development/dev-tools.js                    # Interactive mode
  node scripts/development/dev-tools.js quality            # Run quality pipeline
  node scripts/development/dev-tools.js commit             # Quick commit flow
  node scripts/development/dev-tools.js all                # Run all pipelines
  
NPM Integration:
  npm run dev-tools                            # Interactive mode
  npm run pipeline:quality                     # Quality pipeline
  npm run pipeline:all                         # All pipelines
  `);
}

async function main() {
  const args = process.argv.slice(2);

  // Check for CI mode
  const isCIMode = args.includes('--ci-mode') || process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  const isQuiet = args.includes('--quiet') || args.includes('-q');
  const filteredArgs = args.filter(arg => !['--ci-mode', '--quiet', '-q'].includes(arg));

  if (isQuiet) process.env.BUILD_QUIET = '1';

  // Configure for CI environment
  if (isCIMode) {
    logInfo('🤖 Running in CI mode');
    // Disable interactive features in CI
    process.env.CI_MODE = 'true';
  }

  // Handle command line arguments
  if (filteredArgs.length > 0) {
    const command = filteredArgs[0].toLowerCase();

    switch (command) {
      case 'quality':
      case 'q':
        await runPipeline('quality');
        break;
      case 'security':
      case 's':
        await runPipeline('security');
        break;
      case 'build':
      case 'b':
        await runPipeline('build');
        break;
      case 'all':
      case 'a':
        await runAllPipelines();
        break;
      case 'commit':
      case 'c':
        await runWorkflow('commit');
        break;
      case 'safe':
        await runWorkflow('safe');
        break;
      case 'full':
        await runWorkflow('full');
        break;
      case 'fix':
      case 'f':
        await runWorkflow('fix');
        break;
      case 'test':
      case 't':
        executeCommand('npm test', 'Run tests');
        break;
      case 'interactive':
      case 'i':
        await interactiveMode();
        break;
      case 'help':
      case 'h':
      case '--help':
        showHelp();
        break;
      default:
        logError(`Unknown command: ${command}`);
        showHelp();
        break;
    }
  } else {
    // Default to interactive mode
    await interactiveMode();
  }
}

// Handle process termination
process.on('SIGINT', () => {
  log('\n\n👋 Development tools interrupted. Goodbye!', colors.cyan);
  process.exit(0);
});

// Start the application
main().catch((error) => {
  logError('Development tools crashed:');
  console.error(error);
  process.exit(1);
});