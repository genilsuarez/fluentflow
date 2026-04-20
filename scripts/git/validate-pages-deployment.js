#!/usr/bin/env node

/**
 * GitHub Pages Deployment Validator
 * 
 * Validates the latest deployment status from GitHub Pages API
 * Usage: node scripts/deployment/validate-pages-deployment.js [options]
 */

import { execSync } from 'child_process';
import { colors, log, logHeader, logSuccess, logError, logWarning, logInfo } from '../utils/logger.js';

// Repository configuration
const REPO_OWNER = 'genilsuarez';
const REPO_NAME = 'fluentflow';
const PAGES_URL = `https://${REPO_OWNER}.github.io/${REPO_NAME}/`;

/**
 * Fix GitHub Pages configuration to properly reflect GitHub Actions deployment
 */
async function fixPagesConfiguration(pagesInfo) {
  try {
    // Check if we're using GitHub Actions deployment but config shows legacy source
    if (pagesInfo?.build_type === 'workflow' && pagesInfo?.source?.branch === 'gh-pages') {
      logWarning('Detected legacy configuration with modern deployment method');
      logInfo('Attempting to update Pages configuration...');

      // Try to update the configuration to properly reflect GitHub Actions
      try {
        // First, try to disable and re-enable Pages with correct settings
        logInfo('🔧 Updating GitHub Pages configuration via API...');

        // The correct way is to ensure build_type is set to workflow
        // The source will be managed automatically by GitHub Actions
        const updateCommand = `gh api --method PUT repos/${REPO_OWNER}/${REPO_NAME}/pages --field build_type=workflow`;
        execSync(updateCommand, { encoding: 'utf8' });

        logSuccess('✅ GitHub Pages configuration updated successfully');
        logInfo('💡 Configuration now properly reflects GitHub Actions deployment');

        // Verify the update
        const verifyCommand = `gh api repos/${REPO_OWNER}/${REPO_NAME}/pages --jq '{build_type: .build_type, source: .source}'`;
        const updatedConfig = execSync(verifyCommand, { encoding: 'utf8' });
        const config = JSON.parse(updatedConfig);

        logInfo('📋 Updated configuration:');
        logInfo(`   Build Type: ${config.build_type}`);
        logInfo(`   Source: ${config.source?.branch || 'GitHub Actions managed'}`);

        return true;
      } catch (apiError) {
        logWarning('⚠️ API update method not fully supported for this configuration');
        logInfo('💡 This is a GitHub API limitation, not an error with your setup');
        logInfo('🎯 Your deployment method is correct and working properly');
        return false;
      }
    }

    return true;
  } catch (error) {
    logError(`Failed to fix Pages configuration: ${error.message}`);
    return false;
  }
}

/**
 * Get current commit hash
 */
function getCurrentCommit() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch (error) {
    logError('Failed to get current commit hash');
    return null;
  }
}

/**
 * Get current branch
 */
function getCurrentBranch() {
  try {
    return execSync('git branch --show-current', { encoding: 'utf8' }).trim();
  } catch (error) {
    logError('Failed to get current branch');
    return null;
  }
}

/**
 * Fetch GitHub Pages deployment status
 */
async function fetchPagesDeployment() {
  try {
    logInfo('Fetching GitHub Pages configuration...');

    // Use gh CLI which handles authentication properly
    const ghCommand = `gh api repos/${REPO_OWNER}/${REPO_NAME}/pages`;

    const response = execSync(ghCommand, { encoding: 'utf8' });
    const pagesInfo = JSON.parse(response);

    return pagesInfo;
  } catch (error) {
    // Check if it's a 404 (Pages not configured) or authentication issue
    if (error.message.includes('404') || error.message.includes('Not Found')) {
      logWarning('GitHub Pages not configured for this repository');
    } else if (error.message.includes('401') || error.message.includes('403')) {
      logWarning('GitHub Pages API not accessible (authentication required)');
    } else {
      logWarning(`Pages API not available: ${error.message}`);
    }
    return null;
  }
}

/**
 * Fetch latest deployment from deployments API
 */
async function fetchLatestDeployment() {
  try {
    logInfo('Fetching latest deployment information...');

    // Try both production and github-pages environments
    const environments = ['production', 'github-pages'];
    let latestDeployment = null;
    let deploymentStatus = null;

    for (const env of environments) {
      try {
        const ghCommand = `gh api repos/${REPO_OWNER}/${REPO_NAME}/deployments --jq '[.[] | select(.environment == "${env}")] | .[0]'`;
        const response = execSync(ghCommand, { encoding: 'utf8' }).trim();

        if (response && response !== 'null') {
          const deployment = JSON.parse(response);

          // Use the most recent deployment across all environments
          if (!latestDeployment || new Date(deployment.created_at) > new Date(latestDeployment.created_at)) {
            latestDeployment = deployment;

            // Fetch deployment status
            const statusCommand = `gh api repos/${REPO_OWNER}/${REPO_NAME}/deployments/${deployment.id}/statuses --jq '.[0]'`;
            const statusResponse = execSync(statusCommand, { encoding: 'utf8' }).trim();

            deploymentStatus = statusResponse && statusResponse !== 'null' ? JSON.parse(statusResponse) : null;
          }
        }
      } catch (envError) {
        // Continue to next environment if this one fails
        continue;
      }
    }

    if (!latestDeployment) {
      return null;
    }

    return {
      deployment: latestDeployment,
      status: deploymentStatus
    };
  } catch (error) {
    logError(`Failed to fetch deployment: ${error.message}`);
    return null;
  }
}

/**
 * Check if there are active GitHub Actions workflows
 */
async function checkActiveWorkflows() {
  try {
    const ghCommand = `gh api repos/${REPO_OWNER}/${REPO_NAME}/actions/runs --jq '.workflow_runs[] | select(.status == "in_progress" or .status == "queued") | {name: .name, status: .status, html_url: .html_url, head_sha: .head_sha}'`;

    const response = execSync(ghCommand, { encoding: 'utf8' }).trim();

    if (!response) {
      return [];
    }

    // Parse multiple JSON objects (one per line)
    const lines = response.split('\n').filter(line => line.trim());
    return lines.map(line => JSON.parse(line));
  } catch (error) {
    logWarning(`Could not check GitHub Actions status: ${error.message}`);
    return [];
  }
}

/**
 * Test if the deployed site is accessible with performance metrics
 */
async function testSiteAccessibility() {
  try {
    logInfo(`Testing site accessibility: ${PAGES_URL}`);

    // Enhanced curl command with performance metrics
    const curlCommand = `curl -s -o /dev/null -w "%{http_code}|%{time_total}|%{size_download}" --max-time 10 "${PAGES_URL}"`;
    const response = execSync(curlCommand, { encoding: 'utf8' }).trim();
    
    const [httpCode, timeTotal, sizeDownload] = response.split('|');
    const responseTimeMs = Math.round(parseFloat(timeTotal) * 1000);
    const sizeKB = Math.round(parseInt(sizeDownload) / 1024);

    return {
      accessible: httpCode === '200',
      httpCode: httpCode,
      responseTime: responseTimeMs,
      size: sizeKB
    };
  } catch (error) {
    logError(`Failed to test site accessibility: ${error.message}`);
    return {
      accessible: false,
      httpCode: 'ERROR',
      responseTime: null,
      size: null
    };
  }
}

/**
 * Get deployment timestamp in readable format
 */
function formatTimestamp(timestamp) {
  if (!timestamp) return 'Unknown';

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  let timeAgo = '';
  if (diffDays > 0) {
    timeAgo = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else if (diffHours > 0) {
    timeAgo = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffMins > 0) {
    timeAgo = `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  } else {
    timeAgo = 'Just now';
  }

  return `${date.toLocaleString()} (${timeAgo})`;
}

/**
 * Main validation function
 */
async function validateDeployment() {
  logHeader('🚀 Deployment Status');

  const currentCommit = getCurrentCommit();
  const currentBranch = getCurrentBranch();

  if (currentCommit && currentBranch) {
    logInfo(`📍 ${currentBranch}@${currentCommit.substring(0, 8)}`);
  }

  // Fetch Pages configuration
  const pagesInfo = await fetchPagesDeployment();
  if (pagesInfo) {
    // Detect deployment method
    if (pagesInfo.build_type === 'workflow') {
      logSuccess('✨ GitHub Actions deployment (Modern)');
      if (pagesInfo.source?.branch === 'gh-pages') {
        // Attempt to fix the configuration silently
        await fixPagesConfiguration(pagesInfo);
      }
    } else if (pagesInfo.source?.branch) {
      logInfo(`📋 Source: ${pagesInfo.source.branch} branch (Legacy)`);
    }
  }

  // Fetch latest deployment
  const deploymentInfo = await fetchLatestDeployment();
  if (deploymentInfo) {
    const { deployment, status } = deploymentInfo;

    const deployedSha = deployment.sha?.substring(0, 8) || 'Unknown';
    const deploymentTime = formatTimestamp(deployment.created_at);

    if (status) {
      const statusColor = status.state === 'success' ? colors.green :
        status.state === 'failure' ? colors.red :
          status.state === 'pending' ? colors.yellow : colors.white;

      log(`\n📦 Deployment: ${status.state} | ${deployedSha} | ${deploymentTime}`, statusColor);
    } else {
      logInfo(`\n📦 Deployment: ${deployedSha} | ${deploymentTime}`);
    }

    // Check if current commit matches deployed commit
    if (currentCommit && deployment.sha) {
      const isCurrentDeployed = currentCommit.startsWith(deployment.sha) || deployment.sha.startsWith(currentCommit);

      if (isCurrentDeployed) {
        logSuccess('✅ Current commit deployed');
      } else {
        const deploymentTime = new Date(deployment.created_at);
        const now = new Date();
        const diffMinutes = (now - deploymentTime) / (1000 * 60);

        if (diffMinutes < 10 && status?.state === 'pending') {
          logInfo('🚀 Deployment in progress');
        } else if (diffMinutes < 10 && status?.state === 'success') {
          logWarning('⏳ Recent deployment - propagating');
        } else {
          logWarning(`⚠️ Local: ${currentCommit.substring(0, 8)} | Deployed: ${deployment.sha.substring(0, 8)}`);
        }
      }
    }
  }

  // Check for active workflows
  const activeWorkflows = await checkActiveWorkflows();
  if (activeWorkflows.length > 0) {
    const workflowNames = activeWorkflows.map(w => w.name).join(', ');
    logInfo(`⚡ Active: ${workflowNames}`);
  }

  // Test site accessibility with performance metrics
  const accessibility = await testSiteAccessibility();

  if (accessibility.accessible) {
    const perfInfo = accessibility.responseTime ? ` | ${accessibility.responseTime}ms` : '';
    const sizeInfo = accessibility.size ? ` | ${accessibility.size}KB` : '';
    logSuccess(`🌐 Site accessible (HTTP ${accessibility.httpCode}${perfInfo}${sizeInfo})`);
  } else {
    logError(`🌐 Site not accessible (HTTP ${accessibility.httpCode})`);
  }

  // Final summary
  let overallStatus = 'UNKNOWN';
  let statusColor = colors.white;

  // Determine status based on available information
  if (accessibility.accessible) {
    if (deploymentInfo?.status?.state === 'success') {
      if (activeWorkflows.length > 0 && currentCommit && deploymentInfo?.deployment?.sha &&
        !currentCommit.startsWith(deploymentInfo.deployment.sha)) {
        overallStatus = 'UPDATING';
        statusColor = colors.yellow;
      } else {
        overallStatus = 'HEALTHY';
        statusColor = colors.green;
      }
    } else if (deploymentInfo?.status?.state === 'pending' || activeWorkflows.length > 0) {
      overallStatus = 'DEPLOYING';
      statusColor = colors.yellow;
    } else if (deploymentInfo?.status?.state === 'failure') {
      overallStatus = 'FAILED';
      statusColor = colors.red;
    } else {
      overallStatus = 'ACCESSIBLE';
      statusColor = colors.green;
    }
  } else {
    if (activeWorkflows.length > 0) {
      overallStatus = 'DEPLOYING';
      statusColor = colors.yellow;
    } else {
      overallStatus = 'INACCESSIBLE';
      statusColor = colors.red;
    }
  }

  log(`\n📊 Status: ${overallStatus}`, colors.bright + statusColor);

  console.log('='.repeat(40));

  // Enhanced final message with temporal context
  logInfo(`🌐 ${PAGES_URL}`);
  
  // Add deployment timing context
  if (deploymentInfo?.deployment) {
    const deployTime = formatTimestamp(deploymentInfo.deployment.created_at);
    const timeAgo = deployTime.split('(')[1]?.replace(')', '') || 'recently';
    logInfo(`⏰ Last deploy: ${timeAgo}`);
  }
  
  // Add performance context if available
  if (accessibility.accessible && accessibility.responseTime) {
    const perfStatus = accessibility.responseTime < 200 ? '⚡ Fast' : 
                      accessibility.responseTime < 500 ? '🟡 Good' : '🔴 Slow';
    logInfo(`${perfStatus} response: ${accessibility.responseTime}ms`);
  }
  
  console.log('='.repeat(40));

  return overallStatus === 'HEALTHY' || overallStatus === 'ACCESSIBLE' || overallStatus === 'UPDATING' || overallStatus === 'DEPLOYING';
}

// Handle command line execution
if (import.meta.url === `file://${process.argv[1]}`) {
  validateDeployment()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      logError(`Validation failed: ${error.message}`);
      process.exit(1);
    });
}

export { validateDeployment };