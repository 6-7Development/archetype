#!/usr/bin/env tsx
/**
 * Meta-SySop Setup and Configuration Helper
 * 
 * This script helps platform owners:
 * 1. Verify GitHub configuration
 * 2. Test GitHub API connectivity
 * 3. Enable/disable maintenance mode
 * 4. Check Meta-SySop system status
 */

import { getGitHubService, isGitHubServiceAvailable } from '../server/githubService.js';

// Simple color helpers (no external dependencies)
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

// Helper function to apply bold style
function applyBold(text: string, color: string = ''): string {
  return `${colors.bold}${color}${text}${colors.reset}`;
}

const chalk = {
  bold: (text: string) => applyBold(text),
  green: (text: string) => `${colors.green}${text}${colors.reset}`,
  red: (text: string) => `${colors.red}${text}${colors.reset}`,
  yellow: (text: string) => `${colors.yellow}${text}${colors.reset}`,
  cyan: (text: string) => `${colors.cyan}${text}${colors.reset}`,
};

// Add bold color combinations
chalk.bold = Object.assign(chalk.bold, {
  cyan: (text: string) => applyBold(text, colors.cyan),
  green: (text: string) => applyBold(text, colors.green),
  red: (text: string) => applyBold(text, colors.red),
  yellow: (text: string) => applyBold(text, colors.yellow),
});

interface SetupCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  fix?: string;
}

async function checkEnvironmentVariables(): Promise<SetupCheck[]> {
  const checks: SetupCheck[] = [];

  // Check GITHUB_TOKEN
  if (process.env.GITHUB_TOKEN) {
    checks.push({
      name: 'GITHUB_TOKEN',
      status: 'pass',
      message: 'GitHub token is configured',
    });
  } else {
    checks.push({
      name: 'GITHUB_TOKEN',
      status: 'fail',
      message: 'GitHub token is missing',
      fix: 'Set GITHUB_TOKEN environment variable with a GitHub Personal Access Token',
    });
  }

  // Check GITHUB_REPO
  if (process.env.GITHUB_REPO) {
    const repoFormat = /^[\w-]+\/[\w-]+$/;
    if (repoFormat.test(process.env.GITHUB_REPO)) {
      checks.push({
        name: 'GITHUB_REPO',
        status: 'pass',
        message: `Repository configured: ${process.env.GITHUB_REPO}`,
      });
    } else {
      checks.push({
        name: 'GITHUB_REPO',
        status: 'fail',
        message: `Invalid repository format: ${process.env.GITHUB_REPO}`,
        fix: 'GITHUB_REPO must be in format "owner/repo-name"',
      });
    }
  } else {
    checks.push({
      name: 'GITHUB_REPO',
      status: 'fail',
      message: 'GitHub repository is not configured',
      fix: 'Set GITHUB_REPO environment variable (e.g., "6-7Development/archetype")',
    });
  }

  // Check GITHUB_BRANCH
  if (process.env.GITHUB_BRANCH) {
    checks.push({
      name: 'GITHUB_BRANCH',
      status: 'pass',
      message: `Target branch: ${process.env.GITHUB_BRANCH}`,
    });
  } else {
    checks.push({
      name: 'GITHUB_BRANCH',
      status: 'warn',
      message: 'GitHub branch not set, will default to "main"',
      fix: 'Set GITHUB_BRANCH environment variable if you want to use a different branch',
    });
  }

  // Check ANTHROPIC_API_KEY
  if (process.env.ANTHROPIC_API_KEY) {
    checks.push({
      name: 'ANTHROPIC_API_KEY',
      status: 'pass',
      message: 'Anthropic API key is configured',
    });
  } else {
    checks.push({
      name: 'ANTHROPIC_API_KEY',
      status: 'fail',
      message: 'Anthropic API key is missing',
      fix: 'Set ANTHROPIC_API_KEY environment variable for Claude AI functionality',
    });
  }

  // Check NODE_ENV
  checks.push({
    name: 'NODE_ENV',
    status: 'pass',
    message: `Environment: ${process.env.NODE_ENV || 'development'}`,
  });

  // Check DATABASE_URL
  if (process.env.DATABASE_URL) {
    checks.push({
      name: 'DATABASE_URL',
      status: 'pass',
      message: 'Database URL is configured',
    });
  } else {
    checks.push({
      name: 'DATABASE_URL',
      status: 'warn',
      message: 'Database URL is not set (optional for environment check)',
      fix: 'Set DATABASE_URL to enable full functionality checks',
    });
  }

  return checks;
}

async function testGitHubConnection(): Promise<SetupCheck> {
  if (!isGitHubServiceAvailable()) {
    return {
      name: 'GitHub Connection',
      status: 'fail',
      message: 'GitHub service not initialized (missing environment variables)',
    };
  }

  try {
    const githubService = getGitHubService();
    const latestCommit = await githubService.getLatestCommit();
    
    return {
      name: 'GitHub Connection',
      status: 'pass',
      message: `Successfully connected to GitHub\nLatest commit: ${latestCommit.substring(0, 7)}`,
    };
  } catch (error: any) {
    return {
      name: 'GitHub Connection',
      status: 'fail',
      message: `Failed to connect to GitHub: ${error.message}`,
      fix: 'Verify your GITHUB_TOKEN has proper permissions (repo scope)',
    };
  }
}

async function checkMaintenanceMode(): Promise<SetupCheck> {
  // Skip database check if DATABASE_URL is not set
  if (!process.env.DATABASE_URL) {
    return {
      name: 'Maintenance Mode',
      status: 'warn',
      message: 'DATABASE_URL not set - cannot check maintenance mode status',
      fix: 'Set DATABASE_URL to check maintenance mode (optional for this verification)',
    };
  }

  try {
    // Dynamically import storage only when DATABASE_URL is available
    const { storage } = await import('../server/storage.js');
    const mode = await storage.getMaintenanceMode();
    
    if (mode.enabled) {
      return {
        name: 'Maintenance Mode',
        status: 'warn',
        message: `Maintenance mode is ENABLED\nReason: ${mode.reason || 'Not specified'}\nEnabled at: ${mode.enabledAt || 'Unknown'}`,
      };
    } else {
      return {
        name: 'Maintenance Mode',
        status: 'pass',
        message: 'Maintenance mode is disabled (platform protected)',
      };
    }
  } catch (error: any) {
    return {
      name: 'Maintenance Mode',
      status: 'warn',
      message: `Could not check maintenance mode: ${error.message}`,
    };
  }
}

async function testFileWrite(): Promise<SetupCheck> {
  if (process.env.NODE_ENV === 'production') {
    return {
      name: 'File Write Test',
      status: 'warn',
      message: 'Skipped in production (requires maintenance mode)',
    };
  }

  // Test local file system write in development only
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const testFile = path.join('/tmp', `meta-sysop-test-${Date.now()}.txt`);
    
    await fs.writeFile(testFile, 'Test content', 'utf-8');
    await fs.unlink(testFile);
    
    return {
      name: 'File Write Test',
      status: 'pass',
      message: 'File system is writable (development mode)',
    };
  } catch (error: any) {
    return {
      name: 'File Write Test',
      status: 'fail',
      message: `File system write failed: ${error.message}`,
    };
  }
}

function printCheck(check: SetupCheck) {
  const icon = {
    pass: '✅',
    fail: '❌',
    warn: '⚠️ ',
  }[check.status];

  const colorFunc = {
    pass: chalk.green,
    fail: chalk.red,
    warn: chalk.yellow,
  }[check.status];

  const boldColorFunc = {
    pass: chalk.bold.green,
    fail: chalk.bold.red,
    warn: chalk.bold.yellow,
  }[check.status];

  console.log(`\n${icon} ${boldColorFunc(check.name)}`);
  console.log(`   ${colorFunc(check.message)}`);
  
  if (check.fix) {
    console.log(`   ${chalk.cyan('→')} ${chalk.cyan(check.fix)}`);
  }
}

async function main() {
  console.log(chalk.bold.cyan('\n╔══════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║   Meta-SySop Setup & Configuration Check        ║'));
  console.log(chalk.bold.cyan('╚══════════════════════════════════════════════════╝\n'));

  // Run all checks
  console.log(chalk.bold('🔍 Running diagnostics...\n'));

  const envChecks = await checkEnvironmentVariables();
  envChecks.forEach(printCheck);

  const githubCheck = await testGitHubConnection();
  printCheck(githubCheck);

  const maintenanceCheck = await checkMaintenanceMode();
  printCheck(maintenanceCheck);

  const writeCheck = await testFileWrite();
  printCheck(writeCheck);

  // Summary
  console.log(chalk.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
  
  const allChecks = [...envChecks, githubCheck, maintenanceCheck, writeCheck];
  const passed = allChecks.filter(c => c.status === 'pass').length;
  const failed = allChecks.filter(c => c.status === 'fail').length;
  const warnings = allChecks.filter(c => c.status === 'warn').length;

  console.log(chalk.bold('📊 Summary:'));
  console.log(`   ${chalk.green('✅ Passed:')} ${passed}`);
  console.log(`   ${chalk.red('❌ Failed:')} ${failed}`);
  console.log(`   ${chalk.yellow('⚠️  Warnings:')} ${warnings}`);

  if (failed === 0 && warnings === 0) {
    console.log(chalk.bold.green('\n🎉 All checks passed! Meta-SySop is ready to use.\n'));
    console.log(chalk.cyan('Next steps:'));
    console.log(chalk.cyan('1. Navigate to /platform-healing in your browser'));
    console.log(chalk.cyan('2. Enable maintenance mode (production only)'));
    console.log(chalk.cyan('3. Start chatting with Meta-SySop!\n'));
  } else if (failed > 0) {
    console.log(chalk.bold.red('\n❌ Setup incomplete. Please fix the failed checks above.\n'));
    console.log(chalk.cyan('Common fixes:'));
    console.log(chalk.cyan('• Set GITHUB_TOKEN: https://github.com/settings/tokens/new'));
    console.log(chalk.cyan('• Set GITHUB_REPO: export GITHUB_REPO="owner/repo-name"'));
    console.log(chalk.cyan('• Set ANTHROPIC_API_KEY: Get from https://console.anthropic.com/\n'));
  } else {
    console.log(chalk.bold.yellow('\n⚠️  Setup mostly complete but has warnings.\n'));
    console.log(chalk.cyan('Meta-SySop should work, but review warnings above.\n'));
  }

  // Additional info
  if (process.env.NODE_ENV === 'production') {
    console.log(chalk.bold.yellow('ℹ️  Production Environment Detected'));
    console.log(chalk.yellow('   • Enable maintenance mode to allow platform edits'));
    console.log(chalk.yellow('   • Changes will be committed to GitHub automatically'));
    console.log(chalk.yellow('   • Railway will auto-deploy from GitHub commits\n'));
  } else {
    console.log(chalk.bold.cyan('ℹ️  Development Environment Detected'));
    console.log(chalk.cyan('   • File changes are written directly to filesystem'));
    console.log(chalk.cyan('   • No maintenance mode required'));
    console.log(chalk.cyan('   • GitHub commits are optional for testing\n'));
  }

  process.exit(failed > 0 ? 1 : 0);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(chalk.red('\n❌ Setup check failed:'), error);
    process.exit(1);
  });
}

export { checkEnvironmentVariables, testGitHubConnection, checkMaintenanceMode };
