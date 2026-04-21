#!/usr/bin/env node

/**
 * GitHub Actions Status Checker
 * Validates the status of GitHub Actions workflows and provides detailed reporting
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Import shared utilities
import { logInfo, logSuccess, logError, logWarning, logHeader, colors } from '../utils/logger.js';
import { getCurrentBranch, getRemoteUrl, getLatestCommit } from '../utils/git-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..', '..'); // Go up two levels: git -> scripts -> root

/**
 * Check if GitHub CLI is installed and authenticated
 */
function checkGitHubCLI() {
  try {
    execSync('gh --version', { stdio: 'pipe' });
    execSync('gh auth status', { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get workflow runs for the current repository
 */
function getWorkflowRuns(limit = 10) {
  try {
    const output = execSync(
      `gh run list --limit ${limit} --json status,conclusion,workflowName,createdAt,headBranch,headSha,url,displayTitle,event,updatedAt`,
      {
        encoding: 'utf8',
        cwd: rootDir,
      }
    );
    return JSON.parse(output);
  } catch (error) {
    logError('Failed to fetch workflow runs');
    return [];
  }
}

/**
 * Get specific workflow run details
 */
function getWorkflowRunDetails(runId) {
  try {
    const output = execSync(
      `gh run view ${runId} --json jobs,status,conclusion,workflowName,createdAt,headBranch,headSha,url,displayTitle`,
      {
        encoding: 'utf8',
        cwd: rootDir,
      }
    );
    return JSON.parse(output);
  } catch (error) {
    logError(`Failed to fetch details for run ${runId}`);
    return null;
  }
}

/**
 * Get workflow files from .github/workflows
 */
function getWorkflowFiles() {
  const workflowsDir = path.join(rootDir, '.github', 'workflows');
  if (!fs.existsSync(workflowsDir)) {
    return [];
  }

  return fs
    .readdirSync(workflowsDir)
    .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'))
    .map(file => path.join(workflowsDir, file));
}

/**
 * Parse workflow file to extract basic info
 */
function parseWorkflowFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const nameMatch = content.match(/^name:\s*(.+)$/m);
    const onMatch = content.match(/^on:\s*(.+)$/m);

    // Detect if workflow has push trigger
    const hasPushTrigger = /^\s+push:/m.test(content) || /^on:\s*\[.*push.*\]/m.test(content);

    return {
      file: path.basename(filePath),
      name: nameMatch
        ? nameMatch[1].replace(/['"]/g, '')
        : path.basename(filePath, path.extname(filePath)),
      path: filePath,
      triggers: onMatch ? onMatch[1] : 'unknown',
      hasPushTrigger,
    };
  } catch (error) {
    return {
      file: path.basename(filePath),
      name: path.basename(filePath, path.extname(filePath)),
      path: filePath,
      triggers: 'unknown',
      hasPushTrigger: true, // Assume true if we can't parse
    };
  }
}

/**
 * Format status with colors
 */
function formatStatus(status, conclusion) {
  if (status === 'completed') {
    switch (conclusion) {
      case 'success':
        return `${colors.green}✅ Success${colors.reset}`;
      case 'failure':
        return `${colors.red}❌ Failed${colors.reset}`;
      case 'cancelled':
        return `${colors.yellow}⏹️  Cancelled${colors.reset}`;
      case 'skipped':
        return `${colors.cyan}⏭️  Skipped${colors.reset}`;
      default:
        return `${colors.white}${conclusion}${colors.reset}`;
    }
  } else {
    switch (status) {
      case 'in_progress':
        return `${colors.blue}🔄 Running${colors.reset}`;
      case 'queued':
        return `${colors.yellow}⏳ Queued${colors.reset}`;
      case 'requested':
        return `${colors.cyan}📋 Requested${colors.reset}`;
      default:
        return `${colors.white}${status}${colors.reset}`;
    }
  }
}

/**
 * Format duration
 */
function formatDuration(startTime, endTime) {
  if (!startTime) return 'N/A';

  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : new Date();
  const duration = Math.round((end - start) / 1000);

  if (duration < 60) return `${duration}s`;
  if (duration < 3600) return `${Math.floor(duration / 60)}m ${duration % 60}s`;
  return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`;
}

/**
 * Show workflow status summary
 */
function showWorkflowStatus() {
  logHeader('🔍 GitHub Actions Pipeline Status');

  // Check GitHub CLI
  if (!checkGitHubCLI()) {
    logError('GitHub CLI (gh) is not installed or not authenticated');
    logInfo('Install: https://cli.github.com/');
    logInfo('Authenticate: gh auth login');
    return false;
  }

  // Get current repository info
  const currentBranch = getCurrentBranch();
  const remoteUrl = getRemoteUrl();
  const latestCommit = getLatestCommit();

  logInfo(`Repository: ${remoteUrl}`);
  logInfo(`Branch: ${currentBranch}`);
  logInfo(`Latest commit: ${latestCommit.slice(0, 8)}`);

  // Get workflow files
  const workflowFiles = getWorkflowFiles();
  if (workflowFiles.length === 0) {
    logWarning('No workflow files found in .github/workflows/');
    return false;
  }

  // Get recent workflow runs
  const runs = getWorkflowRuns(30);
  if (runs.length === 0) {
    logWarning('\n⚠️  No workflow runs found');
    return true;
  }

  // Show current commit status first
  logInfo(`\n🎯 Current Commit Status (${latestCommit.slice(0, 8)}):`);

  // Build a map of workflow names that have push triggers
  const workflowPushMap = {};
  workflowFiles.forEach(file => {
    const wf = parseWorkflowFile(file);
    workflowPushMap[wf.name] = wf.hasPushTrigger;
    workflowPushMap[`.github/workflows/${wf.file}`] = wf.hasPushTrigger;
  });

  // Filter out schedule-only workflows erroneously triggered by push
  const currentCommitRuns = runs
    .filter(run => run.headSha === latestCommit)
    .filter(run => {
      if (run.event === 'push' && workflowPushMap[run.workflowName] === false) return false;
      return true;
    });

  if (currentCommitRuns.length === 0) {
    logWarning('  No runs found for current commit');
  } else {
    // Group current commit runs by workflow
    const currentRunsByWorkflow = {};
    currentCommitRuns.forEach(run => {
      if (!currentRunsByWorkflow[run.workflowName]) {
        currentRunsByWorkflow[run.workflowName] = run; // Keep only the latest run per workflow
      }
    });

    // Show status for each configured workflow
    workflowFiles.forEach(file => {
      const workflow = parseWorkflowFile(file);
      const run = currentRunsByWorkflow[workflow.name];

      if (run) {
        const status = formatStatus(run.status, run.conclusion);
        const time = new Date(run.createdAt).toLocaleString();
        const duration = run.conclusion
          ? formatDuration(run.createdAt, run.updatedAt)
          : 'Running...';
        logInfo(`  📊 ${workflow.name}: ${status}`);
        logInfo(`      ${time} | ${duration} | ${run.url}`);
      } else {
        logInfo(`  📊 ${workflow.name}: ${colors.white}⚪ No runs${colors.reset}`);
      }
    });

    // Summary for current commit
    const currentSuccessful = currentCommitRuns.filter(r => r.conclusion === 'success').length;
    const currentFailed = currentCommitRuns.filter(r => r.conclusion === 'failure').length;
    const currentRunning = currentCommitRuns.filter(r => r.status === 'in_progress').length;
    const currentPending = currentCommitRuns.filter(
      r => r.status === 'queued' || r.status === 'requested'
    ).length;

    logInfo(`\n📊 Current Commit Summary:`);
    if (currentSuccessful > 0) logSuccess(`  ✅ ${currentSuccessful} successful`);
    if (currentFailed > 0) logError(`  ❌ ${currentFailed} failed`);
    if (currentRunning > 0) logInfo(`  🔄 ${currentRunning} running`);
    if (currentPending > 0) logInfo(`  ⏳ ${currentPending} pending`);
  }

  // Show recent activity for context (last 3 runs per workflow)
  logInfo(`\n📈 Recent Activity (last 3 runs per workflow):`);
  const runsByWorkflow = {};
  runs.forEach(run => {
    if (!runsByWorkflow[run.workflowName]) {
      runsByWorkflow[run.workflowName] = [];
    }
    if (runsByWorkflow[run.workflowName].length < 3) {
      runsByWorkflow[run.workflowName].push(run);
    }
  });

  Object.entries(runsByWorkflow).forEach(([workflowName, workflowRuns]) => {
    logInfo(`\n  🔄 ${workflowName}:`);

    workflowRuns.forEach((run, index) => {
      const status = formatStatus(run.status, run.conclusion);
      const time = new Date(run.createdAt).toLocaleString();
      const isCurrentCommit = run.headSha === latestCommit;
      const commitIndicator = isCurrentCommit ? `${colors.bright}[CURRENT]${colors.reset}` : '';

      logInfo(`    ${index + 1}. ${status} - ${time} ${commitIndicator}`);
      if (run.displayTitle && run.displayTitle.length > 50) {
        logInfo(`       "${run.displayTitle.slice(0, 50)}..."`);
      } else if (run.displayTitle) {
        logInfo(`       "${run.displayTitle}"`);
      }
    });
  });

  return true;
}

/**
 * Show detailed status for current commit only
 */
function showCurrentStatus() {
  logHeader('🎯 Current Commit Pipeline Status');

  if (!checkGitHubCLI()) {
    logError('GitHub CLI (gh) is not installed or not authenticated');
    return false;
  }

  const currentBranch = getCurrentBranch();
  const latestCommit = getLatestCommit();

  logInfo(`Commit: ${latestCommit.slice(0, 8)}`);
  logInfo(`Branch: ${currentBranch}`);

  // Get workflow files to know what workflows should exist
  const workflowFiles = getWorkflowFiles();
  if (workflowFiles.length === 0) {
    logWarning('No workflow files found in .github/workflows/');
    return false;
  }

  // Get runs for current commit only
  const runs = getWorkflowRuns(30);

  // Build a map of workflow names that have push triggers
  // Map both by workflow name AND by file path (GitHub sometimes uses file path as workflowName)
  const workflowPushMap = {};
  workflowFiles.forEach(file => {
    const wf = parseWorkflowFile(file);
    workflowPushMap[wf.name] = wf.hasPushTrigger;
    // Also map by relative path (GitHub uses this when workflow has parse errors)
    const relativePath = `.github/workflows/${wf.file}`;
    workflowPushMap[relativePath] = wf.hasPushTrigger;
  });

  // Filter out schedule-only workflows that GitHub erroneously triggers on push
  // These fail instantly with "workflow file issue" and are not real failures
  const currentRuns = runs
    .filter(run => run.headSha === latestCommit)
    .filter(run => {
      if (run.event === 'push' && workflowPushMap[run.workflowName] === false) {
        return false; // Skip schedule/dispatch-only workflows triggered by push
      }
      return true;
    });

  if (currentRuns.length === 0) {
    logWarning(`\nNo workflow runs found for current commit (${latestCommit.slice(0, 8)})`);
    logInfo('This might mean:');
    logInfo('  • The commit was just pushed and workflows are starting');
    logInfo('  • Workflows are not configured to run on this branch');
    logInfo('  • There might be an issue with workflow triggers');
    return true;
  }

  // Group runs by workflow name and show the latest run for each
  const runsByWorkflow = {};
  currentRuns.forEach(run => {
    if (
      !runsByWorkflow[run.workflowName] ||
      new Date(run.createdAt) > new Date(runsByWorkflow[run.workflowName].createdAt)
    ) {
      runsByWorkflow[run.workflowName] = run;
    }
  });

  const uniqueWorkflowCount = Object.keys(runsByWorkflow).length;
  logInfo(`\n🔄 Pipeline Status (${uniqueWorkflowCount} workflows):`);

  // Show status for each workflow (compact format)
  Object.entries(runsByWorkflow).forEach(([workflowName, run]) => {
    const status = formatStatus(run.status, run.conclusion);
    const time = new Date(run.createdAt).toLocaleString();
    const duration = run.conclusion ? formatDuration(run.createdAt, run.updatedAt) : 'Running...';

    logInfo(`\n📊 ${workflowName}: ${status}`);
    logInfo(`   Started: ${time} | Duration: ${duration}`);
    logInfo(`   URL: ${run.url}`);

    if (run.displayTitle && run.displayTitle.length > 60) {
      logInfo(`   "${run.displayTitle.slice(0, 60)}..."`);
    } else if (run.displayTitle) {
      logInfo(`   "${run.displayTitle}"`);
    }
  });

  // Check for missing workflows
  const runningWorkflows = new Set(Object.keys(runsByWorkflow));
  const configuredWorkflows = workflowFiles.map(file => parseWorkflowFile(file).name);
  const missingWorkflows = configuredWorkflows.filter(name => !runningWorkflows.has(name));

  if (missingWorkflows.length > 0) {
    logInfo(`\n⚠️  Workflows not triggered for this commit:`);
    missingWorkflows.forEach(name => {
      logInfo(`   • ${name}`);
    });
  }

  // Summary
  const successful = Object.values(runsByWorkflow).filter(r => r.conclusion === 'success').length;
  const failed = Object.values(runsByWorkflow).filter(r => r.conclusion === 'failure').length;
  const running = Object.values(runsByWorkflow).filter(r => r.status === 'in_progress').length;
  const pending = Object.values(runsByWorkflow).filter(
    r => r.status === 'queued' || r.status === 'requested'
  ).length;
  const cancelled = Object.values(runsByWorkflow).filter(r => r.conclusion === 'cancelled').length;

  logInfo(`\n📊 Pipeline Summary:`);
  if (successful > 0) logSuccess(`  ✅ ${successful} successful`);
  if (failed > 0) logError(`  ❌ ${failed} failed`);
  if (running > 0) logInfo(`  🔄 ${running} running`);
  if (pending > 0) logInfo(`  ⏳ ${pending} pending`);
  if (cancelled > 0) logInfo(`  ⏹️  ${cancelled} cancelled`);

  // Overall status
  const totalWorkflows = Object.keys(runsByWorkflow).length;
  const hasActiveWorkflows = running > 0 || pending > 0;

  if (failed > 0 && !hasActiveWorkflows) {
    logError(`\n❌ Pipeline Status: FAILED (${failed}/${totalWorkflows} workflows failed)`);
  } else if (hasActiveWorkflows) {
    logInfo(
      `\n🔄 Pipeline Status: IN PROGRESS (${running + pending}/${totalWorkflows} workflows pending)`
    );
  } else if (successful === totalWorkflows) {
    logSuccess(`\n✅ Pipeline Status: SUCCESS (${successful}/${totalWorkflows} workflows passed)`);
  } else {
    logInfo(`\n⚪ Pipeline Status: MIXED RESULTS`);
  }

  // Add activity indicator for watch mode
  if (hasActiveWorkflows) {
    logInfo(`\n🔄 Active workflows detected - monitoring will continue...`);
  } else {
    logInfo(`\n⚪ All workflows completed - monitoring may stop automatically`);
  }

  return { success: failed === 0, hasActivity: hasActiveWorkflows };
}

/**
 * Get adaptive polling interval based on workflow states
 */
function getAdaptiveInterval(runs, latestCommit) {
  const currentRuns = runs.filter(run => run.headSha === latestCommit);

  if (currentRuns.length === 0) return 30;

  const states = currentRuns.map(run => run.status);

  // Prioritize most urgent state
  if (states.includes('queued') || states.includes('requested')) {
    return 10; // Check frequently when queued
  }
  if (states.includes('in_progress')) {
    return 15; // Medium frequency when running
  }

  return 30; // Default interval
}

/**
 * Check if there are active workflows (running or pending)
 */
function hasActiveWorkflows() {
  try {
    const latestCommit = getLatestCommit();

    const runs = getWorkflowRuns(20);

    // Build push trigger map to filter phantom runs
    const workflowsDir = path.join(rootDir, '.github', 'workflows');
    const workflowPushMap = {};
    if (fs.existsSync(workflowsDir)) {
      fs.readdirSync(workflowsDir)
        .filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
        .forEach(f => {
          const wf = parseWorkflowFile(path.join(workflowsDir, f));
          workflowPushMap[wf.name] = wf.hasPushTrigger;
          workflowPushMap[`.github/workflows/${wf.file}`] = wf.hasPushTrigger;
        });
    }

    const currentRuns = runs
      .filter(run => run.headSha === latestCommit)
      .filter(run => {
        if (run.event === 'push' && workflowPushMap[run.workflowName] === false) return false;
        return true;
      });

    if (currentRuns.length === 0) {
      return false;
    }

    // Check if any workflow is still active
    const activeRuns = currentRuns.filter(
      run => run.status === 'in_progress' || run.status === 'queued' || run.status === 'requested'
    );

    return activeRuns.length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Watch all workflows for the current commit until everything completes.
 * Shows a compact status line per poll. Exits 0 on full success, 1 on failure.
 * Used by build:full for end-to-end monitoring.
 */
function watchAll(timeoutSeconds = 600) {
  const latestCommit = getLatestCommit();
  logInfo(`👀 Monitoring pipeline — commit ${latestCommit.slice(0, 8)}`);
  logInfo('Press Ctrl+C to stop\n');

  // Workflows triggered on push (in order of expected completion)
  const WATCHED = ['CI Build', 'CI Quality', 'CI Security', 'CD Deploy'];
  const INTERVAL = 8; // poll every 8s
  const start = Date.now();

  const poll = () => {
    const elapsed = Math.round((Date.now() - start) / 1000);

    if (elapsed >= timeoutSeconds) {
      logError(`❌ Timeout after ${timeoutSeconds}s`);
      process.exit(1);
    }

    let runs;
    try {
      runs = getWorkflowRuns(20);
    } catch {
      setTimeout(poll, INTERVAL * 1000);
      return;
    }

    const currentRuns = runs.filter(r => r.headSha === latestCommit);

    const statuses = WATCHED.map(name => {
      const run = currentRuns
        .filter(r => r.workflowName === name)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
      return { name, status: run?.status, conclusion: run?.conclusion };
    });

    // Compact status line: CI Build: ✅  CI Quality: 🔄  CI Security: ✅  CD Deploy: ⏳
    const line = statuses.map(s => {
      const short = s.name.replace('CI ', '').replace('CD ', 'Deploy:');
      if (!s.status)                                    return `${short}: ⏳`;
      if (s.status !== 'completed')                     return `${short}: 🔄`;
      if (s.conclusion === 'success')                   return `${short}: ✅`;
      if (s.conclusion === 'skipped')                   return `${short}: ⏭️`;
      return `${short}: ❌`;
    }).join('  ');

    logInfo(`  [${elapsed}s] ${line}`);

    // Any hard failure → abort
    const failed = statuses.find(s =>
      s.status === 'completed' &&
      s.conclusion !== 'success' &&
      s.conclusion !== 'skipped' &&
      s.conclusion !== null
    );
    if (failed) {
      logError(`\n❌ ${failed.name} ${failed.conclusion}`);
      process.exit(1);
    }

    // All done (success or skipped)
    const allDone = statuses.every(s =>
      s.status === 'completed' &&
      (s.conclusion === 'success' || s.conclusion === 'skipped')
    );
    if (allDone) {
      logSuccess(`\n✅ Pipeline completo en ${elapsed}s`);
      return;
    }

    setTimeout(poll, INTERVAL * 1000);
  };

  poll();
}

/**
 * Watch workflow status (polling) - stops automatically when all workflows complete
 */
function watchStatus(baseInterval = 30) {
  logInfo(`👀 Watching GitHub Actions (adaptive polling)`);
  logInfo('Press Ctrl+C to stop watching manually\n');

  let iteration = 0;
  let consecutiveNoActivity = 0;

  const watch = () => {
    iteration++;
    logInfo(`\n${'='.repeat(60)}`);
    logInfo(`📊 Status Check #${iteration} - ${new Date().toLocaleString()}`);
    logInfo('='.repeat(60));

    const hasActivity = hasActiveWorkflows();

    if (!hasActivity) {
      consecutiveNoActivity++;
      logInfo(`\n⚪ No active workflows detected (${consecutiveNoActivity}/1 checks)`);

      // Stop after just 1 check with no activity (faster exit)
      if (consecutiveNoActivity >= 1) {
        logInfo('\n🏁 All workflows completed ✅');
        logInfo('🚀 Check deployment: npm run deploy:status');

        // Show final status before stopping
        showCurrentStatus();
        return; // Stop watching
      }
    } else {
      consecutiveNoActivity = 0; // Reset counter if there's activity
    }

    const result = showCurrentStatus();

    // Double-check: if showCurrentStatus also reports no activity, stop immediately
    if (!result.hasActivity && !hasActivity) {
      logInfo('\n🏁 All workflows completed ✅');
      logInfo('🚀 Check deployment: npm run deploy:status');
      return; // Stop watching immediately
    }

    // Continue watching with adaptive interval
    const runs = getWorkflowRuns(20);
    const latestCommit = getLatestCommit();
    const adaptiveInterval = getAdaptiveInterval(runs, latestCommit);

    logInfo(`\n⏰ Next check in ${adaptiveInterval}s (adaptive polling)`);
    setTimeout(watch, adaptiveInterval * 1000);
  };

  // Initial check
  const initialActivity = hasActiveWorkflows();
  if (!initialActivity) {
    logInfo('⚪ No active workflows detected for current commit.');
    logInfo('💡 All workflows appear to be completed.');
    logInfo('💡 Use "npm run gh:current" to see final status\n');

    // Show current status and stop
    const result = showCurrentStatus();

    logInfo('\n🏁 No active workflows found. All completed ✅');
    logInfo('🚀 Check deployment: npm run deploy:status');
    return; // Don't start watching if there's no activity
  } else {
    logInfo('🔄 Active workflows detected. Starting adaptive watch mode...\n');
    const result = showCurrentStatus();

    // Use adaptive interval for first check
    const runs = getWorkflowRuns(20);
    const latestCommit = getLatestCommit();
    const adaptiveInterval = getAdaptiveInterval(runs, latestCommit);

    logInfo(`⏰ Next check in ${adaptiveInterval}s (adaptive polling)`);
    setTimeout(watch, adaptiveInterval * 1000);
  }
}

/**
 * Show failure logs for current commit
 */
function showFailureLogs() {
  logHeader('🔍 GitHub Actions Failure Analysis');

  if (!checkGitHubCLI()) {
    logError('GitHub CLI (gh) is not installed or not authenticated');
    return false;
  }

  const currentBranch = getCurrentBranch();
  const latestCommit = getLatestCommit();

  logInfo(`Commit: ${latestCommit.slice(0, 8)}`);
  logInfo(`Branch: ${currentBranch}`);

  // Get runs for current commit
  const runs = getWorkflowRuns(20);
  const currentRuns = runs.filter(run => run.headSha === latestCommit);

  // Build push trigger map to filter phantom runs
  const workflowFiles = getWorkflowFiles();
  const workflowPushMap = {};
  workflowFiles.forEach(file => {
    const wf = parseWorkflowFile(file);
    workflowPushMap[wf.name] = wf.hasPushTrigger;
    workflowPushMap[`.github/workflows/${wf.file}`] = wf.hasPushTrigger;
  });

  const failedRuns = currentRuns
    .filter(run => run.conclusion === 'failure')
    .filter(run => {
      if (run.event === 'push' && workflowPushMap[run.workflowName] === false) return false;
      return true;
    });

  if (failedRuns.length === 0) {
    logInfo('\n✅ No failed workflows found for current commit');
    return true;
  }

  logInfo(`\n❌ Found ${failedRuns.length} failed workflow(s):\n`);

  failedRuns.forEach((run, index) => {
    logError(`${index + 1}. ${run.workflowName} - ${formatStatus(run.status, run.conclusion)}`);
    logInfo(`   URL: ${run.url}`);

    // Get detailed logs for this run
    try {
      logInfo(`   📋 Getting failure details...`);
      const logs = execSync(`gh run view ${run.url.split('/').pop()} --log-failed`, {
        encoding: 'utf8',
        cwd: rootDir,
      });

      if (logs.trim()) {
        logInfo(`   🔍 Failure logs:`);
        // Show only the most relevant error lines
        const errorLines = logs
          .split('\n')
          .filter(
            line =>
              line.includes('Error:') ||
              line.includes('Failed:') ||
              line.includes('error') ||
              line.includes('✗') ||
              line.includes('❌') ||
              line.includes('FAIL')
          )
          .slice(0, 5); // Show only first 5 error lines

        if (errorLines.length > 0) {
          errorLines.forEach(line => {
            logError(`     ${line.trim()}`);
          });
        } else {
          logInfo(`     No specific error messages found in logs`);
        }
      }
    } catch (error) {
      logWarning(`   ⚠️  Could not fetch detailed logs: ${error.message}`);
    }

    logInfo(''); // Empty line between workflows
  });

  // Summary and recommendations
  logInfo('🔧 Troubleshooting Tips:');
  logInfo('  • Click on the URLs above to see full logs in GitHub');
  logInfo('  • Check if the issue reproduces locally with:');
  logInfo('    - npm run pipeline:quality');
  logInfo('    - npm run pipeline:security');
  logInfo('    - npm run pipeline:build');
  logInfo('  • Compare local vs CI environment differences');

  return failedRuns.length === 0;
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'status';

  switch (command) {
    case 'status':
    case 's':
      showWorkflowStatus();
      break;

    case 'current':
    case 'c':
      showCurrentStatus();
      break;

    case 'ci-wait':
    case 'watch-all':
      watchAll(parseInt(args[1]) || 600);
      break;

    case 'watch':
    case 'w':      const interval = parseInt(args[1]) || 30;
      watchStatus(interval);
      break;

    case 'logs':
    case 'failures':
    case 'f':
      showFailureLogs();
      break;

    case 'help':
    case 'h':
      logHeader('🔍 GitHub Actions Status Checker');
      logInfo('\nUsage: node scripts/git/github-actions-status.js [command] [options]\n');
      logInfo('Commands:');
      logInfo('  status, s       Show overview of all workflows and recent runs');
      logInfo('  current, c      Show status for current commit/branch');
      logInfo('  watch, w [n]    Watch status with n second intervals (default: 30)');
      logInfo('  logs, failures  Show failure logs for current commit');
      logInfo('  help, h         Show this help message\n');
      logInfo('Examples:');
      logInfo('  npm run gh:status         # Show workflow overview');
      logInfo('  npm run gh:current        # Show current commit status');
      logInfo('  npm run gh:watch          # Watch status every 30s');
      logInfo('  npm run gh:logs           # Show failure analysis');
      break;

    default:
      logError(`Unknown command: ${command}`);
      logInfo('Use "help" to see available commands');
      process.exit(1);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  logInfo('\n\n👋 Stopping GitHub Actions status checker...');
  process.exit(0);
});

// Check if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { checkGitHubCLI, getWorkflowRuns, showWorkflowStatus, showCurrentStatus, watchStatus, watchAll };
